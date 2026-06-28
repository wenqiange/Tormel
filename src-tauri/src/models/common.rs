use serde::{Deserialize, Serialize};

// ============================================================================
// Enums compartidos del dominio
// ============================================================================

/// Rol de un usuario del sistema.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum Rol {
    Admin,
    Encargado,
    Camarero,
}

impl Rol {
    pub fn as_str(&self) -> &'static str {
        match self {
            Rol::Admin => "admin",
            Rol::Encargado => "encargado",
            Rol::Camarero => "camarero",
        }
    }

    pub fn from_str(s: &str) -> Option<Self> {
        match s {
            "admin" => Some(Rol::Admin),
            "encargado" => Some(Rol::Encargado),
            "camarero" => Some(Rol::Camarero),
            _ => None,
        }
    }
}

/// Estado de una mesa.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum EstadoMesa {
    Libre,
    Ocupada,
    Reservada,
    PorCobrar,
}

impl EstadoMesa {
    pub fn as_str(&self) -> &'static str {
        match self {
            EstadoMesa::Libre => "libre",
            EstadoMesa::Ocupada => "ocupada",
            EstadoMesa::Reservada => "reservada",
            EstadoMesa::PorCobrar => "por_cobrar",
        }
    }

    pub fn from_str(s: &str) -> Option<Self> {
        match s {
            "libre" => Some(EstadoMesa::Libre),
            "ocupada" => Some(EstadoMesa::Ocupada),
            "reservada" => Some(EstadoMesa::Reservada),
            "por_cobrar" => Some(EstadoMesa::PorCobrar),
            _ => None,
        }
    }
}

/// Tipo de venta.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum TipoVenta {
    Mesa,
    Barra,
    Llevar,
}

impl TipoVenta {
    pub fn as_str(&self) -> &'static str {
        match self {
            TipoVenta::Mesa => "mesa",
            TipoVenta::Barra => "barra",
            TipoVenta::Llevar => "llevar",
        }
    }

    pub fn from_str(s: &str) -> Option<Self> {
        match s {
            "mesa" => Some(TipoVenta::Mesa),
            "barra" => Some(TipoVenta::Barra),
            "llevar" => Some(TipoVenta::Llevar),
            _ => None,
        }
    }
}

/// Estado de una venta.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum EstadoVenta {
    Abierta,
    Cobrada,
    Anulada,
}

impl EstadoVenta {
    pub fn as_str(&self) -> &'static str {
        match self {
            EstadoVenta::Abierta => "abierta",
            EstadoVenta::Cobrada => "cobrada",
            EstadoVenta::Anulada => "anulada",
        }
    }

    pub fn from_str(s: &str) -> Option<Self> {
        match s {
            "abierta" => Some(EstadoVenta::Abierta),
            "cobrada" => Some(EstadoVenta::Cobrada),
            "anulada" => Some(EstadoVenta::Anulada),
            _ => None,
        }
    }
}

/// Método de pago.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum MetodoPago {
    Efectivo,
    Tarjeta,
    Otro,
}

impl MetodoPago {
    pub fn as_str(&self) -> &'static str {
        match self {
            MetodoPago::Efectivo => "efectivo",
            MetodoPago::Tarjeta => "tarjeta",
            MetodoPago::Otro => "otro",
        }
    }

    pub fn from_str(s: &str) -> Option<Self> {
        match s {
            "efectivo" => Some(MetodoPago::Efectivo),
            "tarjeta" => Some(MetodoPago::Tarjeta),
            "otro" => Some(MetodoPago::Otro),
            _ => None,
        }
    }
}

/// Estado del turno de caja.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum EstadoTurno {
    Abierto,
    Cerrado,
}

impl EstadoTurno {
    pub fn as_str(&self) -> &'static str {
        match self {
            EstadoTurno::Abierto => "abierto",
            EstadoTurno::Cerrado => "cerrado",
        }
    }

    pub fn from_str(s: &str) -> Option<Self> {
        match s {
            "abierto" => Some(EstadoTurno::Abierto),
            "cerrado" => Some(EstadoTurno::Cerrado),
            _ => None,
        }
    }
}

/// Tipo de movimiento de caja.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum TipoMovimiento {
    Entrada,
    Salida,
}

impl TipoMovimiento {
    pub fn as_str(&self) -> &'static str {
        match self {
            TipoMovimiento::Entrada => "entrada",
            TipoMovimiento::Salida => "salida",
        }
    }

    pub fn from_str(s: &str) -> Option<Self> {
        match s {
            "entrada" => Some(TipoMovimiento::Entrada),
            "salida" => Some(TipoMovimiento::Salida),
            _ => None,
        }
    }
}

/// Tipos de IVA vigentes en España.
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
pub enum TipoIva {
    Exento,         // 0%
    SuperReducido,  // 4%
    Reducido,       // 10%
    General,        // 21%
}

impl TipoIva {
    pub fn porcentaje(&self) -> f64 {
        match self {
            TipoIva::Exento => 0.0,
            TipoIva::SuperReducido => 4.0,
            TipoIva::Reducido => 10.0,
            TipoIva::General => 21.0,
        }
    }

    pub fn from_porcentaje(p: f64) -> Option<Self> {
        match p as i32 {
            0 => Some(TipoIva::Exento),
            4 => Some(TipoIva::SuperReducido),
            10 => Some(TipoIva::Reducido),
            21 => Some(TipoIva::General),
            _ => None,
        }
    }
}

/// Estado de envío a Verifactu.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum EstadoEnvioVerifactu {
    Pendiente,
    Enviando,
    Enviado,
    Error,
}

impl EstadoEnvioVerifactu {
    pub fn as_str(&self) -> &'static str {
        match self {
            EstadoEnvioVerifactu::Pendiente => "pendiente",
            EstadoEnvioVerifactu::Enviando => "enviando",
            EstadoEnvioVerifactu::Enviado => "enviado",
            EstadoEnvioVerifactu::Error => "error",
        }
    }

    pub fn from_str(s: &str) -> Option<Self> {
        match s {
            "pendiente" => Some(EstadoEnvioVerifactu::Pendiente),
            "enviando" => Some(EstadoEnvioVerifactu::Enviando),
            "enviado" => Some(EstadoEnvioVerifactu::Enviado),
            "error" => Some(EstadoEnvioVerifactu::Error),
            _ => None,
        }
    }
}

/// Forma de una mesa en la planta.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum FormaMesa {
    Rectangular,
    Circular,
}

impl FormaMesa {
    pub fn as_str(&self) -> &'static str {
        match self {
            FormaMesa::Rectangular => "rectangular",
            FormaMesa::Circular => "circular",
        }
    }

    pub fn from_str(s: &str) -> Option<Self> {
        match s {
            "rectangular" => Some(FormaMesa::Rectangular),
            "circular" => Some(FormaMesa::Circular),
            _ => None,
        }
    }
}
