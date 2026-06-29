use tauri::State;

use crate::db::connection::DbState;
use crate::error::{AppError, AppResult};
use crate::models::ticket::Ticket;
use crate::repositories::ticket_repo::TicketRepo;

/// Lista el historial completo de tickets generados (pre-cuentas y fiscales).
#[tauri::command]
pub fn listar_tickets(db: State<'_, DbState>) -> AppResult<Vec<Ticket>> {
    let conn = db.conn.lock().map_err(|e| {
        AppError::Interno(format!("Error de bloqueo de base de datos: {}", e))
    })?;
    TicketRepo::listar(&conn)
}

/// Obtiene un ticket concreto del historial por su ID.
#[tauri::command]
pub fn obtener_ticket(id: i64, db: State<'_, DbState>) -> AppResult<Ticket> {
    let conn = db.conn.lock().map_err(|e| {
        AppError::Interno(format!("Error de bloqueo de base de datos: {}", e))
    })?;
    TicketRepo::obtener_por_id(&conn, id)
}
