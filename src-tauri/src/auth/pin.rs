use argon2::Argon2;
use argon2::password_hash::{PasswordHash, PasswordHasher, PasswordVerifier, SaltString};

use crate::error::{AppError, AppResult};

/// Genera un hash Argon2 del PIN proporcionado.
/// Argon2 es resistente a ataques de fuerza bruta y timing attacks.
pub fn hash_pin(pin: &str) -> AppResult<String> {
    // Generar salt aleatorio de 16 bytes usando rand (0.9)
    let salt_bytes: [u8; 16] = rand::random();
    let salt = SaltString::encode_b64(&salt_bytes)
        .map_err(|e| AppError::Interno(format!("Error al generar salt: {}", e)))?;

    let argon2 = Argon2::default();

    let hash = argon2
        .hash_password(pin.as_bytes(), &salt)
        .map_err(|e| AppError::Interno(format!("Error al hashear PIN: {}", e)))?;

    Ok(hash.to_string())
}

/// Verifica un PIN contra su hash Argon2 almacenado.
pub fn verificar_pin(pin: &str, hash: &str) -> AppResult<bool> {
    let parsed_hash = PasswordHash::new(hash)
        .map_err(|e| AppError::Interno(format!("Hash almacenado inválido: {}", e)))?;

    Ok(Argon2::default()
        .verify_password(pin.as_bytes(), &parsed_hash)
        .is_ok())
}

/// Valida que un PIN cumple los requisitos mínimos (4-6 dígitos numéricos).
pub fn validar_pin(pin: &str) -> AppResult<()> {
    if pin.len() < 4 || pin.len() > 6 {
        return Err(AppError::Validation(
            "El PIN debe tener entre 4 y 6 dígitos".into(),
        ));
    }

    if !pin.chars().all(|c| c.is_ascii_digit()) {
        return Err(AppError::Validation(
            "El PIN debe contener solo dígitos numéricos".into(),
        ));
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_hash_y_verificar_pin() {
        let pin = "1234";
        let hash = hash_pin(pin).unwrap();
        assert!(verificar_pin(pin, &hash).unwrap());
        assert!(!verificar_pin("0000", &hash).unwrap());
    }

    #[test]
    fn test_validar_pin_correcto() {
        assert!(validar_pin("1234").is_ok());
        assert!(validar_pin("123456").is_ok());
    }

    #[test]
    fn test_validar_pin_incorrecto() {
        assert!(validar_pin("123").is_err());     // muy corto
        assert!(validar_pin("1234567").is_err());  // muy largo
        assert!(validar_pin("12ab").is_err());     // no numérico
    }
}
