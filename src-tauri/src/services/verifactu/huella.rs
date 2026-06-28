use sha2::{Sha256, Digest};
use chrono::{DateTime, Local};

/// Calcula la huella del registro de alta de factura (TicketBAI / VeriFactu) y su hash SHA-256.
///
/// Componentes (en este orden exacto según la Orden HAC/1177/2024):
/// 1. NIF del Emisor (IDEmisorAlta)
/// 2. Número y Serie de Factura (NumSerieFactura)
/// 3. Fecha de Expedición (DD-MM-YYYY) (FechaExpedicionFactura)
/// 4. Tipo de Factura (F1, F2, F3...)
/// 5. Cuota Total (CuotaTotal) -> Dos decimales, sin separador de miles.
/// 6. Importe Total (ImporteTotal) -> Dos decimales, sin separador de miles.
/// 7. Hash del registro anterior (HashAnterior)
pub fn calcular_huella(
    nif_emisor: &str,
    num_serie_factura: &str,
    fecha_expedicion_iso: &str, // Esperamos ISO 8601 o similar
    tipo_factura: &str, // ej: "F2" (Ticket / Factura simplificada)
    cuota_total: f64,
    importe_total: f64,
    hash_anterior: Option<&str>,
) -> (String, String) {
    // Formatear Fecha: Extraer DD-MM-YYYY
    // Asumimos que viene un ISO ej: "2026-06-28T23:19:38+02:00"
    let fecha = if let Ok(dt) = DateTime::parse_from_rfc3339(fecha_expedicion_iso) {
        dt.format("%d-%m-%Y").to_string()
    } else {
        // Fallback básico si la fecha es simple "YYYY-MM-DD"
        let partes: Vec<&str> = fecha_expedicion_iso.split('T').collect();
        let ymd: Vec<&str> = partes[0].split('-').collect();
        if ymd.len() == 3 {
            format!("{}-{}-{}", ymd[2], ymd[1], ymd[0])
        } else {
            fecha_expedicion_iso.to_string()
        }
    };

    // Formatear numéricos a 2 decimales usando punto como separador
    let cuota_str = format!("{:.2}", cuota_total);
    let importe_str = format!("{:.2}", importe_total);

    // Concatenación exacta exigida por la normativa
    let mut huella = format!(
        "{}{}{}{}{}{}",
        nif_emisor, num_serie_factura, fecha, tipo_factura, cuota_str, importe_str
    );

    // Añadir hash anterior si existe
    if let Some(h) = hash_anterior {
        if !h.is_empty() {
            huella.push_str(h);
        }
    }

    // Calcular SHA-256
    let mut hasher = Sha256::new();
    hasher.update(huella.as_bytes());
    let result = hasher.finalize();
    
    // Convertir a Hexadecimal en mayúsculas
    let hash_hex = format!("{:X}", result);

    (huella, hash_hex)
}

/// Genera la URL del código QR para imprimir en el ticket (obligatorio VeriFactu).
pub fn generar_url_qr(
    nif_emisor: &str,
    num_serie_factura: &str,
    fecha_expedicion_iso: &str,
    importe_total: f64,
) -> String {
    let fecha = if let Ok(dt) = DateTime::parse_from_rfc3339(fecha_expedicion_iso) {
        dt.format("%d-%m-%Y").to_string()
    } else {
        "01-01-2000".to_string()
    };
    
    let importe_str = format!("{:.2}", importe_total);

    // Estructura base de la URL según la especificación técnica de la AEAT
    format!(
        "https://www2.agenciatributaria.gob.es/wlpl/inwinv/es.aeat.dit.adu.sii.sif.FacturasComprobacion?id={}&num={}&fecha={}&imp={}",
        nif_emisor, num_serie_factura, fecha, importe_str
    )
}
