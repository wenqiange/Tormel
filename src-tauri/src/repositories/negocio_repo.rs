use rusqlite::Connection;
use crate::error::{AppError, AppResult};
use crate::models::negocio::{Negocio, ActualizarNegocio};

pub struct NegocioRepo;

impl NegocioRepo {
    /// Obtiene los datos del establecimiento (registro singleton ID = 1).
    pub fn obtener(conn: &Connection) -> AppResult<Negocio> {
        conn.query_row(
            "SELECT id, nombre, nif, direccion, codigo_postal, ciudad, provincia,
                    telefono, email, logo_path, moneda, configuracion, created_at, updated_at
             FROM negocio
             WHERE id = 1",
            [],
            |row| {
                Ok(Negocio {
                    id: row.get(0)?,
                    nombre: row.get(1)?,
                    nif: row.get(2)?,
                    direccion: row.get(3)?,
                    codigo_postal: row.get(4)?,
                    ciudad: row.get(5)?,
                    provincia: row.get(6)?,
                    telefono: row.get(7)?,
                    email: row.get(8)?,
                    logo_path: row.get(9)?,
                    moneda: row.get(10)?,
                    configuracion: row.get(11)?,
                    created_at: row.get(12)?,
                    updated_at: row.get(13)?,
                })
            },
        )
        .map_err(|e| AppError::NoEncontrado(format!("No se pudieron cargar los datos del establecimiento: {}", e)))
    }

    /// Actualiza los datos del establecimiento.
    pub fn actualizar(conn: &Connection, datos: ActualizarNegocio) -> AppResult<Negocio> {
        let actual = Self::obtener(conn)?;

        let nombre = datos.nombre.as_ref().unwrap_or(&actual.nombre);
        let nif = datos.nif.as_ref().unwrap_or(&actual.nif);
        let direccion = datos.direccion.as_ref().unwrap_or(&actual.direccion);
        let codigo_postal = datos.codigo_postal.as_ref().unwrap_or(&actual.codigo_postal);
        let ciudad = datos.ciudad.as_ref().unwrap_or(&actual.ciudad);
        let provincia = datos.provincia.as_ref().unwrap_or(&actual.provincia);
        let telefono = datos.telefono.as_ref().unwrap_or(&actual.telefono);
        let email = datos.email.as_ref().unwrap_or(&actual.email);
        let logo_path = datos.logo_path.as_ref().or(actual.logo_path.as_ref());
        let moneda = datos.moneda.as_ref().unwrap_or(&actual.moneda);

        conn.execute(
            "UPDATE negocio
             SET nombre = ?1, nif = ?2, direccion = ?3, codigo_postal = ?4,
                 ciudad = ?5, provincia = ?6, telefono = ?7, email = ?8,
                 logo_path = ?9, moneda = ?10
             WHERE id = 1",
            rusqlite::params![
                nombre, nif, direccion, codigo_postal,
                ciudad, provincia, telefono, email,
                logo_path, moneda
            ],
        )?;

        Self::obtener(conn)
    }
}
