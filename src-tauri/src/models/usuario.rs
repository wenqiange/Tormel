use serde::{Deserialize, Serialize};
use super::common::Rol;

/// Usuario del sistema POS.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Usuario {
    pub id: i64,
    pub nombre: String,
    #[serde(skip_serializing)]
    pub pin_hash: String,
    pub rol: Rol,
    pub activo: bool,
    pub created_at: String,
    pub updated_at: String,
}

/// DTO para crear un nuevo usuario.
#[derive(Debug, Deserialize)]
pub struct NuevoUsuario {
    pub nombre: String,
    pub rol: Rol,
}

/// DTO para actualizar un usuario.
#[derive(Debug, Deserialize)]
pub struct ActualizarUsuario {
    pub nombre: Option<String>,
    pub rol: Option<Rol>,
    pub activo: Option<bool>,
}

/// Respuesta de autenticación.
#[derive(Debug, Clone, Serialize)]
pub struct SesionUsuario {
    pub usuario_id: i64,
    pub nombre: String,
    pub rol: Rol,
}
