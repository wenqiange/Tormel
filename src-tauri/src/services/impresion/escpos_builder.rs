use crate::models::venta::VentaCompleta;
use crate::models::negocio::Negocio;

/// Genera una representación en texto plano legible del ticket (para emulación y depuración).
pub fn generar_ticket_texto(negocio: &Negocio, venta: &VentaCompleta) -> String {
    let mut ticket = String::new();
    let width = 40; // Ancho estándar de ticket (caracteres monoespaciados de impresoras de 80mm)

    let centrar = |text: &str| {
        if text.len() >= width {
            text.to_string()
        } else {
            let left = (width - text.len()) / 2;
            format!("{}{}", " ".repeat(left), text)
        }
    };

    ticket.push_str(&centrar("=== PRE-CUENTA / TICKET ==="));
    ticket.push_str("\n");
    if !negocio.nombre.is_empty() {
        ticket.push_str(&centrar(&negocio.nombre));
        ticket.push_str("\n");
    } else {
        ticket.push_str(&centrar("TORMEL POS"));
        ticket.push_str("\n");
    }

    if !negocio.nif.is_empty() {
        ticket.push_str(&centrar(&format!("NIF: {}", negocio.nif)));
        ticket.push_str("\n");
    }
    if !negocio.direccion.is_empty() {
        ticket.push_str(&centrar(&negocio.direccion));
        ticket.push_str("\n");
    }
    if !negocio.telefono.is_empty() {
        ticket.push_str(&centrar(&format!("Tlf: {}", negocio.telefono)));
        ticket.push_str("\n");
    }
    
    ticket.push_str(&"-".repeat(width));
    ticket.push_str("\n");
    
    let num_factura = venta.venta.numero.as_deref().unwrap_or("SINFAC");
    let mesa_str = venta.venta.mesa_id.map(|id| id.to_string()).unwrap_or_else(|| "N/A".to_string());
    ticket.push_str(&format!("Mesa ID: {}\n", mesa_str));
    ticket.push_str(&format!("Ref: {}\n", num_factura));
    ticket.push_str(&format!("Fecha: {}\n", venta.venta.abierta_at));
    ticket.push_str(&"-".repeat(width));
    ticket.push_str("\n");
    
    ticket.push_str(&format!("{:<20} {:>5} {:>6} {:>7}\n", "Concepto", "Cant", "P.Unit", "Total"));
    ticket.push_str(&"-".repeat(width));
    ticket.push_str("\n");

    for linea in &venta.lineas {
        let nombre = if linea.producto_nombre.len() > 18 {
            format!("{}..", &linea.producto_nombre[..18])
        } else {
            linea.producto_nombre.clone()
        };
        ticket.push_str(&format!("{:<20} {:>5.1} {:>6.2} {:>7.2}\n", 
            nombre, linea.cantidad, linea.producto_precio, linea.total
        ));
    }
    
    ticket.push_str(&"-".repeat(width));
    ticket.push_str("\n");
    
    ticket.push_str(&format!("{:<25} {:>14.2} €\n", "Subtotal:", venta.venta.subtotal));
    ticket.push_str(&format!("{:<25} {:>14.2} €\n", "IVA:", venta.venta.total_iva));
    ticket.push_str(&format!("{:<25} {:>14.2} €\n", "TOTAL:", venta.venta.total));
    ticket.push_str(&"=".repeat(width));
    ticket.push_str("\n");

    if let Some(ref qr) = venta.venta.qr_data {
        ticket.push_str(&centrar("[ QR AEAT VERI*FACTU ]"));
        ticket.push_str("\n");
        ticket.push_str(qr);
        ticket.push_str("\n\n");
    }

    if let Some(ref huella) = venta.venta.huella_verifactu {
        ticket.push_str(&format!("Huella: {}\n", huella));
    }
    
    ticket.push_str("\n");
    ticket.push_str(&centrar("GRACIAS POR SU VISITA"));
    ticket.push_str("\n");

    ticket
}

/// Genera la secuencia de comandos binarios ESC/POS estándar para enviar a una impresora térmica.
pub fn generar_escpos_bytes(negocio: &Negocio, venta: &VentaCompleta) -> Vec<u8> {
    let mut bytes = Vec::new();

    // 1. Inicializar impresora (ESC @)
    bytes.extend_from_slice(b"\x1b\x40");

    // 2. Alinear al centro (ESC a 1)
    bytes.extend_from_slice(b"\x1b\x61\x01");

    // Doble altura y doble ancho para el título
    bytes.extend_from_slice(b"\x1d\x21\x11");
    bytes.extend_from_slice(b"TORMEL POS\n");
    
    // Volver a tamaño normal
    bytes.extend_from_slice(b"\x1d\x21\x00");
    
    let nombre_negocio = if negocio.nombre.is_empty() { "Establecimiento" } else { &negocio.nombre };
    bytes.extend_from_slice(format!("{}\n", nombre_negocio).as_bytes());
    if !negocio.nif.is_empty() {
        bytes.extend_from_slice(format!("NIF: {}\n", negocio.nif).as_bytes());
    }
    if !negocio.direccion.is_empty() {
        bytes.extend_from_slice(format!("{}\n", negocio.direccion).as_bytes());
    }
    bytes.extend_from_slice(b"\n");

    // Alinear a la izquierda (ESC a 0)
    bytes.extend_from_slice(b"\x1b\x61\x00");
    
    let num_factura = venta.venta.numero.as_deref().unwrap_or("SINFAC");
    let mesa_str = venta.venta.mesa_id.map(|id| id.to_string()).unwrap_or_else(|| "N/A".to_string());
    bytes.extend_from_slice(format!("Mesa ID: {}\n", mesa_str).as_bytes());
    bytes.extend_from_slice(format!("Factura/Ref: {}\n", num_factura).as_bytes());
    bytes.extend_from_slice(format!("Fecha: {}\n", venta.venta.abierta_at).as_bytes());
    bytes.extend_from_slice(b"----------------------------------------\n");

    bytes.extend_from_slice(format!("{:<20} {:>5} {:>6} {:>7}\n", "Concepto", "Cant", "P.Unit", "Total").as_bytes());
    bytes.extend_from_slice(b"----------------------------------------\n");

    for linea in &venta.lineas {
        let nombre = if linea.producto_nombre.len() > 18 {
            format!("{}..", &linea.producto_nombre[..18])
        } else {
            linea.producto_nombre.clone()
        };
        bytes.extend_from_slice(format!("{:<20} {:>5.1} {:>6.2} {:>7.2}\n", 
            nombre, linea.cantidad, linea.producto_precio, linea.total
        ).as_bytes());
    }

    bytes.extend_from_slice(b"----------------------------------------\n");
    bytes.extend_from_slice(format!("{:<25} {:>14.2} EUR\n", "Subtotal:", venta.venta.subtotal).as_bytes());
    bytes.extend_from_slice(format!("{:<25} {:>14.2} EUR\n", "IVA:", venta.venta.total_iva).as_bytes());
    
    // Negrita para el total
    bytes.extend_from_slice(b"\x1b\x45\x01");
    bytes.extend_from_slice(format!("{:<25} {:>14.2} EUR\n", "TOTAL:", venta.venta.total).as_bytes());
    bytes.extend_from_slice(b"\x1b\x45\x00");
    bytes.extend_from_slice(b"========================================\n\n");

    if let Some(ref qr) = venta.venta.qr_data {
        // Alinear al centro para el QR
        bytes.extend_from_slice(b"\x1b\x61\x01");
        bytes.extend_from_slice(b"Factura verificable en AEAT:\n");
        bytes.extend_from_slice(format!("{}\n\n", qr).as_bytes());
    }

    // Alinear al centro y despedida
    bytes.extend_from_slice(b"\x1b\x61\x01");
    bytes.extend_from_slice(b"GRACIAS POR SU VISITA\n\n\n\n");

    // Alimentar papel y cortar (GS V 66 0)
    bytes.extend_from_slice(b"\x1d\x56\x42\x00");

    bytes
}
