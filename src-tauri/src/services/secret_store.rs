//! Almacén de secretos cifrados.
//!
//! Los secretos sensibles (certificado VeriFactu, su contraseña y las
//! credenciales SMTP) ya no se guardan en texto plano en la base de datos.
//! En su lugar:
//!
//! 1. Se genera una **clave maestra** aleatoria de 32 bytes que se guarda en el
//!    almacén de credenciales del sistema operativo (Windows Credential Manager,
//!    macOS Keychain o keyutils en Linux) a través del crate `keyring`.
//! 2. Cada secreto se cifra con XChaCha20-Poly1305 usando esa clave y se guarda
//!    en la base de datos únicamente como texto cifrado (prefijado con `enc:v1:`).
//!
//! De este modo, el robo del fichero `negocio.db` por sí solo es inútil: sin la
//! clave maestra del keyring del SO los secretos no pueden descifrarse. El
//! certificado `.p12` (demasiado grande para el Credential Manager de Windows)
//! se cifra y guarda en la BD, mientras que solo la clave de 32 bytes vive en el
//! keyring.

use base64::{engine::general_purpose::STANDARD, Engine as _};
use chacha20poly1305::{
    aead::{Aead, KeyInit},
    Key, XChaCha20Poly1305, XNonce,
};

use crate::error::{AppError, AppResult};

const KEYRING_SERVICE: &str = "com.tormel.pos";
const KEYRING_DEK_ACCOUNT: &str = "secrets-dek";
const ENC_PREFIX: &str = "enc:v1:";
const NONCE_LEN: usize = 24;

/// Obtiene la clave maestra del keyring del SO, creándola si no existe.
fn obtener_o_crear_clave() -> AppResult<[u8; 32]> {
    let entry = keyring::Entry::new(KEYRING_SERVICE, KEYRING_DEK_ACCOUNT)
        .map_err(|e| AppError::Interno(format!("No se pudo acceder al keyring: {}", e)))?;

    match entry.get_password() {
        Ok(b64) => {
            let bytes = STANDARD
                .decode(b64.trim())
                .map_err(|e| AppError::Interno(format!("Clave maestra corrupta: {}", e)))?;
            let arr: [u8; 32] = bytes
                .try_into()
                .map_err(|_| AppError::Interno("La clave maestra no tiene 32 bytes".into()))?;
            Ok(arr)
        }
        Err(keyring::Error::NoEntry) => {
            // Primera vez: generar y persistir una clave nueva.
            let clave: [u8; 32] = rand::random();
            let b64 = STANDARD.encode(clave);
            entry
                .set_password(&b64)
                .map_err(|e| AppError::Interno(format!("No se pudo guardar la clave maestra: {}", e)))?;
            Ok(clave)
        }
        Err(e) => Err(AppError::Interno(format!(
            "Error leyendo la clave maestra del keyring: {}",
            e
        ))),
    }
}

/// Indica si un valor almacenado está cifrado por este módulo.
pub fn esta_cifrado(valor: &str) -> bool {
    valor.starts_with(ENC_PREFIX)
}

/// Cifra un secreto en texto plano para almacenarlo. Devuelve un token
/// `enc:v1:<base64(nonce||ciphertext)>`.
pub fn cifrar(plano: &str) -> AppResult<String> {
    let clave = obtener_o_crear_clave()?;
    let cipher = XChaCha20Poly1305::new(Key::from_slice(&clave));

    let nonce_bytes: [u8; NONCE_LEN] = rand::random();
    let nonce = XNonce::from_slice(&nonce_bytes);

    let ciphertext = cipher
        .encrypt(nonce, plano.as_bytes())
        .map_err(|e| AppError::Interno(format!("Error al cifrar secreto: {}", e)))?;

    let mut combinado = Vec::with_capacity(NONCE_LEN + ciphertext.len());
    combinado.extend_from_slice(&nonce_bytes);
    combinado.extend_from_slice(&ciphertext);

    Ok(format!("{}{}", ENC_PREFIX, STANDARD.encode(combinado)))
}

/// Descifra un valor almacenado. Si el valor no está cifrado (instalaciones
/// previas con secretos en texto plano), se devuelve tal cual para no romper la
/// configuración existente; se re-cifrará la próxima vez que se guarde.
pub fn descifrar(valor: &str) -> AppResult<String> {
    let Some(b64) = valor.strip_prefix(ENC_PREFIX) else {
        return Ok(valor.to_string());
    };

    let clave = obtener_o_crear_clave()?;
    let cipher = XChaCha20Poly1305::new(Key::from_slice(&clave));

    let combinado = STANDARD
        .decode(b64)
        .map_err(|e| AppError::Interno(format!("Secreto cifrado corrupto: {}", e)))?;

    if combinado.len() <= NONCE_LEN {
        return Err(AppError::Interno("Secreto cifrado demasiado corto".into()));
    }

    let (nonce_bytes, ciphertext) = combinado.split_at(NONCE_LEN);
    let nonce = XNonce::from_slice(nonce_bytes);

    let plano = cipher
        .decrypt(nonce, ciphertext)
        .map_err(|e| AppError::Interno(format!("Error al descifrar secreto: {}", e)))?;

    String::from_utf8(plano)
        .map_err(|e| AppError::Interno(format!("Secreto descifrado no es UTF-8 válido: {}", e)))
}

/// Descifra un secreto opcional, propagando `None`.
pub fn descifrar_opcional(valor: Option<&str>) -> AppResult<Option<String>> {
    match valor {
        Some(v) => Ok(Some(descifrar(v)?)),
        None => Ok(None),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn texto_plano_heredado_se_devuelve_tal_cual() {
        // Valores sin el prefijo enc: corresponden a configuraciones previas y no
        // requieren acceso al keyring: deben devolverse sin cambios.
        assert!(!esta_cifrado("secreto_antiguo"));
        assert_eq!(descifrar("secreto_antiguo").unwrap(), "secreto_antiguo");
        assert_eq!(
            descifrar_opcional(Some("abc")).unwrap(),
            Some("abc".to_string())
        );
        assert_eq!(descifrar_opcional(None).unwrap(), None);
    }

    #[test]
    fn reconoce_el_prefijo_cifrado() {
        assert!(esta_cifrado("enc:v1:loquesea"));
        assert!(!esta_cifrado("enc:v0:loquesea"));
    }
}
