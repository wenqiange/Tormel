use rusqlite::Connection;
use log::info;

use crate::error::{AppError, AppResult};

/// Archivo de migración embebido.
struct Migration {
    version: &'static str,
    name: &'static str,
    sql: &'static str,
}

/// Lista de migraciones embebidas en el binario.
/// Se ejecutan en orden secuencial. Cada migración se aplica una sola vez.
const MIGRATIONS: &[Migration] = &[
    Migration {
        version: "001",
        name: "initial_schema",
        sql: include_str!("../../migrations/001_initial_schema.sql"),
    },
    Migration {
        version: "002",
        name: "seed_data",
        sql: include_str!("../../migrations/002_seed_data.sql"),
    },
    Migration {
        version: "003",
        name: "verifactu_schema",
        sql: include_str!("../../migrations/003_verifactu_schema.sql"),
    },
];

/// Ejecuta todas las migraciones pendientes.
/// Las migraciones son forward-only: si una falla, se hace rollback solo de esa migración.
pub fn run_migrations(conn: &Connection) -> AppResult<()> {
    // Asegurar que la tabla _migrations existe (podría no existir si es una DB nueva)
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS _migrations (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            version     TEXT    NOT NULL UNIQUE,
            nombre      TEXT    NOT NULL,
            applied_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%S', 'now', 'localtime'))
        );"
    )?;

    for migration in MIGRATIONS {
        let already_applied: bool = conn.query_row(
            "SELECT COUNT(*) > 0 FROM _migrations WHERE version = ?1",
            [migration.version],
            |row| row.get(0),
        )?;

        if already_applied {
            continue;
        }

        info!("Aplicando migración {}: {}", migration.version, migration.name);

        // Ejecutar la migración completa como batch
        conn.execute_batch(migration.sql).map_err(|e| {
            AppError::Interno(format!(
                "Error al aplicar migración {}: {}",
                migration.version, e
            ))
        })?;

        // Si la migración ya inserta en _migrations, no insertar de nuevo
        let recorded: bool = conn.query_row(
            "SELECT COUNT(*) > 0 FROM _migrations WHERE version = ?1",
            [migration.version],
            |row| row.get(0),
        )?;

        if !recorded {
            conn.execute(
                "INSERT INTO _migrations (version, nombre) VALUES (?1, ?2)",
                rusqlite::params![migration.version, migration.name],
            )?;
        }

        info!("Migración {} aplicada correctamente", migration.version);
    }

    Ok(())
}
