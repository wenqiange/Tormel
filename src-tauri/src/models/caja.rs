use serde::{Deserialize, Serialize};
use super::common::{EstadoTurno, TipoMovimiento};

/// Turno de caja.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TurnoCaja {
    pub id: i64,
    pub usuario_id: i64,
    pub fondo_inicial: f64,
    pub fondo_final: Option<f64>,
    pub total_efectivo: f64,
    pub total_tarjeta: f64,
    pub total_otros: f64,
    pub total_ventas: i64,
    pub diferencia: Option<f64>,
    pub estado: EstadoTurno,
    pub notas: Option<String>,
    pub abierto_at: String,
    pub cerrado_at: Option<String>,
}

/// Movimiento manual de caja (entrada o salida no vinculada a venta).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MovimientoCaja {
    pub id: i64,
    pub turno_id: i64,
    pub usuario_id: i64,
    pub tipo: TipoMovimiento,
    pub importe: f64,
    pub concepto: String,
    pub created_at: String,
}

// ── DTOs ──

/// DTO para abrir un turno de caja.
#[derive(Debug, Deserialize)]
pub struct AbrirTurno {
    pub fondo_inicial: f64,
}

/// DTO para cerrar un turno de caja.
#[derive(Debug, Deserialize)]
pub struct CerrarTurno {
    pub fondo_final: f64,
    pub notas: Option<String>,
}

/// DTO para registrar un movimiento manual de caja.
#[derive(Debug, Deserialize)]
pub struct NuevoMovimiento {
    pub tipo: TipoMovimiento,
    pub importe: f64,
    pub concepto: String,
}

/// Resumen de cierre de caja.
#[derive(Debug, Clone, Serialize)]
pub struct ResumenCierre {
    pub turno: TurnoCaja,
    pub total_efectivo_ventas: f64,
    pub total_tarjeta_ventas: f64,
    pub total_otros_ventas: f64,
    pub total_entradas_caja: f64,
    pub total_salidas_caja: f64,
    pub efectivo_esperado: f64,
    pub diferencia: f64,
    pub num_ventas: i64,
    pub nombre_usuario: String,
}
