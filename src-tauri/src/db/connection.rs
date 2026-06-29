use rusqlite::Connection;
use std::path::Path;
use std::sync::Mutex;

use crate::error::{AppError, AppResult};

/// Estado compartido de la base de datos.
/// Usa Mutex porque rusqlite::Connection no es Send+Sync.
/// En un POS monousuario esto es perfectamente suficiente.
pub struct DbState {
    pub conn: std::sync::Arc<Mutex<Connection>>,
}

impl DbState {
    /// Inicializa la conexión a la base de datos SQLite.
    /// Crea el archivo si no existe. Configura WAL, foreign keys y pragmas de rendimiento.
    pub fn new(db_path: &Path) -> AppResult<Self> {
        // Asegurar que el directorio padre existe
        if let Some(parent) = db_path.parent() {
            std::fs::create_dir_all(parent).map_err(|e| {
                AppError::Interno(format!("No se pudo crear el directorio de datos: {}", e))
            })?;
        }

        let conn = Connection::open(db_path).map_err(|e| {
            AppError::Interno(format!("No se pudo abrir la base de datos: {}", e))
        })?;

        // Configurar pragmas para rendimiento y seguridad
        Self::configure_pragmas(&conn)?;

        Ok(Self {
            conn: std::sync::Arc::new(Mutex::new(conn)),
        })
    }

    /// Configura los pragmas de SQLite para rendimiento óptimo en un POS.
    fn configure_pragmas(conn: &Connection) -> AppResult<()> {
        // WAL mode: permite lecturas concurrentes con escrituras
        conn.pragma_update(None, "journal_mode", "WAL")?;

        // Foreign keys: obligatorio para integridad referencial
        conn.pragma_update(None, "foreign_keys", "ON")?;

        // Busy timeout: esperar 5s si hay lock (evita errores por escritura concurrente)
        conn.pragma_update(None, "busy_timeout", 5000)?;

        // Synchronous NORMAL: buen balance entre rendimiento y durabilidad con WAL
        conn.pragma_update(None, "synchronous", "NORMAL")?;

        // Cache size: 64MB en memoria para queries rápidas
        conn.pragma_update(None, "cache_size", -64000)?;

        // Temp store en memoria
        conn.pragma_update(None, "temp_store", "MEMORY")?;

        // Mmap: mapear hasta 256MB del archivo en memoria para lecturas rápidas
        conn.pragma_update(None, "mmap_size", 268435456)?;

        Ok(())
    }

}

