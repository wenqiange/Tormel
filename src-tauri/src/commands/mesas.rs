use tauri::State;

use crate::db::connection::DbState;
use crate::error::{AppError, AppResult};
use crate::models::mesa::{Mesa, Zona};
use crate::models::venta::VentaCompleta;
use crate::repositories::mesa_repo::MesaRepo;
use crate::repositories::venta_repo::VentaRepo;

/// Obtiene todas las zonas activas.
#[tauri::command]
pub fn listar_zonas(db: State<'_, DbState>) -> AppResult<Vec<Zona>> {
    let conn = db.conn.lock().map_err(|e| {
        AppError::Interno(format!("Error de bloqueo de base de datos: {}", e))
    })?;
    MesaRepo::listar_zonas(&conn)
}

/// Obtiene todas las mesas activas.
#[tauri::command]
pub fn listar_mesas(db: State<'_, DbState>) -> AppResult<Vec<Mesa>> {
    let conn = db.conn.lock().map_err(|e| {
        AppError::Interno(format!("Error de bloqueo de base de datos: {}", e))
    })?;
    MesaRepo::listar_mesas(&conn)
}

/// Actualiza las coordenadas de una mesa (Drag and Drop).
#[tauri::command]
pub fn actualizar_posicion_mesa(
    id: i64,
    pos_x: i32,
    pos_y: i32,
    db: State<'_, DbState>,
) -> AppResult<()> {
    let conn = db.conn.lock().map_err(|e| {
        AppError::Interno(format!("Error de bloqueo de base de datos: {}", e))
    })?;
    MesaRepo::actualizar_posicion(&conn, id, pos_x, pos_y)
}

/// Carga la venta o pedido activo de una mesa.
#[tauri::command]
pub fn obtener_venta_activa_mesa(
    mesa_id: i64,
    db: State<'_, DbState>,
) -> AppResult<Option<VentaCompleta>> {
    let conn = db.conn.lock().map_err(|e| {
        AppError::Interno(format!("Error de bloqueo de base de datos: {}", e))
    })?;
    VentaRepo::obtener_activa_por_mesa(&conn, mesa_id)
}

/// Añade un producto al pedido activo de una mesa (crea una venta si no existe).
#[tauri::command]
pub fn agregar_producto_mesa(
    mesa_id: i64,
    usuario_id: i64,
    producto_id: i64,
    cantidad: f64,
    db: State<'_, DbState>,
) -> AppResult<VentaCompleta> {
    let conn = db.conn.lock().map_err(|e| {
        AppError::Interno(format!("Error de bloqueo de base de datos: {}", e))
    })?;

    // Obtener la venta activa o crear una nueva si no existía ninguna
    let venta_id = match VentaRepo::obtener_activa_por_mesa(&conn, mesa_id)? {
        Some(vc) => vc.venta.id,
        None => VentaRepo::crear_venta_abierta(&conn, mesa_id, usuario_id)?,
    };

    // Agregar el producto a la venta
    VentaRepo::agregar_o_actualizar_linea(&conn, venta_id, producto_id, cantidad)?;

    // Devolver la venta completa actualizada
    VentaRepo::obtener_por_id(&conn, venta_id)
}

/// Establece la cantidad exacta de un producto en el pedido de una mesa.
#[tauri::command]
pub fn actualizar_cantidad_producto_mesa(
    mesa_id: i64,
    usuario_id: i64,
    producto_id: i64,
    cantidad: f64,
    db: State<'_, DbState>,
) -> AppResult<Option<VentaCompleta>> {
    let conn = db.conn.lock().map_err(|e| {
        AppError::Interno(format!("Error de bloqueo de base de datos: {}", e))
    })?;

    let venta_id = match VentaRepo::obtener_activa_por_mesa(&conn, mesa_id)? {
        Some(vc) => vc.venta.id,
        None => {
            if cantidad <= 0.0 {
                return Ok(None);
            }
            VentaRepo::crear_venta_abierta(&conn, mesa_id, usuario_id)?
        }
    };

    VentaRepo::actualizar_cantidad_linea(&conn, venta_id, producto_id, cantidad)?;
    let vc = VentaRepo::obtener_por_id(&conn, venta_id)?;
    Ok(Some(vc))
}

/// Elimina una línea de producto del pedido activo de una mesa.
#[tauri::command]
pub fn eliminar_producto_mesa(
    mesa_id: i64,
    producto_id: i64,
    db: State<'_, DbState>,
) -> AppResult<Option<VentaCompleta>> {
    let conn = db.conn.lock().map_err(|e| {
        AppError::Interno(format!("Error de bloqueo de base de datos: {}", e))
    })?;

    if let Some(vc) = VentaRepo::obtener_activa_por_mesa(&conn, mesa_id)? {
        VentaRepo::eliminar_linea(&conn, vc.venta.id, producto_id)?;
        let actualizada = VentaRepo::obtener_por_id(&conn, vc.venta.id)?;
        Ok(Some(actualizada))
    } else {
        Ok(None)
    }
}

/// Cambia el estado de la mesa a 'por_cobrar' (ticket generado/impreso).
#[tauri::command]
pub fn imprimir_ticket_mesa(mesa_id: i64, db: State<'_, DbState>) -> AppResult<()> {
    let conn = db.conn.lock().map_err(|e| {
        AppError::Interno(format!("Error de bloqueo de base de datos: {}", e))
    })?;
    VentaRepo::imprimir_ticket(&conn, mesa_id)
}

/// Cierra el pedido cobrándolo y liberando la mesa.
#[tauri::command]
pub fn cobrar_mesa(
    mesa_id: i64,
    metodo_pago: String,
    importe_entregado: f64,
    db: State<'_, DbState>,
) -> AppResult<String> {
    let conn = db.conn.lock().map_err(|e| {
        AppError::Interno(format!("Error de bloqueo de base de datos: {}", e))
    })?;
    VentaRepo::cobrar_venta(&conn, mesa_id, &metodo_pago, importe_entregado)
}

// ── CRUD Administración ──

#[tauri::command]
pub fn crear_zona(db: State<'_, DbState>, nueva: crate::models::mesa::NuevaZona) -> AppResult<Zona> {
    let conn = db.conn.lock().map_err(|e| AppError::Interno(e.to_string()))?;
    MesaRepo::crear_zona(&conn, &nueva)
}

#[tauri::command]
pub fn eliminar_zona(db: State<'_, DbState>, id: i64) -> AppResult<()> {
    let conn = db.conn.lock().map_err(|e| AppError::Interno(e.to_string()))?;
    MesaRepo::eliminar_zona(&conn, id)
}

#[tauri::command]
pub fn crear_mesa(db: State<'_, DbState>, nueva: crate::models::mesa::NuevaMesa) -> AppResult<Mesa> {
    let conn = db.conn.lock().map_err(|e| AppError::Interno(e.to_string()))?;
    MesaRepo::crear_mesa(&conn, &nueva)
}

#[tauri::command]
pub fn actualizar_config_mesa(
    db: State<'_, DbState>,
    id: i64,
    nombre: Option<String>,
    capacidad: Option<i32>,
    forma: Option<crate::models::common::FormaMesa>,
) -> AppResult<Mesa> {
    let conn = db.conn.lock().map_err(|e| AppError::Interno(e.to_string()))?;
    MesaRepo::actualizar_config_mesa(&conn, id, nombre.as_deref(), capacidad, forma.as_ref())
}

#[tauri::command]
pub fn eliminar_mesa(db: State<'_, DbState>, id: i64) -> AppResult<()> {
    let conn = db.conn.lock().map_err(|e| AppError::Interno(e.to_string()))?;
    MesaRepo::eliminar_mesa(&conn, id)
}
