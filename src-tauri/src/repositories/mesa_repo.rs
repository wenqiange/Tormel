use rusqlite::{params, Connection};
use crate::error::{AppError, AppResult};
use crate::models::mesa::{Mesa, Zona};
use crate::models::common::{EstadoMesa, FormaMesa};

/// Repositorio de mesas y zonas — acceso a datos en SQLite.
pub struct MesaRepo;

impl MesaRepo {
    /// Obtiene todas las zonas activas.
    pub fn listar_zonas(conn: &Connection) -> AppResult<Vec<Zona>> {
        let mut stmt = conn.prepare(
            "SELECT id, nombre, orden, activa, created_at 
             FROM zona WHERE activa = 1 ORDER BY orden"
        )?;
        let zonas = stmt.query_map([], |row| {
            Ok(Zona {
                id: row.get(0)?,
                nombre: row.get(1)?,
                orden: row.get(2)?,
                activa: row.get::<_, i32>(3)? != 0,
                created_at: row.get(4)?,
            })
        })?.collect::<Result<Vec<_>, _>>()?;
        Ok(zonas)
    }

    /// Obtiene todas las mesas activas.
    pub fn listar_mesas(conn: &Connection) -> AppResult<Vec<Mesa>> {
        let mut stmt = conn.prepare(
            "SELECT id, zona_id, nombre, capacidad, estado, pos_x, pos_y, ancho, alto, forma, activa, created_at, updated_at
             FROM mesa WHERE activa = 1 ORDER BY id"
        )?;
        let mesas = stmt.query_map([], |row| {
            let estado_str: String = row.get(4)?;
            let forma_str: String = row.get(9)?;
            Ok(Mesa {
                id: row.get(0)?,
                zona_id: row.get(1)?,
                nombre: row.get(2)?,
                capacidad: row.get(3)?,
                estado: EstadoMesa::from_str(&estado_str).unwrap_or(EstadoMesa::Libre),
                pos_x: row.get(5)?,
                pos_y: row.get(6)?,
                ancho: row.get(7)?,
                alto: row.get(8)?,
                forma: FormaMesa::from_str(&forma_str).unwrap_or(FormaMesa::Rectangular),
                activa: row.get::<_, i32>(10)? != 0,
                created_at: row.get(11)?,
                updated_at: row.get(12)?,
            })
        })?.collect::<Result<Vec<_>, _>>()?;
        Ok(mesas)
    }

    /// Obtiene una mesa por su ID.
    pub fn obtener_por_id(conn: &Connection, id: i64) -> AppResult<Mesa> {
        conn.query_row(
            "SELECT id, zona_id, nombre, capacidad, estado, pos_x, pos_y, ancho, alto, forma, activa, created_at, updated_at
             FROM mesa WHERE id = ?1",
            [id],
            |row| {
                let estado_str: String = row.get(4)?;
                let forma_str: String = row.get(9)?;
                Ok(Mesa {
                    id: row.get(0)?,
                    zona_id: row.get(1)?,
                    nombre: row.get(2)?,
                    capacidad: row.get(3)?,
                    estado: EstadoMesa::from_str(&estado_str).unwrap_or(EstadoMesa::Libre),
                    pos_x: row.get(5)?,
                    pos_y: row.get(6)?,
                    ancho: row.get(7)?,
                    alto: row.get(8)?,
                    forma: FormaMesa::from_str(&forma_str).unwrap_or(FormaMesa::Rectangular),
                    activa: row.get::<_, i32>(10)? != 0,
                    created_at: row.get(11)?,
                    updated_at: row.get(12)?,
                })
            }
        ).map_err(|_| AppError::NoEncontrado(format!("Mesa con ID {} no existe", id)))
    }

    /// Actualiza el estado de una mesa.
    pub fn actualizar_estado(conn: &Connection, id: i64, estado: &EstadoMesa) -> AppResult<()> {
        let rows = conn.execute(
            "UPDATE mesa SET estado = ?1 WHERE id = ?2",
            params![estado.as_str(), id],
        )?;
        if rows == 0 {
            return Err(AppError::NoEncontrado(format!("Mesa con ID {} no existe", id)));
        }
        Ok(())
    }

    /// Actualiza la posición física de una mesa (Drag and Drop).
    pub fn actualizar_posicion(conn: &Connection, id: i64, pos_x: i32, pos_y: i32) -> AppResult<()> {
        let rows = conn.execute(
            "UPDATE mesa SET pos_x = ?1, pos_y = ?2 WHERE id = ?3",
            params![pos_x, pos_y, id],
        )?;
        if rows == 0 {
            return Err(AppError::NoEncontrado(format!("Mesa con ID {} no existe", id)));
        }
        Ok(())
    }

    /// Crea una nueva zona.
    pub fn crear_zona(conn: &Connection, nueva: &crate::models::mesa::NuevaZona) -> AppResult<Zona> {
        let orden = nueva.orden.unwrap_or(0);
        conn.execute(
            "INSERT INTO zona (nombre, orden) VALUES (?1, ?2)",
            params![nueva.nombre, orden],
        )?;
        let id = conn.last_insert_rowid();
        conn.query_row(
            "SELECT id, nombre, orden, activa, created_at FROM zona WHERE id = ?1",
            [id],
            |row| Ok(Zona {
                id: row.get(0)?,
                nombre: row.get(1)?,
                orden: row.get(2)?,
                activa: row.get::<_, i32>(3)? != 0,
                created_at: row.get(4)?,
            })
        ).map_err(|e| AppError::Interno(e.to_string()))
    }

    /// Elimina (desactiva) una zona lógica.
    pub fn eliminar_zona(conn: &Connection, id: i64) -> AppResult<()> {
        conn.execute("UPDATE zona SET activa = 0 WHERE id = ?1", [id])?;
        Ok(())
    }

    /// Crea una nueva mesa.
    pub fn crear_mesa(conn: &Connection, nueva: &crate::models::mesa::NuevaMesa) -> AppResult<Mesa> {
        let forma = nueva.forma.clone().unwrap_or(crate::models::common::FormaMesa::Rectangular);
        conn.execute(
            "INSERT INTO mesa (zona_id, nombre, capacidad, pos_x, pos_y, ancho, alto, forma)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            params![
                nueva.zona_id,
                nueva.nombre,
                nueva.capacidad.unwrap_or(4),
                nueva.pos_x.unwrap_or(0),
                nueva.pos_y.unwrap_or(0),
                nueva.ancho.unwrap_or(100),
                nueva.alto.unwrap_or(100),
                forma.as_str()
            ],
        )?;
        let id = conn.last_insert_rowid();
        Self::obtener_por_id(conn, id)
    }

    /// Actualiza configuración base de una mesa.
    pub fn actualizar_config_mesa(
        conn: &Connection, 
        id: i64, 
        nombre: Option<&str>, 
        capacidad: Option<i32>, 
        forma: Option<&crate::models::common::FormaMesa>
    ) -> AppResult<Mesa> {
        let actual = Self::obtener_por_id(conn, id)?;
        let nom = nombre.unwrap_or(&actual.nombre);
        let cap = capacidad.unwrap_or(actual.capacidad);
        let frm = forma.unwrap_or(&actual.forma);

        conn.execute(
            "UPDATE mesa SET nombre = ?1, capacidad = ?2, forma = ?3, updated_at = CURRENT_TIMESTAMP WHERE id = ?4",
            params![nom, cap, frm.as_str(), id]
        )?;
        Self::obtener_por_id(conn, id)
    }

    /// Elimina (desactiva) una mesa lógicamente.
    pub fn eliminar_mesa(conn: &Connection, id: i64) -> AppResult<()> {
        conn.execute("UPDATE mesa SET activa = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?1", [id])?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use rusqlite::Connection;

    #[test]
    fn test_crear_listar_y_actualizar_mesa() {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(
            "CREATE TABLE zona (id INTEGER PRIMARY KEY, nombre TEXT, orden INTEGER, activa INTEGER DEFAULT 1, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
             CREATE TABLE mesa (id INTEGER PRIMARY KEY, zona_id INTEGER, nombre TEXT, capacidad INTEGER, estado TEXT DEFAULT 'libre', pos_x INTEGER, pos_y INTEGER, ancho INTEGER, alto INTEGER, forma TEXT, activa INTEGER DEFAULT 1, created_at TEXT DEFAULT CURRENT_TIMESTAMP, updated_at TEXT DEFAULT CURRENT_TIMESTAMP);",
        ).unwrap();
        
        // 1. Crear Zona
        let zona = MesaRepo::crear_zona(&conn, &crate::models::mesa::NuevaZona { nombre: "Interior".to_string(), orden: Some(1) }).unwrap();
        assert_eq!(zona.nombre, "Interior");
        
        // 2. Crear Mesa
        let mesa = MesaRepo::crear_mesa(&conn, &crate::models::mesa::NuevaMesa {
            zona_id: zona.id,
            nombre: "M1".to_string(),
            capacidad: Some(4),
            forma: Some(crate::models::common::FormaMesa::Rectangular),
            pos_x: None,
            pos_y: None,
            ancho: None,
            alto: None,
        }).unwrap();
        assert_eq!(mesa.nombre, "M1");
        assert_eq!(mesa.estado, crate::models::common::EstadoMesa::Libre);
        
        // 3. Actualizar Estado
        MesaRepo::actualizar_estado(&conn, mesa.id, &crate::models::common::EstadoMesa::Ocupada).unwrap();
        let mesa_actualizada = MesaRepo::obtener_por_id(&conn, mesa.id).unwrap();
        assert_eq!(mesa_actualizada.estado, crate::models::common::EstadoMesa::Ocupada);
        
        // 4. Mover Mesa (Drag and Drop)
        MesaRepo::actualizar_posicion(&conn, mesa.id, 50, 100).unwrap();
        let mesa_movida = MesaRepo::obtener_por_id(&conn, mesa.id).unwrap();
        assert_eq!(mesa_movida.pos_x, 50);
        assert_eq!(mesa_movida.pos_y, 100);
        
        // 5. Verificar listado
        let mesas = MesaRepo::listar_mesas(&conn).unwrap();
        assert_eq!(mesas.len(), 1);
    }
}

