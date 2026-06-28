use serde::{Deserialize, Serialize};
use super::common::{TipoVenta, EstadoVenta, MetodoPago};

/// Venta (ticket / factura).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Venta {
    pub id: i64,
    pub mesa_id: Option<i64>,
    pub usuario_id: i64,
    pub cliente_id: Option<i64>,
    pub turno_id: i64,
    pub serie_id: Option<i64>,
    pub numero: Option<String>,
    pub tipo: TipoVenta,
    pub estado: EstadoVenta,
    pub comensales: i32,
    pub subtotal: f64,
    pub total_descuento: f64,
    pub total_iva: f64,
    pub total: f64,
    pub notas: Option<String>,
    pub abierta_at: String,
    pub cerrada_at: Option<String>,
    // -- Campos VeriFactu (AEAT) --
    pub hash_registro: Option<String>,
    pub hash_anterior: Option<String>,
    pub huella_verifactu: Option<String>,
    pub estado_verifactu: Option<String>,
    pub fecha_hora_huso: Option<String>,
    pub qr_data: Option<String>,
    // -----------------------------
    pub created_at: String,
}

/// Línea de venta (producto añadido).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LineaVenta {
    pub id: i64,
    pub venta_id: i64,
    pub producto_id: i64,
    pub producto_nombre: String,
    pub producto_precio: f64,
    pub tipo_iva: f64,
    pub cantidad: f64,
    pub descuento_pct: f64,
    pub subtotal: f64,
    pub importe_iva: f64,
    pub total: f64,
    pub notas: Option<String>,
    pub created_at: String,
    /// Modificadores aplicados a esta línea (se carga opcionalmente).
    #[serde(default)]
    pub modificadores: Vec<LineaModificador>,
}

/// Modificador aplicado a una línea de venta.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LineaModificador {
    pub id: i64,
    pub linea_venta_id: i64,
    pub modificador_id: i64,
    pub nombre: String,
    pub precio_extra: f64,
}

/// Pago asociado a una venta.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Pago {
    pub id: i64,
    pub venta_id: i64,
    pub metodo: MetodoPago,
    pub importe: f64,
    pub cambio: f64,
    pub referencia: Option<String>,
    pub created_at: String,
}

/// Serie de facturación.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SerieFacturacion {
    pub id: i64,
    pub codigo: String,
    pub descripcion: String,
    pub tipo: String,
    pub ultimo_numero: i64,
    pub activa: bool,
    pub created_at: String,
}

// ── DTOs ──

/// DTO para abrir una nueva venta.
#[derive(Debug, Deserialize)]
pub struct NuevaVenta {
    pub mesa_id: Option<i64>,
    pub tipo: TipoVenta,
    pub comensales: Option<i32>,
}

/// DTO para añadir una línea a una venta.
#[derive(Debug, Deserialize)]
pub struct NuevaLineaVenta {
    pub producto_id: i64,
    pub cantidad: f64,
    pub notas: Option<String>,
    #[serde(default)]
    pub modificador_ids: Vec<i64>,
}

/// DTO para registrar un pago.
#[derive(Debug, Deserialize)]
pub struct NuevoPago {
    pub metodo: MetodoPago,
    pub importe: f64,
    pub referencia: Option<String>,
}

/// DTO para cobrar una venta (puede tener múltiples pagos).
#[derive(Debug, Deserialize)]
pub struct CobrarVenta {
    pub pagos: Vec<NuevoPago>,
    pub cliente_id: Option<i64>,
}

/// Venta completa con líneas y pagos (para vista detalle).
#[derive(Debug, Clone, Serialize)]
pub struct VentaCompleta {
    #[serde(flatten)]
    pub venta: Venta,
    pub lineas: Vec<LineaVenta>,
    pub pagos: Vec<Pago>,
    pub nombre_mesa: Option<String>,
    pub nombre_usuario: String,
    pub nombre_cliente: Option<String>,
}

/// Desglose de IVA para informes.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DesgloseIva {
    pub tipo_iva: f64,
    pub base_imponible: f64,
    pub cuota_iva: f64,
    pub total: f64,
}
