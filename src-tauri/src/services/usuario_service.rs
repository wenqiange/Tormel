use rusqlite::Connection;

use crate::error::{AppError, AppResult};
use crate::models::common::Rol;
use crate::models::usuario::{ActualizarUsuario, NuevoUsuario, SesionUsuario, Usuario};
use crate::repositories::evento_repo::EventoRepo;
use crate::repositories::usuario_repo::UsuarioRepo;

/// Servicio de usuarios — lógica de negocio para gestión y autenticación.
pub struct UsuarioService;

impl UsuarioService {
    /// Autentica un usuario directamente por su ID. Devuelve la sesión.
    pub fn login(conn: &Connection, usuario_id: i64) -> AppResult<SesionUsuario> {
        let usuario = UsuarioRepo::obtener_por_id(conn, usuario_id)?;

        if !usuario.activo {
            return Err(AppError::UsuarioInactivo);
        }

        EventoRepo::registrar(
            conn,
            Some(usuario.id),
            "usuario.login",
            "usuario",
            Some(usuario.id),
            None,
        )?;

        Ok(SesionUsuario {
            usuario_id: usuario.id,
            nombre: usuario.nombre.clone(),
            rol: usuario.rol.clone(),
        })
    }

    /// Crea un nuevo usuario sin PIN.
    pub fn crear(conn: &Connection, datos: NuevoUsuario) -> AppResult<Usuario> {
        // Validar nombre no vacío
        let nombre = datos.nombre.trim();
        if nombre.is_empty() {
            return Err(AppError::Validation("El nombre no puede estar vacío".into()));
        }

        // Insertar (con hash vacío en BD)
        let id = UsuarioRepo::crear(conn, nombre, "", &datos.rol)?;

        EventoRepo::registrar(
            conn,
            None,
            "usuario.creado",
            "usuario",
            Some(id),
            Some(&format!("{{\"nombre\":\"{}\",\"rol\":\"{}\"}}", nombre, datos.rol.as_str())),
        )?;

        UsuarioRepo::obtener_por_id(conn, id)
    }

    /// Actualiza un usuario existente.
    pub fn actualizar(conn: &Connection, id: i64, datos: ActualizarUsuario) -> AppResult<Usuario> {
        // Verificar que el usuario existe
        let _usuario = UsuarioRepo::obtener_por_id(conn, id)?;

        if let Some(nombre) = &datos.nombre {
            let nombre = nombre.trim();
            if nombre.is_empty() {
                return Err(AppError::Validation("El nombre no puede estar vacío".into()));
            }
            UsuarioRepo::actualizar_nombre(conn, id, nombre)?;
        }

        if let Some(rol) = &datos.rol {
            UsuarioRepo::actualizar_rol(conn, id, rol)?;
        }

        if let Some(activo) = datos.activo {
            // No permitir desactivar el último admin
            if !activo {
                let usuario = UsuarioRepo::obtener_por_id(conn, id)?;
                if usuario.rol == Rol::Admin {
                    let admins = UsuarioRepo::contar_admins_activos(conn)?;
                    if admins <= 1 {
                        return Err(AppError::Validation(
                            "No se puede desactivar el último administrador".into(),
                        ));
                    }
                }
            }
            UsuarioRepo::set_activo(conn, id, activo)?;
        }

        EventoRepo::registrar(
            conn,
            None,
            "usuario.actualizado",
            "usuario",
            Some(id),
            None,
        )?;

        UsuarioRepo::obtener_por_id(conn, id)
    }

    /// Lista todos los usuarios.
    pub fn listar(conn: &Connection, solo_activos: bool) -> AppResult<Vec<Usuario>> {
        UsuarioRepo::listar(conn, solo_activos)
    }

    /// Obtiene un usuario por ID.
    pub fn obtener(conn: &Connection, id: i64) -> AppResult<Usuario> {
        UsuarioRepo::obtener_por_id(conn, id)
    }

    /// Verifica si es la primera ejecución (no hay usuarios).
    pub fn es_primera_ejecucion(conn: &Connection) -> AppResult<bool> {
        let existe = UsuarioRepo::existe_alguno(conn)?;
        Ok(!existe)
    }

    /// Crea el usuario admin inicial (primera ejecución).
    pub fn crear_admin_inicial(conn: &Connection, nombre: &str) -> AppResult<Usuario> {
        // Solo permitir si no hay usuarios
        if UsuarioRepo::existe_alguno(conn)? {
            return Err(AppError::Validation(
                "Ya existen usuarios en el sistema".into(),
            ));
        }

        Self::crear(
            conn,
            NuevoUsuario {
                nombre: nombre.to_string(),
                rol: Rol::Admin,
            },
        )
    }
}
