use reqwest::{Client, Identity};
use crate::error::{AppError, AppResult};

/// URL del entorno de pruebas de Alta VeriFactu de la AEAT.
const AEAT_VERIFACTU_PRUEBAS: &str = "https://prewww1.aeat.es/wlpl/TIKE-CONT/ws/SistemaFacturacion/VerifactuAlta";

pub struct VerifactuClient {
    http_client: Client,
    is_produccion: bool,
}

impl VerifactuClient {
    /// Inicializa un cliente configurado con el certificado p12 para autenticación TLS (Mutual TLS).
    pub fn new(p12_bytes: &[u8], password: &str, is_produccion: bool) -> AppResult<Self> {
        let identity = Identity::from_pkcs12_der(p12_bytes, password)
            .map_err(|e| AppError::Interno(format!("Error leyendo certificado P12: {}", e)))?;

        let http_client = Client::builder()
            .identity(identity)
            .danger_accept_invalid_certs(!is_produccion) // Permitir firmas autofirmadas en pruebas si fuese necesario
            .build()
            .map_err(|e| AppError::Interno(format!("Error construyendo cliente HTTP: {}", e)))?;

        Ok(Self {
            http_client,
            is_produccion,
        })
    }

    /// Envía el XML de alta a la AEAT y devuelve la respuesta en bruto.
    pub async fn enviar_alta(&self, xml_payload: &str) -> AppResult<String> {
        let url = if self.is_produccion {
            // TODO: Reemplazar por la URL de producción cuando se ponga en marcha
            AEAT_VERIFACTU_PRUEBAS
        } else {
            AEAT_VERIFACTU_PRUEBAS
        };

        let response = self.http_client
            .post(url)
            .header("Content-Type", "text/xml;charset=UTF-8")
            // Acción SOAP (SOAPAction a veces requerida por WSDL antiguo, aunque en REST/SOAP moderno a veces no. 
            // Se puede inyectar según especificación si da error)
            .header("SOAPAction", "AltaRegistroFacturacion") 
            .body(xml_payload.to_string())
            .send()
            .await
            .map_err(|e| AppError::Interno(format!("Error enviando petición a AEAT: {}", e)))?;

        let status = response.status();
        let text = response.text().await
            .map_err(|e| AppError::Interno(format!("Error leyendo respuesta AEAT: {}", e)))?;

        if !status.is_success() {
            // El servidor devolvió un error HTTP (ej: 500 Internal Server Error, común en SOAP Faults)
            return Err(AppError::Interno(format!("Fallo AEAT (Status {}): {}", status, text)));
        }

        // Si es 200 OK, la AEAT ha procesado el XML, pero podría haber un "Rechazo" dentro del cuerpo XML.
        // La validación del cuerpo de respuesta dependerá de la lógica de aplicación.
        Ok(text)
    }
}
