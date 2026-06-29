use tauri::State;
use crate::db::connection::DbState;
use crate::error::{AppError, AppResult};
use crate::models::producto::{ActualizarProducto, NuevoProducto, Producto, Familia};
use crate::repositories::producto_repo::ProductoRepo;

#[tauri::command]
pub fn crear_producto(
    db: State<'_, DbState>,
    nuevo: NuevoProducto,
) -> AppResult<Producto> {
    let conn = db.conn.lock().map_err(|e| AppError::Interno(format!("DB lock error: {}", e)))?;
    ProductoRepo::crear_producto(&conn, &nuevo)
}

#[tauri::command]
pub fn actualizar_producto(
    db: State<'_, DbState>,
    id: i64,
    actualizar: ActualizarProducto,
) -> AppResult<Producto> {
    let conn = db.conn.lock().map_err(|e| AppError::Interno(format!("DB lock error: {}", e)))?;
    ProductoRepo::actualizar_producto(&conn, id, &actualizar)
}

#[tauri::command]
pub fn eliminar_producto(
    db: State<'_, DbState>,
    id: i64,
) -> AppResult<()> {
    let conn = db.conn.lock().map_err(|e| AppError::Interno(format!("DB lock error: {}", e)))?;
    ProductoRepo::eliminar_producto(&conn, id)
}

#[tauri::command]
pub fn crear_familia(
    db: State<'_, DbState>,
    nombre: String,
    color: String,
) -> AppResult<Familia> {
    let conn = db.conn.lock().map_err(|e| AppError::Interno(format!("DB lock error: {}", e)))?;
    ProductoRepo::crear_familia(&conn, &nombre, &color)
}

#[tauri::command]
pub fn eliminar_familia(
    db: State<'_, DbState>,
    id: i64,
) -> AppResult<()> {
    let conn = db.conn.lock().map_err(|e| AppError::Interno(format!("DB lock error: {}", e)))?;
    ProductoRepo::eliminar_familia(&conn, id)
}
