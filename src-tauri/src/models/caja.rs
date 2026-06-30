use serde::{Deserialize, Serialize};
use super::common::{EstadoTurno, TipoMovimiento};

/// Turno de caja.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TurnoCaja {
    pub id: i64,
    pub usuario_id: i64,
    // Importes en céntimos enteros.
    pub fondo_inicial: i64,
    pub fondo_final: Option<i64>,
    pub total_efectivo: i64,
    pub total_tarjeta: i64,
    pub total_otros: i64,
    pub total_ventas: i64,
    pub diferencia: Option<i64>,
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
    /// Importe en céntimos.
    pub importe: i64,
    pub concepto: String,
    pub created_at: String,
}

// ── DTOs ──

/// DTO para abrir un turno de caja.
#[derive(Debug, Deserialize)]
pub struct AbrirTurno {
    /// Fondo inicial en céntimos.
    pub fondo_inicial: i64,
}

/// DTO para cerrar un turno de caja.
#[derive(Debug, Deserialize)]
pub struct CerrarTurno {
    /// Fondo final en céntimos.
    pub fondo_final: i64,
    pub notas: Option<String>,
}

/// DTO para registrar un movimiento manual de caja.
#[derive(Debug, Deserialize)]
pub struct NuevoMovimiento {
    pub tipo: TipoMovimiento,
    /// Importe en céntimos.
    pub importe: i64,
    pub concepto: String,
}

/// Resumen de cierre de caja.
#[derive(Debug, Clone, Serialize)]
pub struct ResumenCierre {
    pub turno: TurnoCaja,
    // Importes en céntimos enteros.
    pub total_efectivo_ventas: i64,
    pub total_tarjeta_ventas: i64,
    pub total_otros_ventas: i64,
    pub total_entradas_caja: i64,
    pub total_salidas_caja: i64,
    pub efectivo_esperado: i64,
    pub diferencia: i64,
    pub num_ventas: i64,
    pub nombre_usuario: String,
}
