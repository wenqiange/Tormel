use rusqlite::{params, Connection, OptionalExtension};
use std::str::FromStr;

use crate::error::{AppError, AppResult};
use crate::models::venta::{Venta, LineaVenta, Pago, VentaCompleta, NuevoPago};
use crate::models::common::{EstadoMesa, EstadoVenta, TipoVenta, MetodoPago};
use crate::repositories::mesa_repo::MesaRepo;
use crate::repositories::producto_repo::ProductoRepo;
use crate::services::verifactu::huella::{calcular_huella, generar_url_qr};

/// Repositorio de ventas y pedidos — acceso a datos en SQLite.
pub struct VentaRepo;

impl VentaRepo {
    /// Obtiene una venta completa por su ID.
    pub fn obtener_por_id(conn: &Connection, id: i64) -> AppResult<VentaCompleta> {
        let venta = conn.query_row(
            "SELECT id, mesa_id, usuario_id, cliente_id, turno_id, serie_id, numero, tipo, estado, comensales, subtotal, total_descuento, total_iva, total, notas, abierta_at, cerrada_at, created_at, hash_registro, hash_anterior, huella_verifactu, estado_verifactu, fecha_hora_huso, qr_data
             FROM venta WHERE id = ?1",
            [id],
            |row| {
                let tipo_str: String = row.get(7)?;
                let estado_str: String = row.get(8)?;
                Ok(Venta {
                    id: row.get(0)?,
                    mesa_id: row.get(1)?,
                    usuario_id: row.get(2)?,
                    cliente_id: row.get(3)?,
                    turno_id: row.get(4)?,
                    serie_id: row.get(5)?,
                    numero: row.get(6)?,
                    tipo: TipoVenta::from_str(&tipo_str).unwrap_or(TipoVenta::Mesa),
                    estado: EstadoVenta::from_str(&estado_str).unwrap_or(EstadoVenta::Abierta),
                    comensales: row.get(9)?,
                    subtotal: row.get(10)?,
                    total_descuento: row.get(11)?,
                    total_iva: row.get(12)?,
                    total: row.get(13)?,
                    notas: row.get(14)?,
                    abierta_at: row.get(15)?,
                    cerrada_at: row.get(16)?,
                    created_at: row.get(17)?,
                    hash_registro: row.get(18)?,
                    hash_anterior: row.get(19)?,
                    huella_verifactu: row.get(20)?,
                    estado_verifactu: row.get(21)?,
                    fecha_hora_huso: row.get(22)?,
                    qr_data: row.get(23)?,
                })
            }
        ).map_err(|_| AppError::NoEncontrado(format!("Venta con ID {} no existe", id)))?;

        Self::obtener_detalles(conn, venta)
    }

    /// Obtiene la venta activa (abierta) para una mesa si existe.
    pub fn obtener_activa_por_mesa(conn: &Connection, mesa_id: i64) -> AppResult<Option<VentaCompleta>> {
        let mut stmt = conn.prepare(
            "SELECT id, mesa_id, usuario_id, cliente_id, turno_id, serie_id, numero, tipo, estado, comensales, subtotal, total_descuento, total_iva, total, notas, abierta_at, cerrada_at, created_at, hash_registro, hash_anterior, huella_verifactu, estado_verifactu, fecha_hora_huso, qr_data
             FROM venta WHERE mesa_id = ?1 AND estado = 'abierta' LIMIT 1"
        )?;

        let mut rows = stmt.query([mesa_id])?;
        if let Some(row) = rows.next()? {
            let tipo_str: String = row.get(7)?;
            let estado_str: String = row.get(8)?;
            let venta = Venta {
                id: row.get(0)?,
                mesa_id: row.get(1)?,
                usuario_id: row.get(2)?,
                cliente_id: row.get(3)?,
                turno_id: row.get(4)?,
                serie_id: row.get(5)?,
                numero: row.get(6)?,
                tipo: TipoVenta::from_str(&tipo_str).unwrap_or(TipoVenta::Mesa),
                estado: EstadoVenta::from_str(&estado_str).unwrap_or(EstadoVenta::Abierta),
                comensales: row.get(9)?,
                subtotal: row.get(10)?,
                total_descuento: row.get(11)?,
                total_iva: row.get(12)?,
                total: row.get(13)?,
                notas: row.get(14)?,
                abierta_at: row.get(15)?,
                cerrada_at: row.get(16)?,
                created_at: row.get(17)?,
                hash_registro: row.get(18)?,
                hash_anterior: row.get(19)?,
                huella_verifactu: row.get(20)?,
                estado_verifactu: row.get(21)?,
                fecha_hora_huso: row.get(22)?,
                qr_data: row.get(23)?,
            };

            let completa = Self::obtener_detalles(conn, venta)?;
            Ok(Some(completa))
        } else {
            Ok(None)
        }
    }

    /// Crea una nueva venta abierta (pedido) para una mesa.
    pub fn crear_venta_abierta(conn: &Connection, mesa_id: i64, usuario_id: i64) -> AppResult<i64> {
        // Buscar el turno de caja abierto
        let turno_id: i64 = conn.query_row(
            "SELECT id FROM turno_caja WHERE estado = 'abierto' ORDER BY id DESC LIMIT 1",
            [],
            |row| row.get(0)
        ).map_err(|_| AppError::CajaNoAbierta)?;

        // Crear la venta
        conn.execute(
            "INSERT INTO venta (mesa_id, usuario_id, turno_id, tipo, estado, comensales, subtotal, total_descuento, total_iva, total)
             VALUES (?1, ?2, ?3, 'mesa', 'abierta', 1, 0.0, 0.0, 0.0, 0.0)",
            params![mesa_id, usuario_id, turno_id],
        )?;

        let venta_id = conn.last_insert_rowid();
        Ok(venta_id)
    }

    /// Añade un producto al pedido o incrementa/decrementa su cantidad.
    pub fn agregar_o_actualizar_linea(
        conn: &Connection,
        venta_id: i64,
        producto_id: i64,
        cantidad_delta: f64,
    ) -> AppResult<()> {
        let producto = ProductoRepo::obtener_por_id(conn, producto_id)?;

        // Verificar si la línea ya existe para este producto en esta venta
        let linea_opt: Option<(i64, f64)> = conn.query_row(
            "SELECT id, cantidad FROM linea_venta WHERE venta_id = ?1 AND producto_id = ?2",
            params![venta_id, producto_id],
            |row| Ok((row.get(0)?, row.get(1)?))
        ).optional()?;

        if let Some((linea_id, cantidad_actual)) = linea_opt {
            let nueva_cantidad = cantidad_actual + cantidad_delta;
            if nueva_cantidad <= 0.0 {
                // Eliminar línea si la cantidad llega a cero o menos
                conn.execute("DELETE FROM linea_venta WHERE id = ?1", params![linea_id])?;
            } else {
                // Actualizar cantidad e importes
                let pvp = producto.precio;
                let tipo_iva = producto.tipo_iva;
                let precio_base = pvp / (1.0 + tipo_iva / 100.0);
                
                let subtotal = precio_base * nueva_cantidad;
                let importe_iva = subtotal * (tipo_iva / 100.0);
                let total = subtotal + importe_iva;

                conn.execute(
                    "UPDATE linea_venta 
                     SET cantidad = ?1, subtotal = ?2, importe_iva = ?3, total = ?4 
                     WHERE id = ?5",
                    params![nueva_cantidad, subtotal, importe_iva, total, linea_id],
                )?;
            }
        } else if cantidad_delta > 0.0 {
            // Crear nueva línea
            let pvp = producto.precio;
            let tipo_iva = producto.tipo_iva;
            let precio_base = pvp / (1.0 + tipo_iva / 100.0);
            
            let subtotal = precio_base * cantidad_delta;
            let importe_iva = subtotal * (tipo_iva / 100.0);
            let total = subtotal + importe_iva;

            conn.execute(
                "INSERT INTO linea_venta (venta_id, producto_id, producto_nombre, producto_precio, tipo_iva, cantidad, descuento_pct, subtotal, importe_iva, total)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, 0.0, ?7, ?8, ?9)",
                params![
                    venta_id,
                    producto_id,
                    producto.nombre,
                    precio_base,
                    tipo_iva,
                    cantidad_delta,
                    subtotal,
                    importe_iva,
                    total
                ],
            )?;
        }

        // Recalcular totales de la venta
        Self::actualizar_totales(conn, venta_id)?;

        // Actualizar el estado de la mesa correspondiente
        Self::actualizar_estado_mesa_por_venta(conn, venta_id)?;

        Ok(())
    }

    /// Actualiza la cantidad exacta de una línea de producto.
    pub fn actualizar_cantidad_linea(
        conn: &Connection,
        venta_id: i64,
        producto_id: i64,
        cantidad: f64,
    ) -> AppResult<()> {
        if cantidad <= 0.0 {
            return Self::eliminar_linea(conn, venta_id, producto_id);
        }

        let producto = ProductoRepo::obtener_por_id(conn, producto_id)?;

        let pvp = producto.precio;
        let tipo_iva = producto.tipo_iva;
        let precio_base = pvp / (1.0 + tipo_iva / 100.0);
        
        let subtotal = precio_base * cantidad;
        let importe_iva = subtotal * (tipo_iva / 100.0);
        let total = subtotal + importe_iva;

        let rows = conn.execute(
            "UPDATE linea_venta 
             SET cantidad = ?1, subtotal = ?2, importe_iva = ?3, total = ?4 
             WHERE venta_id = ?5 AND producto_id = ?6",
            params![cantidad, subtotal, importe_iva, total, venta_id, producto_id],
        )?;

        if rows == 0 {
            // Si no existía, la creamos
            return Self::agregar_o_actualizar_linea(conn, venta_id, producto_id, cantidad);
        }

        Self::actualizar_totales(conn, venta_id)?;
        Self::actualizar_estado_mesa_por_venta(conn, venta_id)?;
        Ok(())
    }

    /// Elimina un producto del pedido.
    pub fn eliminar_linea(conn: &Connection, venta_id: i64, producto_id: i64) -> AppResult<()> {
        conn.execute(
            "DELETE FROM linea_venta WHERE venta_id = ?1 AND producto_id = ?2",
            params![venta_id, producto_id],
        )?;

        Self::actualizar_totales(conn, venta_id)?;
        Self::actualizar_estado_mesa_por_venta(conn, venta_id)?;
        Ok(())
    }

    /// Cambia el estado de la mesa a 'por_cobrar' (Generar Ticket / Naranja).
    pub fn imprimir_ticket(conn: &Connection, mesa_id: i64) -> AppResult<()> {
        let venta_activa = Self::obtener_activa_por_mesa(conn, mesa_id)?;
        if venta_activa.is_none() {
            return Err(AppError::Validation("No hay consumos activos en esta mesa para generar ticket".into()));
        }
        
        MesaRepo::actualizar_estado(conn, mesa_id, &EstadoMesa::PorCobrar)?;
        Ok(())
    }

    /// Procesa el cobro de la cuenta:
    /// - Registra el pago en la base de datos.
    /// - Cierra la venta (estado = 'cobrada', asigna fecha/hora, calcula ticket).
    /// - Actualiza los acumulados del turno de caja actual.
    /// - Libera la mesa (estado = 'libre').
    pub fn cobrar_venta(
        conn: &Connection,
        mesa_id: i64,
        metodo_pago: &str,
        importe_entregado: f64,
    ) -> AppResult<String> {
        let venta_completa = Self::obtener_activa_por_mesa(conn, mesa_id)?
            .ok_or_else(|| AppError::Validation("No hay ningún pedido abierto para esta mesa".into()))?;
        
        let venta_id = venta_completa.venta.id;
        let total_venta = venta_completa.venta.total;

        if total_venta <= 0.0 {
            return Err(AppError::Validation("No se puede cobrar una cuenta con total de 0.00€".into()));
        }

        // 1. Obtener y actualizar correlativo de serie de facturación
        let (serie_id, ultimo_numero): (i64, i64) = conn.query_row(
            "SELECT id, ultimo_numero FROM serie_facturacion WHERE codigo = 'A'",
            [],
            |row| Ok((row.get(0)?, row.get(1)?))
        )?;
        let nuevo_numero = ultimo_numero + 1;
        conn.execute(
            "UPDATE serie_facturacion SET ultimo_numero = ?1 WHERE id = ?2",
            params![nuevo_numero, serie_id],
        )?;
        let numero_factura = format!("A-{:06}", nuevo_numero);

        // 2. Cerrar la venta y aplicar VeriFactu
        let ahora = chrono::Local::now();
        let cerrada_at = ahora.format("%Y-%m-%dT%H:%M:%S").to_string();
        let fecha_hora_huso = ahora.to_rfc3339();

        // Obtener el hash de la última factura cobrada
        let hash_anterior: Option<String> = conn.query_row(
            "SELECT hash_registro FROM venta WHERE estado = 'cobrada' AND hash_registro IS NOT NULL ORDER BY cerrada_at DESC LIMIT 1",
            [],
            |row| row.get(0)
        ).optional()?.flatten();

        let nif_emisor = "B12345678"; // En producción vendrá de la tabla Configuración

        let (huella, hash_hex) = calcular_huella(
            nif_emisor,
            &numero_factura,
            &fecha_hora_huso,
            "F2",
            venta_completa.venta.total_iva,
            total_venta,
            hash_anterior.as_deref()
        );

        let qr_data = generar_url_qr(nif_emisor, &numero_factura, &fecha_hora_huso, total_venta);

        conn.execute(
            "UPDATE venta 
             SET estado = 'cobrada', cerrada_at = ?1, numero = ?2, serie_id = ?3,
                 hash_registro = ?4, hash_anterior = ?5, huella_verifactu = ?6,
                 estado_verifactu = 'pendiente', fecha_hora_huso = ?7, qr_data = ?8
             WHERE id = ?9",
            params![
                cerrada_at, numero_factura, serie_id, 
                hash_hex, hash_anterior, huella, fecha_hora_huso, &qr_data, 
                venta_id
            ],
        )?;

        // 3. Registrar el pago
        let cambio = if metodo_pago == "efectivo" && importe_entregado > total_venta {
            importe_entregado - total_venta
        } else {
            0.0
        };

        conn.execute(
            "INSERT INTO pago (venta_id, metodo, importe, cambio)
             VALUES (?1, ?2, ?3, ?4)",
            params![
                venta_id,
                metodo_pago,
                total_venta,
                cambio
            ],
        )?;

        // 4. Actualizar el turno de caja
        let campo_total = match metodo_pago {
            "efectivo" => "total_efectivo",
            "tarjeta" => "total_tarjeta",
            _ => "total_otros",
        };
        let query_turno = format!(
            "UPDATE turno_caja 
             SET total_ventas = total_ventas + 1, {} = {} + ?1 
             WHERE id = ?2",
            campo_total, campo_total
        );
        conn.execute(&query_turno, params![total_venta, venta_completa.venta.turno_id])?;

        // 5. Restablecer mesa a libre
        MesaRepo::actualizar_estado(conn, mesa_id, &EstadoMesa::Libre)?;

        Ok(qr_data)
    }

    /// Listar las ventas cobradas hoy para el resumen de facturación diaria.
    pub fn listar_ventas_diarias(conn: &Connection) -> AppResult<Vec<VentaCompleta>> {
        let mut stmt = conn.prepare(
            "SELECT id, mesa_id, usuario_id, cliente_id, turno_id, serie_id, numero, tipo, estado, comensales, subtotal, total_descuento, total_iva, total, notas, abierta_at, cerrada_at, created_at, hash_registro, hash_anterior, huella_verifactu, estado_verifactu, fecha_hora_huso, qr_data
             FROM venta 
             WHERE estado = 'cobrada'
             ORDER BY cerrada_at DESC"
        )?;

        let ventas = stmt.query_map([], |row| {
            let tipo_str: String = row.get(7)?;
            let estado_str: String = row.get(8)?;
            Ok(Venta {
                id: row.get(0)?,
                mesa_id: row.get(1)?,
                usuario_id: row.get(2)?,
                cliente_id: row.get(3)?,
                turno_id: row.get(4)?,
                serie_id: row.get(5)?,
                numero: row.get(6)?,
                tipo: TipoVenta::from_str(&tipo_str).unwrap_or(TipoVenta::Mesa),
                estado: EstadoVenta::from_str(&estado_str).unwrap_or(EstadoVenta::Cobrada),
                comensales: row.get(9)?,
                subtotal: row.get(10)?,
                total_descuento: row.get(11)?,
                total_iva: row.get(12)?,
                total: row.get(13)?,
                notas: row.get(14)?,
                abierta_at: row.get(15)?,
                cerrada_at: row.get(16)?,
                created_at: row.get(17)?,
                hash_registro: row.get(18)?,
                hash_anterior: row.get(19)?,
                huella_verifactu: row.get(20)?,
                estado_verifactu: row.get(21)?,
                fecha_hora_huso: row.get(22)?,
                qr_data: row.get(23)?,
            })
        })?.collect::<Result<Vec<_>, _>>()?;

        let mut ventas_completas = Vec::new();
        for v in ventas {
            ventas_completas.push(Self::obtener_detalles(conn, v)?);
        }

        Ok(ventas_completas)
    }

    // ── Métodos Auxiliares Internos ──

    /// Helper para rellenar líneas, pagos y nombres descriptivos de una venta.
    fn obtener_detalles(conn: &Connection, venta: Venta) -> AppResult<VentaCompleta> {
        // Cargar líneas
        let mut stmt_lineas = conn.prepare(
            "SELECT id, venta_id, producto_id, producto_nombre, producto_precio, tipo_iva, cantidad, descuento_pct, subtotal, importe_iva, total, notas, created_at
             FROM linea_venta WHERE venta_id = ?1"
        )?;
        let lineas = stmt_lineas.query_map([venta.id], |row| {
            Ok(LineaVenta {
                id: row.get(0)?,
                venta_id: row.get(1)?,
                producto_id: row.get(2)?,
                producto_nombre: row.get(3)?,
                producto_precio: row.get(4)?,
                tipo_iva: row.get(5)?,
                cantidad: row.get(6)?,
                descuento_pct: row.get(7)?,
                subtotal: row.get(8)?,
                importe_iva: row.get(9)?,
                total: row.get(10)?,
                notas: row.get(11)?,
                created_at: row.get(12)?,
                modificadores: Vec::new(),
            })
        })?.collect::<Result<Vec<_>, _>>()?;

        // Cargar pagos
        let mut stmt_pagos = conn.prepare(
            "SELECT id, venta_id, metodo, importe, cambio, referencia, created_at
             FROM pago WHERE venta_id = ?1"
        )?;
        let pagos = stmt_pagos.query_map([venta.id], |row| {
            let metodo_str: String = row.get(2)?;
            Ok(Pago {
                id: row.get(0)?,
                venta_id: row.get(1)?,
                metodo: MetodoPago::from_str(&metodo_str).unwrap_or(MetodoPago::Efectivo),
                importe: row.get(3)?,
                cambio: row.get(4)?,
                referencia: row.get(5)?,
                created_at: row.get(6)?,
            })
        })?.collect::<Result<Vec<_>, _>>()?;

        // Cargar nombres relacionales
        let nombre_mesa = if let Some(m_id) = venta.mesa_id {
            conn.query_row("SELECT nombre FROM mesa WHERE id = ?1", [m_id], |row| row.get(0)).optional()?
        } else {
            None
        };

        let nombre_usuario: String = conn.query_row(
            "SELECT nombre FROM usuario WHERE id = ?1",
            [venta.usuario_id],
            |row| row.get(0)
        ).unwrap_or_else(|_| "Usuario".to_string());

        let nombre_cliente = if let Some(c_id) = venta.cliente_id {
            conn.query_row("SELECT nombre FROM cliente WHERE id = ?1", [c_id], |row| row.get(0)).optional()?
        } else {
            None
        };

        Ok(VentaCompleta {
            venta,
            lineas,
            pagos,
            nombre_mesa,
            nombre_usuario,
            nombre_cliente,
        })
    }

    /// Recalcula los acumulados monetarios de una venta en base a sus líneas.
    fn actualizar_totales(conn: &Connection, venta_id: i64) -> AppResult<()> {
        let (sum_subtotal, sum_iva, sum_total): (f64, f64, f64) = conn.query_row(
            "SELECT COALESCE(SUM(subtotal), 0.0), COALESCE(SUM(importe_iva), 0.0), COALESCE(SUM(total), 0.0)
             FROM linea_venta WHERE venta_id = ?1",
            [venta_id],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?))
        )?;

        conn.execute(
            "UPDATE venta 
             SET subtotal = ?1, total_iva = ?2, total = ?3 
             WHERE id = ?4",
            params![sum_subtotal, sum_iva, sum_total, venta_id],
        )?;

        Ok(())
    }

    fn actualizar_estado_mesa_por_venta(conn: &Connection, venta_id: i64) -> AppResult<()> {
        let mesa_id_opt: Option<i64> = conn.query_row(
            "SELECT mesa_id FROM venta WHERE id = ?1",
            [venta_id],
            |row| row.get(0)
        )?;

        if let Some(mesa_id) = mesa_id_opt {
            let total_items: i64 = conn.query_row(
                "SELECT COUNT(*) FROM linea_venta WHERE venta_id = ?1",
                [venta_id],
                |row| row.get(0)
            )?;

            // Solo cambia el estado si no está ya en estado 'por_cobrar' (Naranja)
            let estado_actual: String = conn.query_row(
                "SELECT estado FROM mesa WHERE id = ?1",
                [mesa_id],
                |row| row.get(0)
            )?;

            if estado_actual != "por_cobrar" {
                let nuevo_estado = if total_items > 0 {
                    EstadoMesa::Ocupada
                } else {
                    EstadoMesa::Libre
                };
                MesaRepo::actualizar_estado(conn, mesa_id, &nuevo_estado)?;
            }
        }

        Ok(())
    }
}
