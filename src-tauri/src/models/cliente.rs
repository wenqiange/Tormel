use serde::{Deserialize, Serialize};

/// Cliente (para facturación nominativa).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Cliente {
    pub id: i64,
    pub nombre: String,
    pub nif_cif: Option<String>,
    pub direccion: Option<String>,
    pub codigo_postal: Option<String>,
    pub ciudad: Option<String>,
    pub provincia: Option<String>,
    pub telefono: Option<String>,
    pub email: Option<String>,
    pub notas: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

// ── DTOs ──

/// DTO para crear un nuevo cliente.
#[derive(Debug, Deserialize)]
pub struct NuevoCliente {
    pub nombre: String,
    pub nif_cif: Option<String>,
    pub direccion: Option<String>,
    pub codigo_postal: Option<String>,
    pub ciudad: Option<String>,
    pub provincia: Option<String>,
    pub telefono: Option<String>,
    pub email: Option<String>,
    pub notas: Option<String>,
}

/// DTO para actualizar un cliente.
#[derive(Debug, Deserialize)]
pub struct ActualizarCliente {
    pub nombre: Option<String>,
    pub nif_cif: Option<String>,
    pub direccion: Option<String>,
    pub codigo_postal: Option<String>,
    pub ciudad: Option<String>,
    pub provincia: Option<String>,
    pub telefono: Option<String>,
    pub email: Option<String>,
    pub notas: Option<String>,
}
