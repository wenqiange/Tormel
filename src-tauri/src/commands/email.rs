use tauri::State;
use lettre::{Message, SmtpTransport, Transport};
use lettre::transport::smtp::authentication::Credentials;
use lettre::message::{header::ContentType, Attachment, MultiPart, SinglePart};
use rusqlite::Connection;
use serde::Deserialize;

use crate::auth::permissions::Permiso;
use crate::auth::session::SessionState;
use crate::db::connection::DbState;
use crate::error::{AppError, AppResult};

#[derive(Deserialize, Debug)]
pub struct SmtpConfig {
    pub server: String,
    pub port: u16,
    pub username: String,
    pub password: String,
}

/// Helper para extraer configuración SMTP del negocio
fn obtener_config_smtp(conn: &Connection) -> AppResult<Option<SmtpConfig>> {
    let config_str: String = conn.query_row(
        "SELECT configuracion FROM negocio WHERE id = 1",
        [],
        |row| row.get(0),
    )?;

    // Parse the JSON. We assume there might be an "smtp" key inside "configuracion"
    #[derive(Deserialize)]
    struct NegocioConfig {
        smtp: Option<SmtpConfig>,
    }

    if let Ok(config) = serde_json::from_str::<NegocioConfig>(&config_str) {
        match config.smtp {
            Some(mut smtp) => {
                // Descifrado transparente de la contraseña SMTP.
                smtp.password = crate::services::secret_store::descifrar(&smtp.password)?;
                Ok(Some(smtp))
            }
            None => Ok(None),
        }
    } else {
        Ok(None)
    }
}

#[tauri::command]
pub fn guardar_config_smtp(
    server: String,
    port: u16,
    username: String,
    password: String,
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

    // La contraseña SMTP se cifra antes de persistirse.
    let password_cifrada = crate::services::secret_store::cifrar(&password)?;
    config["smtp"] = serde_json::json!({
        "server": server,
        "port": port,
        "username": username,
        "password": password_cifrada
    });

    conn.execute(
        "UPDATE negocio SET configuracion = ?1 WHERE id = 1",
        [config.to_string()],
    )?;

    Ok(())
}

#[tauri::command]
pub fn enviar_factura_email(
    to_email: String,
    subject: String,
    body: String,
    pdf_bytes: Vec<u8>,
    filename: String,
    db: State<'_, DbState>,
    session: State<'_, SessionState>,
) -> AppResult<()> {
    session.exigir(Permiso::InformesVer)?;
    // 1. Obtener configuración
    let smtp_config = {
        let conn = db.conn.lock().map_err(|e| {
            AppError::Interno(format!("Error de bloqueo de BD: {}", e))
        })?;
        obtener_config_smtp(&conn)?
    };

    let smtp_config = smtp_config.ok_or_else(|| {
        AppError::Interno(
            "La configuración SMTP no está definida en el negocio. Configúrala primero.".to_string(),
        )
    })?;

    // 3. Crear el mensaje
    let email = Message::builder()
        .from(
            smtp_config
                .username
                .parse()
                .map_err(|_| AppError::Interno("Email del remitente inválido".to_string()))?,
        )
        .to(to_email
            .parse()
            .map_err(|_| AppError::Interno("Email destinatario inválido".to_string()))?)
        .subject(subject)
        .multipart(
            MultiPart::mixed()
                .singlepart(
                    SinglePart::builder()
                        .header(ContentType::TEXT_PLAIN)
                        .body(body),
                )
                .singlepart(
                    Attachment::new(filename)
                        .body(pdf_bytes, ContentType::parse("application/pdf").unwrap()),
                ),
        )
        .map_err(|e| AppError::Interno(format!("Error al construir email: {}", e)))?;

    // 4. Configurar el transporte SMTP según el puerto.
    //    - Puerto 465: TLS implícito (SMTPS) -> relay()
    //    - Puerto 587 / 25: STARTTLS         -> starttls_relay()
    //    Usar relay() (TLS implícito) sobre el 587 falla siempre, que era el bug.
    let creds = Credentials::new(smtp_config.username, smtp_config.password);

    let builder = if smtp_config.port == 465 {
        SmtpTransport::relay(&smtp_config.server)
    } else {
        SmtpTransport::starttls_relay(&smtp_config.server)
    }
    .map_err(|e| AppError::Interno(format!("Error configurando servidor SMTP: {}", e)))?;

    let mailer = builder
        .port(smtp_config.port)
        .credentials(creds)
        .build();

    // 5. Enviar
    mailer
        .send(&email)
        .map_err(|e| AppError::Interno(format!("Error enviando correo: {}", e)))?;

    Ok(())
}
