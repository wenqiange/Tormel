use rusqlite::{params, Connection};

use crate::error::{AppError, AppResult};
use crate::models::common::Rol;
use crate::models::usuario::Usuario;

/// Repositorio de usuarios — acceso a datos en SQLite.
pub struct UsuarioRepo;

impl UsuarioRepo {
    /// Obtiene todos los usuarios (opcionalmente solo activos).
    pub fn listar(conn: &Connection, solo_activos: bool) -> AppResult<Vec<Usuario>> {
        let sql = if solo_activos {
            "SELECT id, nombre, pin_hash, rol, activo, created_at, updated_at
             FROM usuario WHERE activo = 1 ORDER BY nombre"
        } else {
            "SELECT id, nombre, pin_hash, rol, activo, created_at, updated_at
             FROM usuario ORDER BY nombre"
        };

        let mut stmt = conn.prepare(sql)?;
        let usuarios = stmt
            .query_map([], |row| {
                Ok(Usuario {
                    id: row.get(0)?,
                    nombre: row.get(1)?,
                    pin_hash: row.get(2)?,
                    rol: Rol::from_str(&row.get::<_, String>(3)?).unwrap_or(Rol::Camarero),
                    activo: row.get(4)?,
                    created_at: row.get(5)?,
                    updated_at: row.get(6)?,
                })
            })?
            .collect::<Result<Vec<_>, _>>()?;

        Ok(usuarios)
    }

    /// Obtiene un usuario por ID.
    pub fn obtener_por_id(conn: &Connection, id: i64) -> AppResult<Usuario> {
        conn.query_row(
            "SELECT id, nombre, pin_hash, rol, activo, created_at, updated_at
             FROM usuario WHERE id = ?1",
            [id],
            |row| {
                Ok(Usuario {
                    id: row.get(0)?,
                    nombre: row.get(1)?,
                    pin_hash: row.get(2)?,
                    rol: Rol::from_str(&row.get::<_, String>(3)?).unwrap_or(Rol::Camarero),
                    activo: row.get(4)?,
                    created_at: row.get(5)?,
                    updated_at: row.get(6)?,
                })
            },
        )
        .map_err(|_| AppError::UsuarioNoEncontrado)
    }

    /// Crea un nuevo usuario. Devuelve el ID asignado.
    pub fn crear(conn: &Connection, nombre: &str, pin_hash: &str, rol: &Rol) -> AppResult<i64> {
        conn.execute(
            "INSERT INTO usuario (nombre, pin_hash, rol) VALUES (?1, ?2, ?3)",
            params![nombre, pin_hash, rol.as_str()],
        )?;

        Ok(conn.last_insert_rowid())
    }

    /// Actualiza el nombre de un usuario.
    pub fn actualizar_nombre(conn: &Connection, id: i64, nombre: &str) -> AppResult<()> {
        let rows = conn.execute(
            "UPDATE usuario SET nombre = ?1 WHERE id = ?2",
            params![nombre, id],
        )?;
        if rows == 0 {
            return Err(AppError::UsuarioNoEncontrado);
        }
        Ok(())
    }

    /// Actualiza el PIN hasheado de un usuario.
    pub fn actualizar_pin(conn: &Connection, id: i64, pin_hash: &str) -> AppResult<()> {
        let rows = conn.execute(
            "UPDATE usuario SET pin_hash = ?1 WHERE id = ?2",
            params![pin_hash, id],
        )?;
        if rows == 0 {
            return Err(AppError::UsuarioNoEncontrado);
        }
        Ok(())
    }

    /// Actualiza el rol de un usuario.
    pub fn actualizar_rol(conn: &Connection, id: i64, rol: &Rol) -> AppResult<()> {
        let rows = conn.execute(
            "UPDATE usuario SET rol = ?1 WHERE id = ?2",
            params![rol.as_str(), id],
        )?;
        if rows == 0 {
            return Err(AppError::UsuarioNoEncontrado);
        }
        Ok(())
    }

    /// Activa o desactiva un usuario.
    pub fn set_activo(conn: &Connection, id: i64, activo: bool) -> AppResult<()> {
        let rows = conn.execute(
            "UPDATE usuario SET activo = ?1 WHERE id = ?2",
            params![activo, id],
        )?;
        if rows == 0 {
            return Err(AppError::UsuarioNoEncontrado);
        }
        Ok(())
    }

    /// Cuenta cuántos administradores activos hay.
    pub fn contar_admins_activos(conn: &Connection) -> AppResult<i64> {
        let count: i64 = conn.query_row(
            "SELECT COUNT(*) FROM usuario WHERE rol = 'admin' AND activo = 1",
            [],
            |row| row.get(0),
        )?;
        Ok(count)
    }

    /// Verifica si existe algún usuario en el sistema.
    pub fn existe_alguno(conn: &Connection) -> AppResult<bool> {
        let count: i64 = conn.query_row(
            "SELECT COUNT(*) FROM usuario",
            [],
            |row| row.get(0),
        )?;
        Ok(count > 0)
    }
}
