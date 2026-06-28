use crate::models::venta::VentaCompleta;
use chrono::DateTime;
use quick_xml::escape::escape;

/// Construye el payload XML SOAP para la llamada VerifactuAlta.
pub fn build_alta_factura_xml(
    nif_emisor: &str,
    nombre_razon_social: &str,
    venta: &VentaCompleta,
    hash_registro: &str,
    fecha_hora_huso: &str, // ej: 2026-06-28T23:19:38+02:00
) -> String {
    // Escape de campos para prevenir inyección XML
    let nif = escape(nif_emisor);
    let razon_social = escape(nombre_razon_social);
    let num_factura = escape(venta.venta.numero.as_deref().unwrap_or("SINFAC"));
    
    // Parseo de fechas
    let fecha_expedicion = if let Ok(dt) = DateTime::parse_from_rfc3339(&venta.venta.abierta_at) {
        dt.format("%d-%m-%Y").to_string()
    } else {
        "01-01-2000".to_string()
    };
    
    let tipo_factura = if venta.venta.tipo.as_str() == "llevar" || venta.venta.cliente_id.is_some() {
        "F1" // Factura normal
    } else {
        "F2" // Factura simplificada (Ticket)
    };

    let cuota_total = format!("{:.2}", venta.venta.total_iva);
    let importe_total = format!("{:.2}", venta.venta.total);

    // Formatear el XML SOAP Envelope
    // Basado en el WSDL de VeriFactu - Suministro de Alta
    format!(
        r#"<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
    xmlns:sif="https://www2.agenciatributaria.gob.es/static_files/common/internet/dep/aplicaciones/es/aeat/tike/cont/ws/SuministroLR.xsd"
    xmlns:sif1="https://www2.agenciatributaria.gob.es/static_files/common/internet/dep/aplicaciones/es/aeat/tike/cont/ws/SuministroInformacion.xsd">
    <soapenv:Header/>
    <soapenv:Body>
        <sif:AltaRegistroFacturacion>
            <sif1:Cabecera>
                <sif1:ObligadoEmision>
                    <sif1:NombreRazon>{razon_social}</sif1:NombreRazon>
                    <sif1:NIF>{nif}</sif1:NIF>
                </sif1:ObligadoEmision>
            </sif1:Cabecera>
            <sif:RegistroFacturacion>
                <sif1:RegistroAlta>
                    <sif1:IDVersion>1.0</sif1:IDVersion>
                    <sif1:SistemaInformatico>
                        <sif1:NombreRazon>Tormel POS</sif1:NombreRazon>
                        <sif1:NIF>B12345678</sif1:NIF>
                        <sif1:IdSistemaInformatico>01</sif1:IdSistemaInformatico>
                        <sif1:Version>0.1.0</sif1:Version>
                        <sif1:NumeroInstalacion>1</sif1:NumeroInstalacion>
                        <sif1:TipoUsoPosibleSoloVerifactu>S</sif1:TipoUsoPosibleSoloVerifactu>
                        <sif1:TipoUsoPosibleMulti>N</sif1:TipoUsoPosibleMulti>
                        <sif1:IndicadorMultiplesOT>S</sif1:IndicadorMultiplesOT>
                    </sif1:SistemaInformatico>
                    <sif1:FechaHoraHusoGenRegistro>{fecha_hora_huso}</sif1:FechaHoraHusoGenRegistro>
                    <sif1:TipoRegistroSIF>S0</sif1:TipoRegistroSIF>
                    <sif1:EstadoRegistro>Correcto</sif1:EstadoRegistro>
                </sif1:RegistroAlta>
                <sif:Factura>
                    <sif1:CabeceraFactura>
                        <sif1:NumSerieFactura>{num_factura}</sif1:NumSerieFactura>
                        <sif1:FechaExpedicionFactura>{fecha_expedicion}</sif1:FechaExpedicionFactura>
                    </sif1:CabeceraFactura>
                    <sif1:TipoFactura>{tipo_factura}</sif1:TipoFactura>
                    <sif1:CuotaTotal>{cuota_total}</sif1:CuotaTotal>
                    <sif1:ImporteTotal>{importe_total}</sif1:ImporteTotal>
                </sif:Factura>
                <sif:Huella>
                    <sif1:HuellaRegistro>{hash_registro}</sif1:HuellaRegistro>
                </sif:Huella>
            </sif:RegistroFacturacion>
        </sif:AltaRegistroFacturacion>
    </soapenv:Body>
</soapenv:Envelope>"#,
        razon_social = razon_social,
        nif = nif,
        fecha_hora_huso = fecha_hora_huso,
        num_factura = num_factura,
        fecha_expedicion = fecha_expedicion,
        tipo_factura = tipo_factura,
        cuota_total = cuota_total,
        importe_total = importe_total,
        hash_registro = hash_registro
    )
}
