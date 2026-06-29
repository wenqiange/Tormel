use rusqlite::{params, Connection};

use crate::error::{AppError, AppResult};
use crate::models::ticket::{Ticket, TicketLinea};
use crate::models::venta::VentaCompleta;

/// Repositorio del historial de tickets — acceso a datos en SQLite.
pub struct TicketRepo;

impl TicketRepo {
    /// Registra un ticket en el historial a partir de una venta.
    ///
    /// `tipo` debe ser `"pre_cuenta"` o `"fiscal"`. Para tickets fiscales se
    /// proporcionan además `numero`, `metodo_pago` y `qr_data`.
    pub fn registrar_desde_venta(
        conn: &Connection,
        venta: &VentaCompleta,
        tipo: &str,
        numero: Option<&str>,
        metodo_pago: Option<&str>,
        qr_data: Option<&str>,
    ) -> AppResult<i64> {
        let lineas: Vec<TicketLinea> = venta
            .lineas
            .iter()
            .map(|l| {
                let precio_unitario = if l.cantidad != 0.0 {
                    l.total / l.cantidad
                } else {
                    l.total
                };
                TicketLinea {
                    producto_nombre: l.producto_nombre.clone(),
                    cantidad: l.cantidad,
                    precio_unitario,
                    total: l.total,
                }
            })
            .collect();

        let contenido_json = serde_json::to_string(&lineas)?;

        conn.execute(
            "INSERT INTO ticket
                (venta_id, tipo, numero, mesa_nombre, usuario_nombre, metodo_pago,
                 comensales, subtotal, total_iva, total, qr_data, contenido_json)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)",
            params![
                venta.venta.id,
                tipo,
                numero,
                venta.nombre_mesa,
                venta.nombre_usuario,
                metodo_pago,
                venta.venta.comensales,
                venta.venta.subtotal,
                venta.venta.total_iva,
                venta.venta.total,
                qr_data,
                contenido_json,
            ],
        )?;

        Ok(conn.last_insert_rowid())
    }

    /// Lista todos los tickets del historial, del más reciente al más antiguo.
    pub fn listar(conn: &Connection) -> AppResult<Vec<Ticket>> {
        let mut stmt = conn.prepare(
            "SELECT id, venta_id, tipo, numero, mesa_nombre, usuario_nombre, metodo_pago,
                    comensales, subtotal, total_iva, total, qr_data, contenido_json, created_at
             FROM ticket
             ORDER BY id DESC",
        )?;

        let tickets = stmt
            .query_map([], Self::map_ticket)?
            .collect::<Result<Vec<_>, _>>()?;

        Ok(tickets)
    }

    /// Obtiene un ticket concreto por su ID.
    pub fn obtener_por_id(conn: &Connection, id: i64) -> AppResult<Ticket> {
        conn.query_row(
            "SELECT id, venta_id, tipo, numero, mesa_nombre, usuario_nombre, metodo_pago,
                    comensales, subtotal, total_iva, total, qr_data, contenido_json, created_at
             FROM ticket WHERE id = ?1",
            [id],
            Self::map_ticket,
        )
        .map_err(|_| AppError::NoEncontrado(format!("Ticket con ID {} no existe", id)))
    }

    /// Mapea una fila SQL a un `Ticket`, deserializando las líneas del JSON.
    fn map_ticket(row: &rusqlite::Row) -> rusqlite::Result<Ticket> {
        let contenido_json: String = row.get(12)?;
        let lineas: Vec<TicketLinea> = serde_json::from_str(&contenido_json).unwrap_or_default();

        Ok(Ticket {
            id: row.get(0)?,
            venta_id: row.get(1)?,
            tipo: row.get(2)?,
            numero: row.get(3)?,
            mesa_nombre: row.get(4)?,
            usuario_nombre: row.get(5)?,
            metodo_pago: row.get(6)?,
            comensales: row.get(7)?,
            subtotal: row.get(8)?,
            total_iva: row.get(9)?,
            total: row.get(10)?,
            qr_data: row.get(11)?,
            lineas,
            created_at: row.get(13)?,
        })
    }
}
