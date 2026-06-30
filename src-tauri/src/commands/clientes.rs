use tauri::State;
use crate::auth::permissions::Permiso;
use crate::auth::session::SessionState;
use crate::db::connection::DbState;
use crate::error::{AppError, AppResult};
use crate::models::cliente::{ActualizarCliente, Cliente, NuevoCliente};
use crate::repositories::cliente_repo::ClienteRepo;

#[tauri::command]
pub fn listar_clientes(db: State<'_, DbState>) -> AppResult<Vec<Cliente>> {
    let conn = db.conn.lock().map_err(|e| {
        AppError::Interno(format!("Error de bloqueo de base de datos: {}", e))
    })?;
    ClienteRepo::listar(&conn)
}

#[tauri::command]
pub fn obtener_cliente(id: i64, db: State<'_, DbState>) -> AppResult<Cliente> {
    let conn = db.conn.lock().map_err(|e| {
        AppError::Interno(format!("Error de bloqueo de base de datos: {}", e))
    })?;
    ClienteRepo::obtener_por_id(&conn, id)
}

#[tauri::command]
pub fn crear_cliente(
    nuevo: NuevoCliente,
    db: State<'_, DbState>,
    session: State<'_, SessionState>,
) -> AppResult<Cliente> {
    session.exigir(Permiso::ClienteGestionar)?;
    let conn = db.conn.lock().map_err(|e| {
        AppError::Interno(format!("Error de bloqueo de base de datos: {}", e))
    })?;
    ClienteRepo::crear(&conn, &nuevo)
}

#[tauri::command]
pub fn actualizar_cliente(
    id: i64,
    actualizar: ActualizarCliente,
    db: State<'_, DbState>,
    session: State<'_, SessionState>,
) -> AppResult<Cliente> {
    session.exigir(Permiso::ClienteGestionar)?;
    let conn = db.conn.lock().map_err(|e| {
        AppError::Interno(format!("Error de bloqueo de base de datos: {}", e))
    })?;
    ClienteRepo::actualizar(&conn, id, &actualizar)
}

#[tauri::command]
pub fn eliminar_cliente(id: i64, db: State<'_, DbState>, session: State<'_, SessionState>) -> AppResult<()> {
    session.exigir(Permiso::ClienteGestionar)?;
    let conn = db.conn.lock().map_err(|e| {
        AppError::Interno(format!("Error de bloqueo de base de datos: {}", e))
    })?;
    ClienteRepo::eliminar(&conn, id)
}
