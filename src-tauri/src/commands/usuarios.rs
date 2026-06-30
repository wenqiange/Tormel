use tauri::State;

use crate::auth::login_guard::LoginGuard;
use crate::auth::permissions::Permiso;
use crate::auth::session::SessionState;
use crate::db::connection::DbState;
use crate::error::{AppError, AppResult};
use crate::models::usuario::{ActualizarUsuario, NuevoUsuario, SesionUsuario, Usuario};
use crate::services::usuario_service::UsuarioService;

/// Autentica un usuario por su ID verificando el PIN.
/// Si tiene éxito, fija la sesión activa en el backend. Aplica un límite de
/// intentos fallidos para mitigar la fuerza bruta sobre el PIN.
#[tauri::command]
pub fn login(
    usuario_id: i64,
    pin: String,
    db: State<'_, DbState>,
    session: State<'_, SessionState>,
    guard: State<'_, LoginGuard>,
) -> AppResult<SesionUsuario> {
    if let Err(segundos) = guard.comprobar(usuario_id) {
        return Err(AppError::DemasiadosIntentos(segundos));
    }

    let resultado = {
        let conn = db.conn.lock().map_err(|e| {
            AppError::Interno(format!("Error de lock: {}", e))
        })?;
        UsuarioService::login(&conn, usuario_id, &pin)
    };

    match resultado {
        Ok(sesion) => {
            guard.registrar_exito(usuario_id);
            session.set(sesion.clone())?;
            Ok(sesion)
        }
        Err(e) => {
            // Solo penalizar los fallos de credenciales, no los errores de sistema.
            if matches!(e, AppError::PinInvalido) {
                guard.registrar_fallo(usuario_id);
            }
            Err(e)
        }
    }
}

/// Cierra la sesión activa del backend.
#[tauri::command]
pub fn logout(session: State<'_, SessionState>) -> AppResult<()> {
    session.clear()
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

/// Crea un nuevo usuario. Requiere permiso de gestión de usuarios (admin).
#[tauri::command]
pub fn crear_usuario(
    datos: NuevoUsuario,
    db: State<'_, DbState>,
    session: State<'_, SessionState>,
) -> AppResult<Usuario> {
    session.exigir(Permiso::UsuarioGestionar)?;
    let conn = db.conn.lock().map_err(|e| {
        crate::error::AppError::Interno(format!("Error de lock: {}", e))
    })?;
    UsuarioService::crear(&conn, datos)
}

/// Actualiza un usuario existente. Requiere permiso de gestión de usuarios (admin).
#[tauri::command]
pub fn actualizar_usuario(
    id: i64,
    datos: ActualizarUsuario,
    db: State<'_, DbState>,
    session: State<'_, SessionState>,
) -> AppResult<Usuario> {
    session.exigir(Permiso::UsuarioGestionar)?;
    let conn = db.conn.lock().map_err(|e| {
        crate::error::AppError::Interno(format!("Error de lock: {}", e))
    })?;
    UsuarioService::actualizar(&conn, id, datos)
}
