mod auth;
mod commands;
mod db;
mod error;
mod models;
mod repositories;
mod services;

use db::connection::DbState;
use db::migrator;
use log::info;
use tauri::Manager;

/// Punto de entrada de la aplicación Tauri.
/// Inicializa la base de datos, ejecuta migraciones y registra todos los commands.
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Inicializar logging
    env_logger::init();

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            info!("Iniciando Tormel POS...");

            // Determinar ruta de la base de datos
            let app_data = app
                .path()
                .app_data_dir()
                .expect("No se pudo obtener el directorio de datos");
            let db_path = app_data.join("negocio.db");

            info!("Base de datos: {:?}", db_path);

            // Inicializar conexión SQLite
            let db_state = DbState::new(&db_path)
                .expect("No se pudo inicializar la base de datos");

            // Ejecutar migraciones
            {
                let conn = db_state.conn.lock().unwrap();
                migrator::run_migrations(&conn)
                    .expect("Error al ejecutar migraciones");
            }

            info!("Base de datos inicializada correctamente");

            // Registrar estado de la DB para acceso desde commands
            app.manage(db_state);

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // Usuarios
            commands::usuarios::login,
            commands::usuarios::es_primera_ejecucion,
            commands::usuarios::crear_admin_inicial,
            commands::usuarios::listar_usuarios,
            commands::usuarios::obtener_usuario,
            commands::usuarios::crear_usuario,
            commands::usuarios::actualizar_usuario,

            // Mesas
            commands::mesas::listar_zonas,
            commands::mesas::listar_mesas,
            commands::mesas::actualizar_posicion_mesa,
            commands::mesas::obtener_venta_activa_mesa,
            commands::mesas::agregar_producto_mesa,
            commands::mesas::actualizar_cantidad_producto_mesa,
            commands::mesas::actualizar_precio_producto_mesa,
            commands::mesas::eliminar_producto_mesa,
            commands::mesas::imprimir_ticket_mesa,
            commands::mesas::cobrar_mesa,

            // Ventas
            commands::ventas::listar_familias,
            commands::ventas::listar_productos,
            commands::ventas::obtener_ventas_diarias,

            // Tickets (historial)
            commands::tickets::listar_tickets,
            commands::tickets::obtener_ticket,

            // Mesas Admin
            commands::mesas::crear_zona,
            commands::mesas::eliminar_zona,
            commands::mesas::crear_mesa,
            commands::mesas::actualizar_config_mesa,
            commands::mesas::eliminar_mesa,

            // Caja
            commands::caja::obtener_turno_activo,
            commands::caja::abrir_turno,
            commands::caja::cerrar_turno,
            commands::caja::registrar_movimiento_caja,
            commands::caja::obtener_movimientos_turno,
            commands::caja::obtener_resumen_cierre,

            // Admin Catálogo
            commands::productos::crear_producto,
            commands::productos::actualizar_producto,
            commands::productos::eliminar_producto,
            commands::productos::crear_familia,
            commands::productos::eliminar_familia,

            // Clientes
            commands::clientes::listar_clientes,
            commands::clientes::obtener_cliente,
            commands::clientes::crear_cliente,
            commands::clientes::actualizar_cliente,
            commands::clientes::eliminar_cliente,

            // Sistema de Archivos
            commands::fs_commands::guardar_imagen_b64,
            commands::fs_commands::obtener_imagen_b64,

            // Email
            commands::email::enviar_factura_email,
            commands::email::guardar_config_smtp,
        ])
        .run(tauri::generate_context!())
        .expect("Error al ejecutar Tormel POS");
}
