use rusqlite::Connection;
use crate::error::{AppError, AppResult};
use crate::models::producto::{Familia, Producto};

/// Repositorio de productos — acceso a datos en SQLite.
pub struct ProductoRepo;

impl ProductoRepo {
    /// Obtiene todas las familias de productos activas ordenadas.
    pub fn listar_familias(conn: &Connection) -> AppResult<Vec<Familia>> {
        let mut stmt = conn.prepare(
            "SELECT id, nombre, familia_padre_id, orden, color, icono, activa, created_at 
             FROM familia WHERE activa = 1 ORDER BY orden"
        )?;
        let familias = stmt.query_map([], |row| {
            Ok(Familia {
                id: row.get(0)?,
                nombre: row.get(1)?,
                familia_padre_id: row.get(2)?,
                orden: row.get(3)?,
                color: row.get(4)?,
                icono: row.get(5)?,
                activa: row.get::<_, i32>(6)? != 0,
                created_at: row.get(7)?,
            })
        })?.collect::<Result<Vec<_>, _>>()?;
        Ok(familias)
    }

    /// Obtiene todos los productos activos.
    pub fn listar_productos(conn: &Connection) -> AppResult<Vec<Producto>> {
        let mut stmt = conn.prepare(
            "SELECT id, familia_id, nombre, codigo, precio, tipo_iva, imagen_path, activo, orden, created_at, updated_at
             FROM producto WHERE activo = 1 ORDER BY orden"
        )?;
        let productos = stmt.query_map([], |row| {
            Ok(Producto {
                id: row.get(0)?,
                familia_id: row.get(1)?,
                nombre: row.get(2)?,
                codigo: row.get(3)?,
                precio: row.get(4)?,
                tipo_iva: row.get(5)?,
                imagen_path: row.get(6)?,
                activo: row.get::<_, i32>(7)? != 0,
                orden: row.get(8)?,
                created_at: row.get(9)?,
                updated_at: row.get(10)?,
            })
        })?.collect::<Result<Vec<_>, _>>()?;
        Ok(productos)
    }

    /// Obtiene un producto por su ID.
    pub fn obtener_por_id(conn: &Connection, id: i64) -> AppResult<Producto> {
        conn.query_row(
            "SELECT id, familia_id, nombre, codigo, precio, tipo_iva, imagen_path, activo, orden, created_at, updated_at
             FROM producto WHERE id = ?1",
            [id],
            |row| {
                Ok(Producto {
                    id: row.get(0)?,
                    familia_id: row.get(1)?,
                    nombre: row.get(2)?,
                    codigo: row.get(3)?,
                    precio: row.get(4)?,
                    tipo_iva: row.get(5)?,
                    imagen_path: row.get(6)?,
                    activo: row.get::<_, i32>(7)? != 0,
                    orden: row.get(8)?,
                    created_at: row.get(9)?,
                    updated_at: row.get(10)?,
                })
            }
        ).map_err(|_| AppError::NoEncontrado(format!("Producto con ID {} no existe", id)))
    }

    /// Crea un nuevo producto.
    pub fn crear_producto(
        conn: &Connection,
        nuevo: &crate::models::producto::NuevoProducto,
    ) -> AppResult<Producto> {
        let orden = nuevo.orden.unwrap_or(0);
        conn.execute(
            "INSERT INTO producto (familia_id, nombre, codigo, precio, tipo_iva, imagen_path, orden)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            rusqlite::params![
                nuevo.familia_id,
                nuevo.nombre,
                nuevo.codigo,
                nuevo.precio,
                nuevo.tipo_iva,
                nuevo.imagen_path,
                orden
            ],
        )?;

        let id = conn.last_insert_rowid();
        Self::obtener_por_id(conn, id)
    }

    /// Actualiza un producto existente.
    pub fn actualizar_producto(
        conn: &Connection,
        id: i64,
        act: &crate::models::producto::ActualizarProducto,
    ) -> AppResult<Producto> {
        // Primero obtenemos el producto actual
        let actual = Self::obtener_por_id(conn, id)?;

        let nombre = act.nombre.as_ref().unwrap_or(&actual.nombre);
        let familia_id = act.familia_id.unwrap_or(actual.familia_id);
        let codigo = act.codigo.as_ref().or(actual.codigo.as_ref());
        let precio = act.precio.unwrap_or(actual.precio);
        let tipo_iva = act.tipo_iva.unwrap_or(actual.tipo_iva);
        let imagen_path = act.imagen_path.as_ref().or(actual.imagen_path.as_ref());
        let activo = act.activo.unwrap_or(actual.activo);
        let orden = act.orden.unwrap_or(actual.orden);

        conn.execute(
            "UPDATE producto 
             SET nombre = ?1, familia_id = ?2, codigo = ?3, precio = ?4, 
                 tipo_iva = ?5, imagen_path = ?6, activo = ?7, orden = ?8, updated_at = CURRENT_TIMESTAMP
             WHERE id = ?9",
            rusqlite::params![
                nombre,
                familia_id,
                codigo,
                precio,
                tipo_iva,
                imagen_path,
                if activo { 1 } else { 0 },
                orden,
                id
            ],
        )?;

        Self::obtener_por_id(conn, id)
    }

    /// Elimina un producto lógicamente (lo desactiva).
    pub fn eliminar_producto(conn: &Connection, id: i64) -> AppResult<()> {
        let eliminados = conn.execute(
            "UPDATE producto SET activo = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?1",
            [id],
        )?;
        
        if eliminados == 0 {
            return Err(AppError::NoEncontrado(format!("Producto {} no existe", id)));
        }
        Ok(())
    }
}
