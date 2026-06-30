use rusqlite::Connection;

use crate::auth::pin::{hash_pin, validar_pin, verificar_pin};
use crate::error::{AppError, AppResult};
use crate::models::common::Rol;
use crate::models::usuario::{ActualizarUsuario, NuevoUsuario, SesionUsuario, Usuario};
use crate::repositories::evento_repo::EventoRepo;
use crate::repositories::usuario_repo::UsuarioRepo;

/// PIN por defecto del administrador inicial.
pub const PIN_ADMIN_POR_DEFECTO: &str = "111111";

/// Servicio de usuarios — lógica de negocio para gestión y autenticación.
pub struct UsuarioService;

impl UsuarioService {
    /// Autentica un usuario por su ID verificando el PIN. Devuelve la sesión.
    pub fn login(conn: &Connection, usuario_id: i64, pin: &str) -> AppResult<SesionUsuario> {
        let usuario = UsuarioRepo::obtener_por_id(conn, usuario_id)?;

        if !usuario.activo {
            return Err(AppError::UsuarioInactivo);
        }

        // Un hash vacío significa que el usuario no tiene PIN configurado.
        if usuario.pin_hash.is_empty() || !verificar_pin(pin, &usuario.pin_hash)? {
            return Err(AppError::PinInvalido);
        }

        EventoRepo::registrar(
            conn,
            Some(usuario.id),
            "usuario.login",
            "usuario",
            Some(usuario.id),
            None,
        )?;

        // Detectar si el usuario sigue con el PIN por defecto para que la
        // interfaz pueda avisar de que debe cambiarlo.
        let pin_por_defecto = verificar_pin(PIN_ADMIN_POR_DEFECTO, &usuario.pin_hash).unwrap_or(false);

        Ok(SesionUsuario {
            usuario_id: usuario.id,
            nombre: usuario.nombre.clone(),
            rol: usuario.rol.clone(),
            pin_por_defecto,
        })
    }

    /// Crea un nuevo usuario con su PIN.
    pub fn crear(conn: &Connection, datos: NuevoUsuario) -> AppResult<Usuario> {
        // Validar nombre no vacío
        let nombre = datos.nombre.trim();
        if nombre.is_empty() {
            return Err(AppError::Validation("El nombre no puede estar vacío".into()));
        }

        // Validar y hashear el PIN
        validar_pin(&datos.pin)?;
        let pin_hash = hash_pin(&datos.pin)?;

        let id = UsuarioRepo::crear(conn, nombre, &pin_hash, &datos.rol)?;

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

        if let Some(pin) = &datos.pin {
            validar_pin(pin)?;
            let pin_hash = hash_pin(pin)?;
            UsuarioRepo::actualizar_pin(conn, id, &pin_hash)?;
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

    /// Crea el usuario admin inicial (primera ejecución) con el PIN por defecto.
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
                pin: PIN_ADMIN_POR_DEFECTO.to_string(),
            },
        )
    }

    /// Garantiza que todo usuario sin PIN configurado (hash vacío) reciba el PIN
    /// por defecto del administrador (111111). Es idempotente: una vez asignado,
    /// el hash deja de estar vacío y no se vuelve a tocar.
    ///
    /// Esto cubre al administrador sembrado por la migración inicial, asegurando
    /// que todo sistema Tormel tenga al menos un administrador con PIN 111111.
    pub fn asegurar_pins_por_defecto(conn: &Connection) -> AppResult<()> {
        let usuarios = UsuarioRepo::listar(conn, false)?;
        for usuario in usuarios {
            if usuario.pin_hash.is_empty() {
                let pin_hash = hash_pin(PIN_ADMIN_POR_DEFECTO)?;
                UsuarioRepo::actualizar_pin(conn, usuario.id, &pin_hash)?;
            }
        }
        Ok(())
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
        let user = UsuarioService::crear(&conn, NuevoUsuario { nombre: "Juan".to_string(), rol: Rol::Camarero, pin: "1234".to_string() }).unwrap();
        
        let sesion = UsuarioService::login(&conn, user.id, "1234").unwrap();
        assert_eq!(sesion.nombre, "Juan");
        assert_eq!(sesion.rol, Rol::Camarero);
    }

    #[test]
    fn test_login_pin_incorrecto() {
        let conn = setup_db();
        let user = UsuarioService::crear(&conn, NuevoUsuario { nombre: "Juan".to_string(), rol: Rol::Camarero, pin: "1234".to_string() }).unwrap();

        assert!(UsuarioService::login(&conn, user.id, "0000").is_err());
    }

    #[test]
    fn test_admin_inicial_pin_por_defecto() {
        let conn = setup_db();
        let admin = UsuarioService::crear_admin_inicial(&conn, "Admin").unwrap();

        // El administrador inicial debe poder entrar con 111111
        let sesion = UsuarioService::login(&conn, admin.id, PIN_ADMIN_POR_DEFECTO).unwrap();
        assert_eq!(sesion.rol, Rol::Admin);
    }

    #[test]
    fn test_actualizar_y_desactivar() {
        let conn = setup_db();
        let user1 = UsuarioService::crear_admin_inicial(&conn, "Admin").unwrap();
        
        // Crear segundo admin
        let user2 = UsuarioService::crear(&conn, NuevoUsuario { nombre: "Segundo".to_string(), rol: Rol::Admin, pin: "4321".to_string() }).unwrap();
        
        // Desactivar segundo admin debe funcionar
        let act2 = ActualizarUsuario { nombre: None, rol: None, activo: Some(false), pin: None };
        let user2_actualizado = UsuarioService::actualizar(&conn, user2.id, act2).unwrap();
        assert_eq!(user2_actualizado.activo, false);
        
        // Intentar hacer login de inactivo falla
        let login_res = UsuarioService::login(&conn, user2.id, "4321");
        assert!(login_res.is_err());
        
        // Desactivar el último admin debe fallar
        let act1 = ActualizarUsuario { nombre: None, rol: None, activo: Some(false), pin: None };
        let user1_res = UsuarioService::actualizar(&conn, user1.id, act1);
        assert!(user1_res.is_err());
    }
}

