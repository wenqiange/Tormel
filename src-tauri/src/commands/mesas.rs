use tauri::{State, Manager, AppHandle};

use crate::auth::permissions::Permiso;
use crate::auth::session::SessionState;
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
    producto_id: i64,
    cantidad: f64,
    precio_personalizado: Option<i64>,
    db: State<'_, DbState>,
    session: State<'_, SessionState>,
) -> AppResult<VentaCompleta> {
    // La identidad del operador se toma de la sesión del backend, nunca del
    // cliente, para que las ventas no puedan atribuirse a otro usuario.
    let sesion = session.exigir(Permiso::VentaCrear)?;
    let usuario_id = sesion.usuario_id;

    let conn = db.conn.lock().map_err(|e| {
        AppError::Interno(format!("Error de bloqueo de base de datos: {}", e))
    })?;

    // Obtener la venta activa o crear una nueva si no existía ninguna
    let venta_id = match VentaRepo::obtener_activa_por_mesa(&conn, mesa_id)? {
        Some(vc) => vc.venta.id,
        None => VentaRepo::crear_venta_abierta(&conn, mesa_id, usuario_id)?,
    };

    // Agregar el producto a la venta
    VentaRepo::agregar_o_actualizar_linea(&conn, venta_id, producto_id, cantidad, precio_personalizado)?;

    // Devolver la venta completa actualizada
    VentaRepo::obtener_por_id(&conn, venta_id)
}

#[tauri::command]
pub fn agregar_producto_mesa_con_modificadores(
    mesa_id: i64,
    producto_id: i64,
    cantidad: f64,
    modificadores: Vec<i64>,
    db: State<'_, DbState>,
    session: State<'_, SessionState>,
) -> AppResult<VentaCompleta> {
    let sesion = session.exigir(Permiso::VentaCrear)?;
    let usuario_id = sesion.usuario_id;

    let conn = db.conn.lock().map_err(|e| {
        AppError::Interno(format!("Error de bloqueo de base de datos: {}", e))
    })?;

    // Toda la inserción de la línea con sus modificadores y el recálculo de
    // totales debe ser atómica para no dejar líneas a medio crear.
    let tx = conn.unchecked_transaction()?;

    // 1. Obtener la venta activa o crear una nueva
    let venta_id = match VentaRepo::obtener_activa_por_mesa(&tx, mesa_id)? {
        Some(vc) => vc.venta.id,
        None => VentaRepo::crear_venta_abierta(&tx, mesa_id, usuario_id)?,
    };

    // 2. Cargar datos del producto
    let producto = crate::repositories::producto_repo::ProductoRepo::obtener_por_id(&tx, producto_id)?;

    // 3. Crear una nueva línea de venta independiente (ya que los modificadores la hacen única)
    tx.execute(
        "INSERT INTO linea_venta (venta_id, producto_id, producto_nombre, producto_precio, tipo_iva, cantidad, descuento_pct, subtotal, importe_iva, total)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, 0.0, 0, 0, 0)",
        rusqlite::params![venta_id, producto_id, producto.nombre, producto.precio, producto.tipo_iva, cantidad],
    )?;
    
    let linea_id = tx.last_insert_rowid();

    // 4. Cargar e insertar cada modificador seleccionado (suplementos en céntimos)
    let mut extra_total: i64 = 0;
    for mod_id in modificadores {
        let (nombre_mod, precio_extra): (String, i64) = tx.query_row(
            "SELECT nombre, precio_extra FROM modificador WHERE id = ?1",
            [mod_id],
            |row| Ok((row.get(0)?, row.get(1)?))
        )?;
        
        tx.execute(
            "INSERT INTO linea_modificador (linea_venta_id, modificador_id, nombre, precio_extra)
             VALUES (?1, ?2, ?3, ?4)",
            rusqlite::params![linea_id, mod_id, nombre_mod, precio_extra],
        )?;
        
        extra_total += precio_extra;
    }

    // 5. Recalcular los totales de la línea: el PVP bruto unitario es el del
    //    producto más los suplementos de los modificadores.
    let iva_pct = crate::dinero::iva_pct_entero(producto.tipo_iva);
    let pvp_final = producto.precio + extra_total;
    let (subtotal, importe_iva, total) = crate::dinero::desglose_linea(pvp_final, cantidad, iva_pct);

    tx.execute(
        "UPDATE linea_venta SET producto_precio = ?1, subtotal = ?2, importe_iva = ?3, total = ?4 WHERE id = ?5",
        rusqlite::params![pvp_final, subtotal, importe_iva, total, linea_id],
    )?;

    // 6. Recalcular los totales acumulados de la venta completa
    VentaRepo::actualizar_totales(&tx, venta_id)?;
    VentaRepo::actualizar_estado_mesa_por_venta(&tx, venta_id)?;

    tx.commit()?;

    // 7. Devolver la venta completa actualizada
    VentaRepo::obtener_por_id(&conn, venta_id)
}


/// Establece la cantidad exacta de un producto en el pedido de una mesa.
#[tauri::command]
pub fn actualizar_cantidad_producto_mesa(
    mesa_id: i64,
    producto_id: i64,
    cantidad: f64,
    db: State<'_, DbState>,
    session: State<'_, SessionState>,
) -> AppResult<Option<VentaCompleta>> {
    let sesion = session.exigir(Permiso::VentaCrear)?;
    let usuario_id = sesion.usuario_id;

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

/// Cambia el precio de un producto en el pedido actual.
#[tauri::command]
pub fn actualizar_precio_producto_mesa(
    mesa_id: i64,
    producto_id: i64,
    nuevo_precio: i64,
    db: State<'_, DbState>,
    session: State<'_, SessionState>,
) -> AppResult<Option<VentaCompleta>> {
    // Cambiar el precio de una línea equivale a aplicar un descuento/recargo:
    // restringido a admin y encargado.
    session.exigir(Permiso::VentaDescuento)?;

    let conn = db.conn.lock().map_err(|e| {
        AppError::Interno(format!("Error de bloqueo de base de datos: {}", e))
    })?;

    let venta_id = match VentaRepo::obtener_activa_por_mesa(&conn, mesa_id)? {
        Some(vc) => vc.venta.id,
        None => return Ok(None)
    };

    VentaRepo::actualizar_precio_linea(&conn, venta_id, producto_id, nuevo_precio)?;
    let vc = VentaRepo::obtener_por_id(&conn, venta_id)?;
    Ok(Some(vc))
}

/// Elimina una línea de producto del pedido activo de una mesa.
#[tauri::command]
pub fn eliminar_producto_mesa(
    mesa_id: i64,
    producto_id: i64,
    db: State<'_, DbState>,
    session: State<'_, SessionState>,
) -> AppResult<Option<VentaCompleta>> {
    session.exigir(Permiso::VentaCrear)?;
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
pub fn imprimir_ticket_mesa(
    mesa_id: i64,
    app: AppHandle,
    db: State<'_, DbState>,
) -> AppResult<()> {
    let conn = db.conn.lock().map_err(|e| {
        AppError::Interno(format!("Error de bloqueo de base de datos: {}", e))
    })?;

    // 1. Obtener la venta activa
    let venta_activa = VentaRepo::obtener_activa_por_mesa(&conn, mesa_id)?
        .ok_or_else(|| AppError::Validation("No hay consumos activos en esta mesa para generar ticket".into()))?;

    let venta_id = venta_activa.venta.id;

    // 2. Obtener datos del negocio
    let negocio = crate::repositories::negocio_repo::NegocioRepo::obtener(&conn)?;

    // 3. Generar el ticket en texto plano
    let ticket_txt = crate::services::impresion::escpos_builder::generar_ticket_texto(&negocio, &venta_activa);

    // 4. Escribir a un archivo de emulación en el directorio de la aplicación
    let app_data = app.path().app_data_dir().map_err(|e| AppError::Interno(e.to_string()))?;
    let path_ticket = app_data.join("impresion_simulada.txt");
    std::fs::write(&path_ticket, &ticket_txt).map_err(|e| AppError::Interno(e.to_string()))?;
    log::info!("Simulación de Impresión Térmica ESC/POS guardada en: {:?}", path_ticket);

    // 5. Proceder a guardar en BBDD y actualizar estado de la mesa
    VentaRepo::imprimir_ticket(&conn, venta_id)
}

/// Cierra el pedido cobrándolo y liberando la mesa.
#[tauri::command]
pub fn cobrar_mesa(
    mesa_id: i64,
    metodo_pago: String,
    importe_entregado: i64,
    app: AppHandle,
    db: State<'_, DbState>,
    session: State<'_, SessionState>,
) -> AppResult<String> {
    session.exigir(Permiso::VentaCobrar)?;

    let conn = db.conn.lock().map_err(|e| {
        AppError::Interno(format!("Error de bloqueo de base de datos: {}", e))
    })?;

    // Obtener la venta antes de cerrarla para imprimir
    let venta_activa = VentaRepo::obtener_activa_por_mesa(&conn, mesa_id)?
        .ok_or_else(|| AppError::Validation("No hay consumos activos en esta mesa para cobrar".into()))?;

    let venta_id = venta_activa.venta.id;

    // Cobrar la venta (genera ticket y cierra)
    let n_ticket = VentaRepo::cobrar_venta(&conn, venta_id, &metodo_pago, importe_entregado)?;

    // Cargar los datos actualizados con el número de ticket y huella fiscal
    let venta_cerrada = VentaRepo::obtener_por_id(&conn, venta_id)?;
    let negocio = crate::repositories::negocio_repo::NegocioRepo::obtener(&conn)?;

    // Generar e imprimir ticket final
    let ticket_txt = crate::services::impresion::escpos_builder::generar_ticket_texto(&negocio, &venta_cerrada);
    if let Ok(app_data) = app.path().app_data_dir() {
        let path_ticket = app_data.join("impresion_simulada.txt");
        let _ = std::fs::write(&path_ticket, &ticket_txt);
        log::info!("Simulación de Impresión de Factura Simplificada guardada en: {:?}", path_ticket);
    }

    Ok(n_ticket)
}

#[tauri::command]
pub fn traspasar_comanda(
    mesa_origen_id: i64,
    mesa_destino_id: i64,
    db: State<'_, DbState>,
    session: State<'_, SessionState>,
) -> AppResult<()> {
    session.exigir(Permiso::VentaCrear)?;
    let conn = db.conn.lock().map_err(|e| {
        AppError::Interno(format!("Error de bloqueo de base de datos: {}", e))
    })?;
    VentaRepo::traspasar_comanda(&conn, mesa_origen_id, mesa_destino_id)
}

#[tauri::command]
pub fn obtener_ventas_activas_mesa(
    mesa_id: i64,
    db: State<'_, DbState>,
) -> AppResult<Vec<VentaCompleta>> {
    let conn = db.conn.lock().map_err(|e| {
        AppError::Interno(format!("Error de bloqueo de base de datos: {}", e))
    })?;
    VentaRepo::obtener_activas_por_mesa(&conn, mesa_id)
}

#[tauri::command]
pub fn crear_division_cuenta(
    mesa_id: i64,
    db: State<'_, DbState>,
    session: State<'_, SessionState>,
) -> AppResult<VentaCompleta> {
    let sesion = session.exigir(Permiso::VentaCrear)?;
    let conn = db.conn.lock().map_err(|e| {
        AppError::Interno(format!("Error de bloqueo de base de datos: {}", e))
    })?;
    let venta_id = VentaRepo::crear_venta_abierta(&conn, mesa_id, sesion.usuario_id)?;
    VentaRepo::obtener_por_id(&conn, venta_id)
}

#[tauri::command]
pub fn mover_linea_comanda(
    linea_id: i64,
    venta_destino_id: i64,
    cantidad: f64,
    db: State<'_, DbState>,
    session: State<'_, SessionState>,
) -> AppResult<()> {
    session.exigir(Permiso::VentaCrear)?;
    let conn = db.conn.lock().map_err(|e| {
        AppError::Interno(format!("Error de bloqueo de base de datos: {}", e))
    })?;
    VentaRepo::mover_linea_comanda(&conn, linea_id, venta_destino_id, cantidad)
}

#[tauri::command]
pub fn cobrar_venta(
    venta_id: i64,
    metodo_pago: String,
    importe_entregado: i64,
    app: AppHandle,
    db: State<'_, DbState>,
    session: State<'_, SessionState>,
) -> AppResult<String> {
    session.exigir(Permiso::VentaCobrar)?;

    let conn = db.conn.lock().map_err(|e| {
        AppError::Interno(format!("Error de bloqueo de base de datos: {}", e))
    })?;

    // Cobrar la venta
    let n_ticket = VentaRepo::cobrar_venta(&conn, venta_id, &metodo_pago, importe_entregado)?;

    // Cargar los datos actualizados con el número de ticket y huella fiscal
    let venta_cerrada = VentaRepo::obtener_por_id(&conn, venta_id)?;
    let negocio = crate::repositories::negocio_repo::NegocioRepo::obtener(&conn)?;

    // Generar e imprimir ticket final
    let ticket_txt = crate::services::impresion::escpos_builder::generar_ticket_texto(&negocio, &venta_cerrada);
    if let Ok(app_data) = app.path().app_data_dir() {
        let path_ticket = app_data.join("impresion_simulada.txt");
        let _ = std::fs::write(&path_ticket, &ticket_txt);
        log::info!("Simulación de Impresión de Factura Simplificada guardada en: {:?}", path_ticket);
    }

    Ok(n_ticket)
}

#[tauri::command]
pub fn imprimir_ticket_venta(
    venta_id: i64,
    app: AppHandle,
    db: State<'_, DbState>,
) -> AppResult<()> {
    let conn = db.conn.lock().map_err(|e| {
        AppError::Interno(format!("Error de bloqueo de base de datos: {}", e))
    })?;

    let venta_activa = VentaRepo::obtener_por_id(&conn, venta_id)?;
    let negocio = crate::repositories::negocio_repo::NegocioRepo::obtener(&conn)?;

    let ticket_txt = crate::services::impresion::escpos_builder::generar_ticket_texto(&negocio, &venta_activa);
    let app_data = app.path().app_data_dir().map_err(|e| AppError::Interno(e.to_string()))?;
    let path_ticket = app_data.join("impresion_simulada.txt");
    std::fs::write(&path_ticket, &ticket_txt).map_err(|e| AppError::Interno(e.to_string()))?;
    log::info!("Simulación de Impresión Térmica ESC/POS guardada en: {:?}", path_ticket);

    VentaRepo::imprimir_ticket(&conn, venta_id)
}

#[tauri::command]
pub fn eliminar_venta_vacia(
    venta_id: i64,
    db: State<'_, DbState>,
) -> AppResult<()> {
    let conn = db.conn.lock().map_err(|e| {
        AppError::Interno(format!("Error de bloqueo de base de datos: {}", e))
    })?;

    let count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM linea_venta WHERE venta_id = ?1",
        [venta_id],
        |row| row.get(0)
    )?;

    if count == 0 {
        conn.execute("DELETE FROM venta WHERE id = ?1", [venta_id])?;
    }

    Ok(())
}

// ── CRUD Administración ──

#[tauri::command]
pub fn crear_zona(
    db: State<'_, DbState>,
    session: State<'_, SessionState>,
    nueva: crate::models::mesa::NuevaZona,
) -> AppResult<Zona> {
    session.exigir(Permiso::ConfiguracionSistema)?;
    let conn = db.conn.lock().map_err(|e| AppError::Interno(e.to_string()))?;
    MesaRepo::crear_zona(&conn, &nueva)
}

#[tauri::command]
pub fn eliminar_zona(db: State<'_, DbState>, session: State<'_, SessionState>, id: i64) -> AppResult<()> {
    session.exigir(Permiso::ConfiguracionSistema)?;
    let conn = db.conn.lock().map_err(|e| AppError::Interno(e.to_string()))?;
    MesaRepo::eliminar_zona(&conn, id)
}

#[tauri::command]
pub fn crear_mesa(
    db: State<'_, DbState>,
    session: State<'_, SessionState>,
    nueva: crate::models::mesa::NuevaMesa,
) -> AppResult<Mesa> {
    session.exigir(Permiso::ConfiguracionSistema)?;
    let conn = db.conn.lock().map_err(|e| AppError::Interno(e.to_string()))?;
    MesaRepo::crear_mesa(&conn, &nueva)
}

#[tauri::command]
pub fn actualizar_config_mesa(
    db: State<'_, DbState>,
    session: State<'_, SessionState>,
    id: i64,
    nombre: Option<String>,
    capacidad: Option<i32>,
    forma: Option<crate::models::common::FormaMesa>,
) -> AppResult<Mesa> {
    session.exigir(Permiso::ConfiguracionSistema)?;
    let conn = db.conn.lock().map_err(|e| AppError::Interno(e.to_string()))?;
    MesaRepo::actualizar_config_mesa(&conn, id, nombre.as_deref(), capacidad, forma.as_ref())
}

#[tauri::command]
pub fn eliminar_mesa(db: State<'_, DbState>, session: State<'_, SessionState>, id: i64) -> AppResult<()> {
    session.exigir(Permiso::ConfiguracionSistema)?;
    let conn = db.conn.lock().map_err(|e| AppError::Interno(e.to_string()))?;
    MesaRepo::eliminar_mesa(&conn, id)
}
