use crate::error::{AppError, AppResult};
use crate::models::common::Rol;

/// Permisos del sistema POS.
/// Cada permiso se mapea a una acción específica del negocio.
#[derive(Debug, Clone, PartialEq)]
pub enum Permiso {
    // Ventas
    VentaCrear,
    VentaCobrar,
    VentaAnular,
    VentaDescuento,

    // Caja
    CajaAbrir,
    CajaCerrar,
    CajaMovimiento,

    // Productos
    ProductoGestionar,

    // Clientes
    ClienteGestionar,

    // Usuarios
    UsuarioGestionar,

    // Informes
    InformesVer,

    // Configuración
    ConfiguracionSistema,
}

impl Permiso {
    /// Devuelve los roles que tienen este permiso.
    fn roles_permitidos(&self) -> &[Rol] {
        match self {
            // Todos pueden crear y cobrar ventas
            Permiso::VentaCrear | Permiso::VentaCobrar => {
                &[Rol::Admin, Rol::Encargado, Rol::Camarero]
            }

            // Admin y encargado pueden anular, aplicar descuentos, gestionar caja
            Permiso::VentaAnular
            | Permiso::VentaDescuento
            | Permiso::CajaAbrir
            | Permiso::CajaCerrar
            | Permiso::CajaMovimiento
            | Permiso::ProductoGestionar
            | Permiso::ClienteGestionar
            | Permiso::InformesVer => &[Rol::Admin, Rol::Encargado],

            // Solo admin puede gestionar usuarios y configuración
            Permiso::UsuarioGestionar | Permiso::ConfiguracionSistema => &[Rol::Admin],
        }
    }
}

/// Verifica si un rol tiene un permiso específico.
pub fn tiene_permiso(rol: &Rol, permiso: &Permiso) -> bool {
    permiso.roles_permitidos().contains(rol)
}

/// Requiere que el rol tenga un permiso. Devuelve error si no.
pub fn requerir_permiso(rol: &Rol, permiso: &Permiso) -> AppResult<()> {
    if tiene_permiso(rol, permiso) {
        Ok(())
    } else {
        Err(AppError::PermisoDenegado(format!(
            "El rol {:?} no tiene permiso para {:?}",
            rol, permiso
        )))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_camarero_puede_crear_venta() {
        assert!(tiene_permiso(&Rol::Camarero, &Permiso::VentaCrear));
    }

    #[test]
    fn test_camarero_no_puede_anular() {
        assert!(!tiene_permiso(&Rol::Camarero, &Permiso::VentaAnular));
    }

    #[test]
    fn test_admin_puede_todo() {
        assert!(tiene_permiso(&Rol::Admin, &Permiso::UsuarioGestionar));
        assert!(tiene_permiso(&Rol::Admin, &Permiso::ConfiguracionSistema));
        assert!(tiene_permiso(&Rol::Admin, &Permiso::VentaCrear));
    }

    #[test]
    fn test_encargado_no_puede_gestionar_usuarios() {
        assert!(!tiene_permiso(&Rol::Encargado, &Permiso::UsuarioGestionar));
    }
}
