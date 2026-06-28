use serde::{Deserialize, Serialize};
use super::common::{EstadoMesa, FormaMesa};

/// Zona del local (Salón, Terraza, Barra, etc.)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Zona {
    pub id: i64,
    pub nombre: String,
    pub orden: i32,
    pub activa: bool,
    pub created_at: String,
}

/// Mesa del local.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Mesa {
    pub id: i64,
    pub zona_id: i64,
    pub nombre: String,
    pub capacidad: i32,
    pub estado: EstadoMesa,
    pub pos_x: i32,
    pub pos_y: i32,
    pub ancho: i32,
    pub alto: i32,
    pub forma: FormaMesa,
    pub activa: bool,
    pub created_at: String,
    pub updated_at: String,
}

/// DTO para crear/actualizar una zona.
#[derive(Debug, Deserialize)]
pub struct NuevaZona {
    pub nombre: String,
    pub orden: Option<i32>,
}

/// DTO para crear una mesa.
#[derive(Debug, Deserialize)]
pub struct NuevaMesa {
    pub zona_id: i64,
    pub nombre: String,
    pub capacidad: Option<i32>,
    pub pos_x: Option<i32>,
    pub pos_y: Option<i32>,
    pub ancho: Option<i32>,
    pub alto: Option<i32>,
    pub forma: Option<FormaMesa>,
}

/// DTO para actualizar posición de una mesa (drag & drop).
#[derive(Debug, Deserialize)]
pub struct ActualizarPosicionMesa {
    pub pos_x: i32,
    pub pos_y: i32,
}
