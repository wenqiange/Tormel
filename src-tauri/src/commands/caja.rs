use tauri::State;
use crate::db::connection::DbState;
use crate::error::{AppError, AppResult};
use crate::models::caja::{AbrirTurno, CerrarTurno, MovimientoCaja, NuevoMovimiento, ResumenCierre, TurnoCaja};
use crate::repositories::caja_repo::CajaRepo;

#[tauri::command]
pub fn obtener_turno_activo(db: State<'_, DbState>) -> AppResult<Option<TurnoCaja>> {
    let conn = db.conn.lock().map_err(|e| AppError::Interno(format!("DB lock error: {}", e)))?;
    CajaRepo::obtener_turno_activo(&conn)
}

#[tauri::command]
pub fn abrir_turno(
    db: State<'_, DbState>,
    usuario_id: i64,
    payload: AbrirTurno,
) -> AppResult<TurnoCaja> {
    let conn = db.conn.lock().map_err(|e| AppError::Interno(format!("DB lock error: {}", e)))?;
    CajaRepo::abrir_turno(&conn, usuario_id, payload.fondo_inicial)
}

#[tauri::command]
pub fn cerrar_turno(
    db: State<'_, DbState>,
    turno_id: i64,
    payload: CerrarTurno,
) -> AppResult<ResumenCierre> {
    let conn = db.conn.lock().map_err(|e| AppError::Interno(format!("DB lock error: {}", e)))?;
    CajaRepo::cerrar_turno(&conn, turno_id, payload.fondo_final, payload.notas.as_deref())
}

#[tauri::command]
pub fn registrar_movimiento_caja(
    db: State<'_, DbState>,
    turno_id: i64,
    usuario_id: i64,
    payload: NuevoMovimiento,
) -> AppResult<MovimientoCaja> {
    let conn = db.conn.lock().map_err(|e| AppError::Interno(format!("DB lock error: {}", e)))?;
    CajaRepo::registrar_movimiento(
        &conn,
        turno_id,
        usuario_id,
        payload.tipo,
        payload.importe,
        &payload.concepto,
    )
}

#[tauri::command]
pub fn obtener_movimientos_turno(
    db: State<'_, DbState>,
    turno_id: i64,
) -> AppResult<Vec<MovimientoCaja>> {
    let conn = db.conn.lock().map_err(|e| AppError::Interno(format!("DB lock error: {}", e)))?;
    CajaRepo::obtener_movimientos_turno(&conn, turno_id)
}

#[tauri::command]
pub fn obtener_resumen_cierre(
    db: State<'_, DbState>,
    turno_id: i64,
) -> AppResult<ResumenCierre> {
    let conn = db.conn.lock().map_err(|e| AppError::Interno(format!("DB lock error: {}", e)))?;
    CajaRepo::obtener_resumen_cierre(&conn, turno_id)
}
