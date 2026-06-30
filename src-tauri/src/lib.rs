mod auth;
mod commands;
mod db;
mod dinero;
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

                // Garantizar que todo usuario sin PIN (p. ej. el administrador
                // sembrado) reciba el PIN por defecto 111111.
                services::usuario_service::UsuarioService::asegurar_pins_por_defecto(&conn)
                    .expect("Error al inicializar los PIN por defecto");

                // Sembrar modificadores de prueba si no existen
                let count_grupos: i64 = conn.query_row(
                    "SELECT COUNT(*) FROM modificador_grupo",
                    [],
                    |row| row.get(0)
                ).unwrap_or(0);
                
                if count_grupos == 0 {
                    let _ = conn.execute_batch(
                        "INSERT INTO modificador_grupo (id, nombre, obligatorio, min_seleccion, max_seleccion) VALUES
                            (1, 'Tipo de Leche', 1, 1, 1),
                            (2, 'Extras de Hamburguesa', 0, 0, 3);
                         
                         -- precio_extra en céntimos enteros
                         INSERT INTO modificador (id, grupo_id, nombre, precio_extra, orden) VALUES
                            (1, 1, 'Leche Entera', 0, 1),
                            (2, 1, 'Leche Sin Lactosa', 10, 2),
                            (3, 1, 'Leche de Avena', 20, 3),
                            (4, 1, 'Leche de Soja', 20, 4),
                            (5, 2, 'Extra Queso', 50, 1),
                            (6, 2, 'Extra Bacon', 80, 2),
                            (7, 2, 'Extra Huevo', 60, 3);

                         -- Asociar 'Tipo de Leche' al Café con Leche (13) y Capuccino (15)
                         INSERT INTO producto_modificador_grupo (producto_id, grupo_id) VALUES
                            (13, 1),
                            (15, 1);

                         -- Asociar 'Extras de Hamburguesa' a la Hamburguesa Tormel (7)
                         INSERT INTO producto_modificador_grupo (producto_id, grupo_id) VALUES
                            (7, 2);
                        "
                    );
                    info!("Insertados modificadores semilla para pruebas.");
                }
            }


            info!("Base de datos inicializada correctamente");

            // Registrar estado de la DB para acceso desde commands
            let db_conn = db_state.conn.clone();
            app.manage(db_state);

            // Estado de sesión: el backend es la fuente de verdad de la identidad
            // y los permisos del usuario que opera.
            app.manage(auth::session::SessionState::default());

            // Limitador de intentos de login (protección anti fuerza bruta de PIN).
            app.manage(auth::login_guard::LoginGuard::default());

            // Iniciar worker de envío VeriFactu en segundo plano
            services::verifactu::sender_worker::iniciar_verifactu_worker(db_conn);

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // Usuarios
            commands::usuarios::login,
            commands::usuarios::logout,
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
            commands::mesas::agregar_producto_mesa_con_modificadores,
            commands::mesas::actualizar_cantidad_producto_mesa,
            commands::mesas::actualizar_precio_producto_mesa,
            commands::mesas::eliminar_producto_mesa,
            commands::mesas::imprimir_ticket_mesa,
            commands::mesas::cobrar_mesa,
            commands::mesas::traspasar_comanda,
            commands::mesas::obtener_ventas_activas_mesa,
            commands::mesas::crear_division_cuenta,
            commands::mesas::mover_linea_comanda,
            commands::mesas::cobrar_venta,
            commands::mesas::imprimir_ticket_venta,
            commands::mesas::eliminar_venta_vacia,

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
            commands::productos::obtener_modificadores_producto,

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

            // Configuración
            commands::config::guardar_config_verifactu,
            commands::config::obtener_config_verifactu,
            commands::config::obtener_datos_negocio,
            commands::config::guardar_datos_negocio,
        ])
        .run(tauri::generate_context!())
        .expect("Error al ejecutar Tormel POS");
}
