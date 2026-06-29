use rusqlite::{params, Connection, OptionalExtension};
use crate::error::{AppError, AppResult};
use crate::models::cliente::{ActualizarCliente, Cliente, NuevoCliente};

pub struct ClienteRepo;

impl ClienteRepo {
    pub fn listar(conn: &Connection) -> AppResult<Vec<Cliente>> {
        let mut stmt = conn.prepare(
            "SELECT id, nombre, nif_cif, direccion, codigo_postal, ciudad, provincia, telefono, email, notas, created_at, updated_at 
             FROM cliente 
             ORDER BY nombre ASC"
        )?;

        let iter = stmt.query_map([], |row| {
            Ok(Cliente {
                id: row.get(0)?,
                nombre: row.get(1)?,
                nif_cif: row.get(2)?,
                direccion: row.get(3)?,
                codigo_postal: row.get(4)?,
                ciudad: row.get(5)?,
                provincia: row.get(6)?,
                telefono: row.get(7)?,
                email: row.get(8)?,
                notas: row.get(9)?,
                created_at: row.get(10)?,
                updated_at: row.get(11)?,
            })
        })?;

        let mut clientes = Vec::new();
        for c in iter {
            clientes.push(c?);
        }
        Ok(clientes)
    }

    pub fn obtener_por_id(conn: &Connection, id: i64) -> AppResult<Cliente> {
        let cliente = conn.query_row(
            "SELECT id, nombre, nif_cif, direccion, codigo_postal, ciudad, provincia, telefono, email, notas, created_at, updated_at 
             FROM cliente 
             WHERE id = ?1",
            params![id],
            |row| {
                Ok(Cliente {
                    id: row.get(0)?,
                    nombre: row.get(1)?,
                    nif_cif: row.get(2)?,
                    direccion: row.get(3)?,
                    codigo_postal: row.get(4)?,
                    ciudad: row.get(5)?,
                    provincia: row.get(6)?,
                    telefono: row.get(7)?,
                    email: row.get(8)?,
                    notas: row.get(9)?,
                    created_at: row.get(10)?,
                    updated_at: row.get(11)?,
                })
            }
        ).optional()?;

        cliente.ok_or_else(|| AppError::NoEncontrado(format!("Cliente {} no encontrado", id)))
    }

    pub fn crear(conn: &Connection, nuevo: &NuevoCliente) -> AppResult<Cliente> {
        conn.execute(
            "INSERT INTO cliente (nombre, nif_cif, direccion, codigo_postal, ciudad, provincia, telefono, email, notas)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
            params![
                nuevo.nombre,
                nuevo.nif_cif,
                nuevo.direccion,
                nuevo.codigo_postal,
                nuevo.ciudad,
                nuevo.provincia,
                nuevo.telefono,
                nuevo.email,
                nuevo.notas
            ],
        )?;

        let id = conn.last_insert_rowid();
        Self::obtener_por_id(conn, id)
    }

    pub fn actualizar(conn: &Connection, id: i64, act: &ActualizarCliente) -> AppResult<Cliente> {
        let actual = Self::obtener_por_id(conn, id)?;

        let nombre = act.nombre.as_ref().unwrap_or(&actual.nombre);
        let nif_cif = act.nif_cif.as_ref().or(actual.nif_cif.as_ref());
        let direccion = act.direccion.as_ref().or(actual.direccion.as_ref());
        let codigo_postal = act.codigo_postal.as_ref().or(actual.codigo_postal.as_ref());
        let ciudad = act.ciudad.as_ref().or(actual.ciudad.as_ref());
        let provincia = act.provincia.as_ref().or(actual.provincia.as_ref());
        let telefono = act.telefono.as_ref().or(actual.telefono.as_ref());
        let email = act.email.as_ref().or(actual.email.as_ref());
        let notas = act.notas.as_ref().or(actual.notas.as_ref());

        conn.execute(
            "UPDATE cliente 
             SET nombre = ?1, nif_cif = ?2, direccion = ?3, codigo_postal = ?4, ciudad = ?5, provincia = ?6, telefono = ?7, email = ?8, notas = ?9
             WHERE id = ?10",
            params![
                nombre,
                nif_cif,
                direccion,
                codigo_postal,
                ciudad,
                provincia,
                telefono,
                email,
                notas,
                id
            ],
        )?;

        Self::obtener_por_id(conn, id)
    }

    pub fn eliminar(conn: &Connection, id: i64) -> AppResult<()> {
        let rows = conn.execute("DELETE FROM cliente WHERE id = ?1", params![id])?;
        if rows == 0 {
            return Err(AppError::NoEncontrado(format!("Cliente {} no encontrado", id)));
        }
        Ok(())
    }
}
