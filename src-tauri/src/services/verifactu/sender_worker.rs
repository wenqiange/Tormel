use std::time::Duration;
use rusqlite::Connection;
use std::sync::{Arc, Mutex};
use base64::{Engine as _, engine::general_purpose};

use crate::commands::config::{obtener_config_verifactu_interna};
use crate::repositories::venta_repo::VentaRepo;
use crate::repositories::negocio_repo::NegocioRepo;
use crate::services::verifactu::client::VerifactuClient;
use crate::services::verifactu::xml_builder::build_alta_factura_xml;

pub fn iniciar_verifactu_worker(db_conn: Arc<Mutex<Connection>>) {
    std::thread::spawn(move || {
        let rt = match tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build() {
                Ok(rt) => rt,
                Err(e) => {
                    log::error!("No se pudo iniciar el runtime de Tokio para VeriFactu worker: {}", e);
                    return;
                }
            };
        
        rt.block_on(async move {
            log::info!("Iniciando worker de segundo plano para envíos de VeriFactu...");
            
            loop {
                // Esperar 20 segundos
                tokio::time::sleep(Duration::from_secs(20)).await;

            let (cert_b64, password, is_produccion, nif, nombre_negocio) = {
                let conn_lock = match db_conn.lock() {
                    Ok(conn) => conn,
                    Err(e) => {
                        log::error!("Error de bloqueo de BD en VeriFactu worker: {}", e);
                        continue;
                    }
                };

                // 1. Obtener la configuración de VeriFactu
                let verifactu_config = match obtener_config_verifactu_interna(&conn_lock) {
                    Ok(Some(cfg)) => cfg,
                    _ => continue, // No configurado
                };

                let cert = match verifactu_config.certificado_b64.as_ref() {
                    Some(c) if !c.is_empty() => c.clone(),
                    _ => continue, // Sin certificado
                };

                let pass = verifactu_config.password.clone().unwrap_or_default();
                let prod = verifactu_config.entorno.as_deref().unwrap_or("pruebas") == "produccion";

                // Obtener datos del negocio
                let negocio = match NegocioRepo::obtener(&conn_lock) {
                    Ok(n) => n,
                    Err(_) => continue,
                };

                (cert, pass, prod, negocio.nif, negocio.nombre)
            };

            // Decodificar el certificado fuera del bloqueo de la base de datos
            let p12_bytes = match general_purpose::STANDARD.decode(&cert_b64) {
                Ok(bytes) => bytes,
                Err(e) => {
                    log::error!("Error al decodificar certificado base64 de VeriFactu: {}", e);
                    continue;
                }
            };

            // Buscar facturas pendientes
            let pendientes: Vec<(i64, String, String)> = {
                let conn_lock = match db_conn.lock() {
                    Ok(c) => c,
                    Err(_) => continue,
                };

                let mut stmt = match conn_lock.prepare(
                    "SELECT id, hash_registro, fecha_hora_huso FROM venta WHERE estado_verifactu = 'pendiente' LIMIT 5"
                ) {
                    Ok(s) => s,
                    Err(e) => {
                        log::error!("Error preparando consulta de ventas pendientes: {}", e);
                        continue;
                    }
                };

                let rows = stmt.query_map([], |row| {
                    Ok((row.get(0)?, row.get(1)?, row.get(2)?))
                });

                match rows {
                    Ok(mapped) => mapped.filter_map(Result::ok).collect(),
                    Err(e) => {
                        log::error!("Error ejecutando consulta de ventas pendientes: {}", e);
                        continue;
                    }
                }
            };

            if pendientes.is_empty() {
                continue;
            }

            log::info!("Encontradas {} facturas pendientes de envío a la AEAT.", pendientes.len());

            // Inicializar el cliente SOAP HTTP
            let client = match VerifactuClient::new(&p12_bytes, &password, is_produccion) {
                Ok(c) => c,
                Err(e) => {
                    log::error!("Error al inicializar VerifactuClient: {}", e);
                    continue;
                }
            };

            for (venta_id, hash_registro, fecha_hora_huso) in pendientes {
                let (venta_completa, nif_emisor, nombre_emisor) = {
                    let conn_lock = match db_conn.lock() {
                        Ok(c) => c,
                        Err(_) => continue,
                    };

                    let venta = match VentaRepo::obtener_por_id(&conn_lock, venta_id) {
                        Ok(v) => v,
                        Err(e) => {
                            log::error!("No se pudo cargar la venta {} completa: {}", venta_id, e);
                            continue;
                        }
                    };

                    (venta, nif.clone(), nombre_negocio.clone())
                };

                // Generar el XML de la factura
                let xml = build_alta_factura_xml(
                    &nif_emisor,
                    &nombre_emisor,
                    &venta_completa,
                    &hash_registro,
                    &fecha_hora_huso,
                );

                let factura_num = venta_completa.venta.numero.clone().unwrap_or_else(|| format!("ID-{}", venta_id));
                log::info!("Enviando factura/ticket {} a la AEAT...", factura_num);

                // Enviar a la AEAT
                match client.enviar_alta(&xml).await {
                    Ok(_respuesta) => {
                        log::info!("Factura/ticket {} enviado y registrado en AEAT con éxito.", factura_num);
                        
                        let conn_lock = match db_conn.lock() {
                            Ok(c) => c,
                            Err(_) => continue,
                        };

                        let _ = conn_lock.execute(
                            "UPDATE venta SET estado_verifactu = 'enviado' WHERE id = ?1",
                            [venta_id]
                        );
                    }
                    Err(e) => {
                        log::error!("Error enviando factura {} a la AEAT: {}", factura_num, e);
                        
                        let conn_lock = match db_conn.lock() {
                            Ok(c) => c,
                            Err(_) => continue,
                        };

                        let _ = conn_lock.execute(
                            "UPDATE venta SET estado_verifactu = 'error' WHERE id = ?1",
                            [venta_id]
                        );
                    }
                }
            }
        }
    });
});
}
