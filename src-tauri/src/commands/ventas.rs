use tauri::State;

use crate::db::connection::DbState;
use crate::error::{AppError, AppResult};
use crate::models::producto::{Familia, Producto};
use crate::models::venta::VentaCompleta;
use crate::repositories::producto_repo::ProductoRepo;
use crate::repositories::venta_repo::VentaRepo;

/// Obtiene todas las familias de productos activas.
#[tauri::command]
pub fn listar_familias(db: State<'_, DbState>) -> AppResult<Vec<Familia>> {
    let conn = db.conn.lock().map_err(|e| {
        AppError::Interno(format!("Error de bloqueo de base de datos: {}", e))
    })?;
    ProductoRepo::listar_familias(&conn)
}

/// Obtiene todos los productos activos.
#[tauri::command]
pub fn listar_productos(db: State<'_, DbState>) -> AppResult<Vec<Producto>> {
    let conn = db.conn.lock().map_err(|e| {
        AppError::Interno(format!("Error de bloqueo de base de datos: {}", e))
    })?;
    ProductoRepo::listar_productos(&conn)
}

/// Obtiene la lista de facturación/ventas cobradas durante el día.
#[tauri::command]
pub fn obtener_ventas_diarias(db: State<'_, DbState>) -> AppResult<Vec<VentaCompleta>> {
    let conn = db.conn.lock().map_err(|e| {
        AppError::Interno(format!("Error de bloqueo de base de datos: {}", e))
    })?;
    VentaRepo::listar_ventas_diarias(&conn)
}
