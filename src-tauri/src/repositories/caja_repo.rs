use rusqlite::{params, Connection, OptionalExtension};
use crate::error::AppResult;
use crate::models::caja::{TurnoCaja, MovimientoCaja, ResumenCierre};
use crate::models::common::{EstadoTurno, TipoMovimiento};

pub struct CajaRepo;

impl CajaRepo {
    /// Obtiene el turno de caja abierto actualmente, si lo hay.
    pub fn obtener_turno_activo(conn: &Connection) -> AppResult<Option<TurnoCaja>> {
        let mut stmt = conn.prepare(
            "SELECT id, usuario_id, fondo_inicial, fondo_final, total_efectivo, total_tarjeta, 
                    total_otros, total_ventas, diferencia, estado, notas, abierto_at, cerrado_at 
             FROM turno_caja 
             WHERE estado = 'abierto' LIMIT 1"
        )?;
        
        let turno = stmt.query_row([], |row| {
            let estado_str: String = row.get(9)?;
            Ok(TurnoCaja {
                id: row.get(0)?,
                usuario_id: row.get(1)?,
                fondo_inicial: row.get(2)?,
                fondo_final: row.get(3)?,
                total_efectivo: row.get(4)?,
                total_tarjeta: row.get(5)?,
                total_otros: row.get(6)?,
                total_ventas: row.get(7)?,
                diferencia: row.get(8)?,
                estado: EstadoTurno::from_str(&estado_str).unwrap_or(EstadoTurno::Abierto),
                notas: row.get(10)?,
                abierto_at: row.get(11)?,
                cerrado_at: row.get(12)?,
            })
        }).optional()?;
        
        Ok(turno)
    }

    /// Obtiene un turno por ID.
    pub fn obtener_por_id(conn: &Connection, id: i64) -> AppResult<Option<TurnoCaja>> {
        let mut stmt = conn.prepare(
            "SELECT id, usuario_id, fondo_inicial, fondo_final, total_efectivo, total_tarjeta, 
                    total_otros, total_ventas, diferencia, estado, notas, abierto_at, cerrado_at 
             FROM turno_caja 
             WHERE id = ?1"
        )?;
        
        let turno = stmt.query_row(params![id], |row| {
            let estado_str: String = row.get(9)?;
            Ok(TurnoCaja {
                id: row.get(0)?,
                usuario_id: row.get(1)?,
                fondo_inicial: row.get(2)?,
                fondo_final: row.get(3)?,
                total_efectivo: row.get(4)?,
                total_tarjeta: row.get(5)?,
                total_otros: row.get(6)?,
                total_ventas: row.get(7)?,
                diferencia: row.get(8)?,
                estado: EstadoTurno::from_str(&estado_str).unwrap_or(EstadoTurno::Abierto),
                notas: row.get(10)?,
                abierto_at: row.get(11)?,
                cerrado_at: row.get(12)?,
            })
        }).optional()?;
        
        Ok(turno)
    }

    /// Abre un nuevo turno de caja.
    pub fn abrir_turno(conn: &Connection, usuario_id: i64, fondo_inicial: f64) -> AppResult<TurnoCaja> {
        if let Some(_) = Self::obtener_turno_activo(conn)? {
            return Err(crate::error::AppError::Validation("Ya existe un turno de caja abierto. Ciérrelo antes de abrir uno nuevo.".into()));
        }

        conn.execute(
            "INSERT INTO turno_caja (usuario_id, fondo_inicial, estado) VALUES (?1, ?2, 'abierto')",
            params![usuario_id, fondo_inicial],
        )?;

        let id = conn.last_insert_rowid();
        Self::obtener_por_id(conn, id).map(|opt| opt.unwrap())
    }

    /// Registra un movimiento de caja manual (entrada o salida).
    pub fn registrar_movimiento(
        conn: &Connection,
        turno_id: i64,
        usuario_id: i64,
        tipo: TipoMovimiento,
        importe: f64,
        concepto: &str,
    ) -> AppResult<MovimientoCaja> {
        let turno = Self::obtener_por_id(conn, turno_id)?
            .ok_or_else(|| crate::error::AppError::Validation("El turno especificado no existe".into()))?;
            
        if matches!(turno.estado, EstadoTurno::Cerrado) {
            return Err(crate::error::AppError::Validation("No se pueden registrar movimientos en un turno cerrado".into()));
        }

        let tipo_str = tipo.as_str();
        
        conn.execute(
            "INSERT INTO movimiento_caja (turno_id, usuario_id, tipo, importe, concepto) VALUES (?1, ?2, ?3, ?4, ?5)",
            params![turno_id, usuario_id, tipo_str, importe, concepto],
        )?;

        let id = conn.last_insert_rowid();
        
        let created_at: String = conn.query_row(
            "SELECT created_at FROM movimiento_caja WHERE id = ?1",
            params![id],
            |row| row.get(0),
        )?;

        Ok(MovimientoCaja {
            id,
            turno_id,
            usuario_id,
            tipo,
            importe,
            concepto: concepto.to_string(),
            created_at,
        })
    }

    /// Obtiene todos los movimientos de un turno específico
    pub fn obtener_movimientos_turno(conn: &Connection, turno_id: i64) -> AppResult<Vec<MovimientoCaja>> {
        let mut stmt = conn.prepare(
            "SELECT id, turno_id, usuario_id, tipo, importe, concepto, created_at
             FROM movimiento_caja WHERE turno_id = ?1 ORDER BY created_at DESC"
        )?;

        let iter = stmt.query_map(params![turno_id], |row| {
            let tipo_str: String = row.get(3)?;
            Ok(MovimientoCaja {
                id: row.get(0)?,
                turno_id: row.get(1)?,
                usuario_id: row.get(2)?,
                tipo: TipoMovimiento::from_str(&tipo_str).unwrap_or(TipoMovimiento::Entrada),
                importe: row.get(4)?,
                concepto: row.get(5)?,
                created_at: row.get(6)?,
            })
        })?;

        let mut movimientos = Vec::new();
        for m in iter {
            movimientos.push(m?);
        }
        Ok(movimientos)
    }

    /// Cierra el turno actual calculando el descuadre.
    pub fn cerrar_turno(
        conn: &Connection,
        turno_id: i64,
        fondo_final_declarado: f64,
        notas: Option<&str>,
    ) -> AppResult<ResumenCierre> {
        let turno = Self::obtener_por_id(conn, turno_id)?
            .ok_or_else(|| crate::error::AppError::Validation("Turno no encontrado".into()))?;

        if matches!(turno.estado, EstadoTurno::Cerrado) {
            return Err(crate::error::AppError::Validation("El turno ya está cerrado".into()));
        }

        let resumen = Self::obtener_resumen_cierre(conn, turno_id)?;

        let diferencia = fondo_final_declarado - resumen.efectivo_esperado;
        let cerrado_at = chrono::Local::now().format("%Y-%m-%dT%H:%M:%S").to_string();

        conn.execute(
            "UPDATE turno_caja 
             SET fondo_final = ?1, diferencia = ?2, estado = 'cerrado', notas = ?3, cerrado_at = ?4
             WHERE id = ?5",
            params![fondo_final_declarado, diferencia, notas, cerrado_at, turno_id],
        )?;

        // Return updated resumen
        Self::obtener_resumen_cierre(conn, turno_id)
    }

    /// Calcula y devuelve el resumen financiero de un turno de caja
    pub fn obtener_resumen_cierre(conn: &Connection, turno_id: i64) -> AppResult<ResumenCierre> {
        let turno = Self::obtener_por_id(conn, turno_id)?
            .ok_or_else(|| crate::error::AppError::Validation("Turno no encontrado".into()))?;

        let (total_entradas, total_salidas): (f64, f64) = conn.query_row(
            "SELECT 
                COALESCE(SUM(CASE WHEN tipo = 'entrada' THEN importe ELSE 0 END), 0.0),
                COALESCE(SUM(CASE WHEN tipo = 'salida' THEN importe ELSE 0 END), 0.0)
             FROM movimiento_caja 
             WHERE turno_id = ?1",
            params![turno_id],
            |row| Ok((row.get(0)?, row.get(1)?))
        )?;

        let efectivo_esperado = turno.fondo_inicial + turno.total_efectivo + total_entradas - total_salidas;
        
        let diferencia = turno.diferencia.unwrap_or(0.0);

        let nombre_usuario: String = conn.query_row(
            "SELECT nombre FROM usuario WHERE id = ?1",
            params![turno.usuario_id],
            |row| row.get(0),
        )?;

        let num_ventas = turno.total_ventas;
        let total_efectivo_ventas = turno.total_efectivo;
        let total_tarjeta_ventas = turno.total_tarjeta;
        let total_otros_ventas = turno.total_otros;

        Ok(ResumenCierre {
            turno,
            total_efectivo_ventas,
            total_tarjeta_ventas,
            total_otros_ventas,
            total_entradas_caja: total_entradas,
            total_salidas_caja: total_salidas,
            efectivo_esperado,
            diferencia,
            num_ventas,
            nombre_usuario,
        })
    }
}
