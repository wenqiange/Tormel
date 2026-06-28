use tauri::State;

use crate::db::connection::DbState;
use crate::error::AppResult;
use crate::models::usuario::{ActualizarUsuario, NuevoUsuario, SesionUsuario, Usuario};
use crate::services::usuario_service::UsuarioService;

/// Autentica un usuario directamente por su ID.
#[tauri::command]
pub fn login(usuario_id: i64, db: State<'_, DbState>) -> AppResult<SesionUsuario> {
    let conn = db.conn.lock().map_err(|e| {
        crate::error::AppError::Interno(format!("Error de lock: {}", e))
    })?;
    UsuarioService::login(&conn, usuario_id)
}

/// Verifica si es la primera ejecución (no hay usuarios).
#[tauri::command]
pub fn es_primera_ejecucion(db: State<'_, DbState>) -> AppResult<bool> {
    let conn = db.conn.lock().map_err(|e| {
        crate::error::AppError::Interno(format!("Error de lock: {}", e))
    })?;
    UsuarioService::es_primera_ejecucion(&conn)
}

/// Crea el usuario admin inicial (primera ejecución).
#[tauri::command]
pub fn crear_admin_inicial(
    nombre: String,
    db: State<'_, DbState>,
) -> AppResult<Usuario> {
    let conn = db.conn.lock().map_err(|e| {
        crate::error::AppError::Interno(format!("Error de lock: {}", e))
    })?;
    UsuarioService::crear_admin_inicial(&conn, &nombre)
}

/// Lista todos los usuarios.
#[tauri::command]
pub fn listar_usuarios(
    solo_activos: Option<bool>,
    db: State<'_, DbState>,
) -> AppResult<Vec<Usuario>> {
    let conn = db.conn.lock().map_err(|e| {
        crate::error::AppError::Interno(format!("Error de lock: {}", e))
    })?;
    UsuarioService::listar(&conn, solo_activos.unwrap_or(true))
}

/// Obtiene un usuario por ID.
#[tauri::command]
pub fn obtener_usuario(id: i64, db: State<'_, DbState>) -> AppResult<Usuario> {
    let conn = db.conn.lock().map_err(|e| {
        crate::error::AppError::Interno(format!("Error de lock: {}", e))
    })?;
    UsuarioService::obtener(&conn, id)
}

/// Crea un nuevo usuario.
#[tauri::command]
pub fn crear_usuario(datos: NuevoUsuario, db: State<'_, DbState>) -> AppResult<Usuario> {
    let conn = db.conn.lock().map_err(|e| {
        crate::error::AppError::Interno(format!("Error de lock: {}", e))
    })?;
    UsuarioService::crear(&conn, datos)
}

/// Actualiza un usuario existente.
#[tauri::command]
pub fn actualizar_usuario(
    id: i64,
    datos: ActualizarUsuario,
    db: State<'_, DbState>,
) -> AppResult<Usuario> {
    let conn = db.conn.lock().map_err(|e| {
        crate::error::AppError::Interno(format!("Error de lock: {}", e))
    })?;
    UsuarioService::actualizar(&conn, id, datos)
}
