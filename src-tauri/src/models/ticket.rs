use serde::{Deserialize, Serialize};

/// Línea de un ticket — instantánea inmutable del producto en el momento de generarlo.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TicketLinea {
    pub producto_nombre: String,
    pub cantidad: f64,
    pub precio_unitario: f64,
    pub total: f64,
}

/// Ticket guardado en el historial local.
///
/// Un ticket puede ser:
/// - `pre_cuenta`: generado al pulsar "Generar Ticket" antes de cobrar.
/// - `fiscal`: generado al cobrar la cuenta (con número de factura y QR VeriFactu).
#[derive(Debug, Clone, Serialize)]
pub struct Ticket {
    pub id: i64,
    pub venta_id: Option<i64>,
    pub tipo: String,
    pub numero: Option<String>,
    pub mesa_nombre: Option<String>,
    pub usuario_nombre: Option<String>,
    pub metodo_pago: Option<String>,
    pub comensales: i32,
    pub subtotal: f64,
    pub total_iva: f64,
    pub total: f64,
    pub qr_data: Option<String>,
    pub lineas: Vec<TicketLinea>,
    pub created_at: String,
}
