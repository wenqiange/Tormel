use rusqlite::{params, Connection};

use crate::error::AppResult;

/// Repositorio de eventos del sistema — log de auditoría inmutable.
pub struct EventoRepo;

impl EventoRepo {
    /// Registra un evento en el log de auditoría.
    pub fn registrar(
        conn: &Connection,
        usuario_id: Option<i64>,
        tipo: &str,
        entidad: &str,
        entidad_id: Option<i64>,
        detalle: Option<&str>,
    ) -> AppResult<()> {
        conn.execute(
            "INSERT INTO evento_sistema (usuario_id, tipo, entidad, entidad_id, detalle)
             VALUES (?1, ?2, ?3, ?4, ?5)",
            params![usuario_id, tipo, entidad, entidad_id, detalle],
        )?;
        Ok(())
    }

    /// Lista los últimos N eventos del sistema.
    pub fn listar_ultimos(conn: &Connection, limite: i64) -> AppResult<Vec<EventoSistema>> {
        let mut stmt = conn.prepare(
            "SELECT e.id, e.usuario_id, u.nombre, e.tipo, e.entidad, e.entidad_id, e.detalle, e.created_at
             FROM evento_sistema e
             LEFT JOIN usuario u ON e.usuario_id = u.id
             ORDER BY e.id DESC
             LIMIT ?1"
        )?;

        let eventos = stmt
            .query_map([limite], |row| {
                Ok(EventoSistema {
                    id: row.get(0)?,
                    usuario_id: row.get(1)?,
                    nombre_usuario: row.get(2)?,
                    tipo: row.get(3)?,
                    entidad: row.get(4)?,
                    entidad_id: row.get(5)?,
                    detalle: row.get(6)?,
                    created_at: row.get(7)?,
                })
            })?
            .collect::<Result<Vec<_>, _>>()?;

        Ok(eventos)
    }
}

/// Evento del sistema para la UI.
#[derive(Debug, Clone, serde::Serialize)]
pub struct EventoSistema {
    pub id: i64,
    pub usuario_id: Option<i64>,
    pub nombre_usuario: Option<String>,
    pub tipo: String,
    pub entidad: String,
    pub entidad_id: Option<i64>,
    pub detalle: Option<String>,
    pub created_at: String,
}
