use tauri::State;
use crate::db::connection::DbState;
use crate::error::{AppError, AppResult};
use crate::models::producto::{ActualizarProducto, NuevoProducto, Producto, Familia, GrupoModificadoresConElementos};
use crate::repositories::producto_repo::ProductoRepo;

#[tauri::command]
pub fn crear_producto(
    db: State<'_, DbState>,
    nuevo: NuevoProducto,
) -> AppResult<Producto> {
    let conn = db.conn.lock().map_err(|e| AppError::Interno(format!("DB lock error: {}", e)))?;
    ProductoRepo::crear_producto(&conn, &nuevo)
}

#[tauri::command]
pub fn actualizar_producto(
    db: State<'_, DbState>,
    id: i64,
    actualizar: ActualizarProducto,
) -> AppResult<Producto> {
    let conn = db.conn.lock().map_err(|e| AppError::Interno(format!("DB lock error: {}", e)))?;
    ProductoRepo::actualizar_producto(&conn, id, &actualizar)
}

#[tauri::command]
pub fn eliminar_producto(
    db: State<'_, DbState>,
    id: i64,
) -> AppResult<()> {
    let conn = db.conn.lock().map_err(|e| AppError::Interno(format!("DB lock error: {}", e)))?;
    ProductoRepo::eliminar_producto(&conn, id)
}

#[tauri::command]
pub fn crear_familia(
    db: State<'_, DbState>,
    nombre: String,
    color: String,
) -> AppResult<Familia> {
    let conn = db.conn.lock().map_err(|e| AppError::Interno(format!("DB lock error: {}", e)))?;
    ProductoRepo::crear_familia(&conn, &nombre, &color)
}

#[tauri::command]
pub fn eliminar_familia(
    db: State<'_, DbState>,
    id: i64,
) -> AppResult<()> {
    let conn = db.conn.lock().map_err(|e| AppError::Interno(format!("DB lock error: {}", e)))?;
    ProductoRepo::eliminar_familia(&conn, id)
}

#[tauri::command]
pub fn obtener_modificadores_producto(
    producto_id: i64,
    db: State<'_, DbState>,
) -> AppResult<Vec<GrupoModificadoresConElementos>> {
    let conn = db.conn.lock().map_err(|e| AppError::Interno(format!("DB lock error: {}", e)))?;

    // 1. Obtener grupos asociados al producto
    let mut stmt_grupos = conn.prepare(
        "SELECT g.id, g.nombre, g.obligatorio, g.min_seleccion, g.max_seleccion, g.activo, g.created_at
         FROM modificador_grupo g
         JOIN producto_modificador_grupo pmg ON pmg.grupo_id = g.id
         WHERE pmg.producto_id = ?1 AND g.activo = 1"
    )?;

    let grupos = stmt_grupos.query_map([producto_id], |row| {
        let obligatorio_int: i32 = row.get(2)?;
        let activo_int: i32 = row.get(5)?;
        Ok(crate::models::producto::ModificadorGrupo {
            id: row.get(0)?,
            nombre: row.get(1)?,
            obligatorio: obligatorio_int == 1,
            min_seleccion: row.get(3)?,
            max_seleccion: row.get(4)?,
            activo: activo_int == 1,
            created_at: row.get(6)?,
        })
    })?.collect::<Result<Vec<_>, _>>()?;

    let mut resultado = Vec::new();

    // 2. Obtener los modificadores de cada grupo
    for grupo in grupos {
        let mut stmt_mods = conn.prepare(
            "SELECT id, grupo_id, nombre, precio_extra, orden, activo, created_at
             FROM modificador
             WHERE grupo_id = ?1 AND activo = 1
             ORDER BY orden ASC"
        )?;

        let elementos = stmt_mods.query_map([grupo.id], |row| {
            let activo_int: i32 = row.get(5)?;
            Ok(crate::models::producto::Modificador {
                id: row.get(0)?,
                grupo_id: row.get(1)?,
                nombre: row.get(2)?,
                precio_extra: row.get(3)?,
                orden: row.get(4)?,
                activo: activo_int == 1,
                created_at: row.get(6)?,
            })
        })?.collect::<Result<Vec<_>, _>>()?;


        resultado.push(GrupoModificadoresConElementos { grupo, elementos });
    }

    Ok(resultado)
}

