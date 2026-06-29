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

#[cfg(test)]
mod tests {
    use super::*;
    use rusqlite::Connection;

    fn setup_db() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        // Crear tablas necesarias mínimas para el test de usuarios
        conn.execute_batch(
            "CREATE TABLE usuario (id INTEGER PRIMARY KEY, nombre TEXT, pin_hash TEXT, rol TEXT, activo INTEGER DEFAULT 1, created_at TEXT DEFAULT CURRENT_TIMESTAMP, updated_at TEXT DEFAULT CURRENT_TIMESTAMP);
             CREATE TABLE evento_sistema (id INTEGER PRIMARY KEY, usuario_id INTEGER, tipo TEXT, entidad TEXT, entidad_id INTEGER, detalle TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP);"
        ).unwrap();
        conn
    }

    #[test]
    fn test_crear_admin_inicial() {
        let conn = setup_db();
        let admin = UsuarioService::crear_admin_inicial(&conn, "Admin").unwrap();
        
        assert_eq!(admin.nombre, "Admin");
        assert_eq!(admin.rol, Rol::Admin);
        
        // No debe permitir crear otro si ya existe
        let result = UsuarioService::crear_admin_inicial(&conn, "Admin 2");
        assert!(result.is_err());
    }

    #[test]
    fn test_login_exitoso() {
        let conn = setup_db();
        let user = UsuarioService::crear(&conn, NuevoUsuario { nombre: "Juan".to_string(), rol: Rol::Camarero }).unwrap();
        
        let sesion = UsuarioService::login(&conn, user.id).unwrap();
        assert_eq!(sesion.nombre, "Juan");
        assert_eq!(sesion.rol, Rol::Camarero);
    }
    
    #[test]
    fn test_actualizar_y_desactivar() {
        let conn = setup_db();
        let user1 = UsuarioService::crear_admin_inicial(&conn, "Admin").unwrap();
        
        // Crear segundo admin
        let user2 = UsuarioService::crear(&conn, NuevoUsuario { nombre: "Segundo".to_string(), rol: Rol::Admin }).unwrap();
        
        // Desactivar segundo admin debe funcionar
        let act2 = ActualizarUsuario { nombre: None, rol: None, activo: Some(false) };
        let user2_actualizado = UsuarioService::actualizar(&conn, user2.id, act2).unwrap();
        assert_eq!(user2_actualizado.activo, false);
        
        // Intentar hacer login de inactivo falla
        let login_res = UsuarioService::login(&conn, user2.id);
        assert!(login_res.is_err());
        
        // Desactivar el último admin debe fallar
        let act1 = ActualizarUsuario { nombre: None, rol: None, activo: Some(false) };
        let user1_res = UsuarioService::actualizar(&conn, user1.id, act1);
        assert!(user1_res.is_err());
    }
}

