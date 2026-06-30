use serde::{Deserialize, Serialize};

/// Familia (categoría) de productos.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Familia {
    pub id: i64,
    pub nombre: String,
    pub familia_padre_id: Option<i64>,
    pub orden: i32,
    pub color: String,
    pub icono: Option<String>,
    pub activa: bool,
    pub created_at: String,
}

/// Producto del catálogo.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Producto {
    pub id: i64,
    pub familia_id: i64,
    pub nombre: String,
    pub codigo: Option<String>,
    /// PVP (IVA incluido) en céntimos.
    pub precio: i64,
    pub tipo_iva: f64,
    pub imagen_path: Option<String>,
    pub activo: bool,
    pub orden: i32,
    pub created_at: String,
    pub updated_at: String,
}

/// Grupo de modificadores (ej: "Tamaño", "Extras").
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModificadorGrupo {
    pub id: i64,
    pub nombre: String,
    pub obligatorio: bool,
    pub min_seleccion: i32,
    pub max_seleccion: i32,
    pub activo: bool,
    pub created_at: String,
}

/// Modificador individual (ej: "Grande", "Sin hielo").
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Modificador {
    pub id: i64,
    pub grupo_id: i64,
    pub nombre: String,
    /// Suplemento (IVA incluido) en céntimos.
    pub precio_extra: i64,
    pub orden: i32,
    pub activo: bool,
    pub created_at: String,
}

// ── DTOs ──

#[derive(Debug, Deserialize)]
pub struct NuevaFamilia {
    pub nombre: String,
    pub familia_padre_id: Option<i64>,
    pub orden: Option<i32>,
    pub color: Option<String>,
    pub icono: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct NuevoProducto {
    pub familia_id: i64,
    pub nombre: String,
    pub codigo: Option<String>,
    /// PVP (IVA incluido) en céntimos.
    pub precio: i64,
    pub tipo_iva: f64,
    pub imagen_path: Option<String>,
    pub orden: Option<i32>,
}

#[derive(Debug, Deserialize)]
pub struct ActualizarProducto {
    pub nombre: Option<String>,
    pub familia_id: Option<i64>,
    pub codigo: Option<String>,
    /// PVP (IVA incluido) en céntimos.
    pub precio: Option<i64>,
    pub tipo_iva: Option<f64>,
    pub imagen_path: Option<String>,
    pub activo: Option<bool>,
    pub orden: Option<i32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GrupoModificadoresConElementos {
    pub grupo: ModificadorGrupo,
    pub elementos: Vec<Modificador>,
}

