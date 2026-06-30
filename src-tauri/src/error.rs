use thiserror::Error;

/// Error unificado de Tormel POS.
/// Todos los errores del backend se canalizan a través de este tipo.
#[derive(Debug, Error)]
pub enum AppError {
    // --- Base de datos ---
    #[error("Error de base de datos: {0}")]
    Database(#[from] rusqlite::Error),

    // --- Validación ---
    #[error("Error de validación: {0}")]
    Validation(String),

    // --- Autenticación ---
    #[error("PIN incorrecto")]
    PinInvalido,

    #[error("Usuario no encontrado")]
    UsuarioNoEncontrado,

    #[error("Usuario inactivo")]
    UsuarioInactivo,

    #[error("No hay ninguna sesión activa. Inicie sesión.")]
    NoAutenticado,

    #[error("Demasiados intentos fallidos. Espere {0} segundos e inténtelo de nuevo.")]
    DemasiadosIntentos(u64),

    #[error("Permiso denegado: {0}")]
    PermisoDenegado(String),

    // --- Negocio ---
    #[error("No existe: {0}")]
    NoEncontrado(String),

    #[error("Estado inválido: {0}")]
    EstadoInvalido(String),

    #[error("Caja no abierta. Abra un turno antes de operar.")]
    CajaNoAbierta,

    #[error("Ya existe un turno de caja abierto")]
    TurnoYaAbierto,

    // --- Verifactu ---
    #[error("Error de Verifactu: {0}")]
    Verifactu(String),

    // --- Impresión ---
    #[error("Error de impresión: {0}")]
    Impresion(String),

    // --- Serialización ---
    #[error("Error de serialización: {0}")]
    Serializacion(#[from] serde_json::Error),

    // --- Genérico ---
    #[error("{0}")]
    Interno(String),
}

/// Implementación para que Tauri pueda serializar el error como string al frontend.
impl serde::Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

/// Alias de Result con AppError.
pub type AppResult<T> = Result<T, AppError>;
