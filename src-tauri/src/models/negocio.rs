use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Negocio {
    pub id: i64,
    pub nombre: String,
    pub nif: String,
    pub direccion: String,
    pub codigo_postal: String,
    pub ciudad: String,
    pub provincia: String,
    pub telefono: String,
    pub email: String,
    pub logo_path: Option<String>,
    pub moneda: String,
    pub configuracion: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Deserialize, Debug, Clone)]
pub struct ActualizarNegocio {
    pub nombre: Option<String>,
    pub nif: Option<String>,
    pub direccion: Option<String>,
    pub codigo_postal: Option<String>,
    pub ciudad: Option<String>,
    pub provincia: Option<String>,
    pub telefono: Option<String>,
    pub email: Option<String>,
    pub logo_path: Option<String>,
    pub moneda: Option<String>,
}
