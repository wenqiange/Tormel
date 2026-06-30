use tauri::State;
use rusqlite::Connection;
use serde::{Deserialize, Serialize};

use crate::auth::permissions::Permiso;
use crate::auth::session::SessionState;
use crate::db::connection::DbState;
use crate::error::{AppError, AppResult};
use crate::models::negocio::{Negocio, ActualizarNegocio};
use crate::repositories::negocio_repo::NegocioRepo;

#[derive(Serialize, Deserialize, Debug)]
pub struct VerifactuConfig {
    pub certificado_b64: Option<String>,
    pub password: Option<String>,
    pub entorno: Option<String>,
}

#[derive(Serialize, Debug)]
pub struct VerifactuConfigResumen {
    pub cargado: bool,
    pub entorno: String,
}

/// Helper para extraer la configuración de VeriFactu de la base de datos
pub fn obtener_config_verifactu_interna(conn: &Connection) -> AppResult<Option<VerifactuConfig>> {
    let config_str: String = conn.query_row(
        "SELECT configuracion FROM negocio WHERE id = 1",
        [],
        |row| row.get(0),
    )?;

    #[derive(Deserialize)]
    struct NegocioConfig {
        verifactu: Option<VerifactuConfig>,
    }

    if let Ok(config) = serde_json::from_str::<NegocioConfig>(&config_str) {
        match config.verifactu {
            Some(mut cfg) => {
                // Descifrado transparente de los secretos (cert + contraseña).
                cfg.certificado_b64 = crate::services::secret_store::descifrar_opcional(
                    cfg.certificado_b64.as_deref(),
                )?;
                cfg.password =
                    crate::services::secret_store::descifrar_opcional(cfg.password.as_deref())?;
                Ok(Some(cfg))
            }
            None => Ok(None),
        }
    } else {
        Ok(None)
    }
}

/// Guarda la configuración de VeriFactu (Certificado Digital, Contraseña y Entorno) en la BD.
#[tauri::command]
pub fn guardar_config_verifactu(
    certificado_b64: Option<String>,
    password: Option<String>,
    entorno: String,
    db: State<'_, DbState>,
    session: State<'_, SessionState>,
) -> AppResult<()> {
    session.exigir(Permiso::ConfiguracionSistema)?;
    let conn = db.conn.lock().map_err(|e| {
        AppError::Interno(format!("Error de bloqueo de BD: {}", e))
    })?;

    let config_str: String = conn.query_row(
        "SELECT configuracion FROM negocio WHERE id = 1",
        [],
        |row| row.get(0),
    )?;

    let mut config: serde_json::Value = serde_json::from_str(&config_str).unwrap_or_else(|_| serde_json::json!({}));

    let mut verifactu = config["verifactu"].clone();
    if verifactu.is_null() {
        verifactu = serde_json::json!({});
    }

    // Los secretos se cifran antes de persistirse; la clave vive en el keyring del SO.
    if let Some(b64) = certificado_b64 {
        let cifrado = crate::services::secret_store::cifrar(&b64)?;
        verifactu["certificado_b64"] = serde_json::json!(cifrado);
    }
    if let Some(pw) = password {
        let cifrado = crate::services::secret_store::cifrar(&pw)?;
        verifactu["password"] = serde_json::json!(cifrado);
    }
    verifactu["entorno"] = serde_json::json!(entorno);

    config["verifactu"] = verifactu;

    conn.execute(
        "UPDATE negocio SET configuracion = ?1 WHERE id = 1",
        [config.to_string()],
    )?;

    Ok(())
}

/// Obtiene un resumen seguro de la configuración de VeriFactu (si está cargado y el entorno).
#[tauri::command]
pub fn obtener_config_verifactu(db: State<'_, DbState>) -> AppResult<VerifactuConfigResumen> {
    let conn = db.conn.lock().map_err(|e| {
        AppError::Interno(format!("Error de bloqueo de BD: {}", e))
    })?;

    let verifactu_config = obtener_config_verifactu_interna(&conn)?;

    match verifactu_config {
        Some(cfg) => {
            let cargado = cfg.certificado_b64.is_some() && !cfg.certificado_b64.unwrap().is_empty();
            let entorno = cfg.entorno.unwrap_or_else(|| "pruebas".to_string());
            Ok(VerifactuConfigResumen { cargado, entorno })
        }
        None => Ok(VerifactuConfigResumen {
            cargado: false,
            entorno: "pruebas".to_string(),
        }),
    }
}

/// Obtiene los datos de configuración del establecimiento.
#[tauri::command]
pub fn obtener_datos_negocio(db: State<'_, DbState>) -> AppResult<Negocio> {
    let conn = db.conn.lock().map_err(|e| {
        AppError::Interno(format!("Error de bloqueo de BD: {}", e))
    })?;
    NegocioRepo::obtener(&conn)
}

/// Guarda los datos de configuración del establecimiento.
#[tauri::command]
pub fn guardar_datos_negocio(
    datos: ActualizarNegocio,
    db: State<'_, DbState>,
    session: State<'_, SessionState>,
) -> AppResult<Negocio> {
    session.exigir(Permiso::ConfiguracionSistema)?;
    let conn = db.conn.lock().map_err(|e| {
        AppError::Interno(format!("Error de bloqueo de BD: {}", e))
    })?;
    NegocioRepo::actualizar(&conn, datos)
}


#[cfg(test)]
mod tests {
    use super::*;
    use rusqlite::Connection;

    #[test]
    fn test_verifactu_config_serializacion() {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(
            "CREATE TABLE negocio (id INTEGER PRIMARY KEY CHECK (id = 1), configuracion TEXT NOT NULL DEFAULT '{}');
             INSERT INTO negocio (id) VALUES (1);"
        ).unwrap();

        // 1. Guardar configuración inicial
        let config_inicial = serde_json::json!({
            "verifactu": {
                "certificado_b64": "dummy_b64_content",
                "password": "secretpassword",
                "entorno": "pruebas"
            }
        });
        conn.execute(
            "UPDATE negocio SET configuracion = ?1 WHERE id = 1",
            [config_inicial.to_string()],
        ).unwrap();

        // 2. Extraer configuración y validar
        let cfg = obtener_config_verifactu_interna(&conn).unwrap().unwrap();
        assert_eq!(cfg.certificado_b64.unwrap(), "dummy_b64_content");
        assert_eq!(cfg.password.unwrap(), "secretpassword");
        assert_eq!(cfg.entorno.unwrap(), "pruebas");
    }

    #[test]
    fn test_negocio_crud() {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(
            "CREATE TABLE negocio (
                id INTEGER PRIMARY KEY CHECK (id = 1),
                nombre TEXT NOT NULL DEFAULT '',
                nif TEXT NOT NULL DEFAULT '',
                direccion TEXT NOT NULL DEFAULT '',
                codigo_postal TEXT NOT NULL DEFAULT '',
                ciudad TEXT NOT NULL DEFAULT '',
                provincia TEXT NOT NULL DEFAULT '',
                telefono TEXT NOT NULL DEFAULT '',
                email TEXT NOT NULL DEFAULT '',
                logo_path TEXT,
                moneda TEXT NOT NULL DEFAULT 'EUR',
                configuracion TEXT NOT NULL DEFAULT '{}',
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
             );
             INSERT INTO negocio (id) VALUES (1);"
        ).unwrap();

        // 1. Obtener inicial
        let n_inicial = NegocioRepo::obtener(&conn).unwrap();
        assert_eq!(n_inicial.nombre, "");
        assert_eq!(n_inicial.moneda, "EUR");

        // 2. Actualizar datos
        let act = ActualizarNegocio {
            nombre: Some("Restaurante Tormel".to_string()),
            nif: Some("B99999999".to_string()),
            direccion: Some("C/ Principal 10".to_string()),
            codigo_postal: Some("28001".to_string()),
            ciudad: Some("Madrid".to_string()),
            provincia: Some("Madrid".to_string()),
            telefono: Some("912345678".to_string()),
            email: Some("contacto@tormel.com".to_string()),
            logo_path: Some("logo.png".to_string()),
            moneda: Some("USD".to_string()),
        };
        let n_act = NegocioRepo::actualizar(&conn, act).unwrap();
        assert_eq!(n_act.nombre, "Restaurante Tormel");
        assert_eq!(n_act.nif, "B99999999");
        assert_eq!(n_act.direccion, "C/ Principal 10");
        assert_eq!(n_act.codigo_postal, "28001");
        assert_eq!(n_act.ciudad, "Madrid");
        assert_eq!(n_act.provincia, "Madrid");
        assert_eq!(n_act.telefono, "912345678");
        assert_eq!(n_act.email, "contacto@tormel.com");
        assert_eq!(n_act.logo_path.unwrap(), "logo.png");
        assert_eq!(n_act.moneda, "USD");
    }
}
