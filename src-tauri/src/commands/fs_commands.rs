use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager, State};
use crate::auth::permissions::Permiso;
use crate::auth::session::SessionState;
use crate::error::{AppError, AppResult};

/// Guarda una imagen recibida en base64 en la carpeta de datos de la app.
#[tauri::command]
pub fn guardar_imagen_b64(
    app: AppHandle,
    session: State<'_, SessionState>,
    nombre_archivo: String,
    base64_data: String,
) -> AppResult<String> {
    session.exigir(Permiso::ProductoGestionar)?;
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| AppError::Interno(format!("No app data dir: {}", e)))?;
    
    let images_dir = app_data_dir.join("images");
    if !images_dir.exists() {
        fs::create_dir_all(&images_dir)
            .map_err(|e| AppError::Interno(format!("Error creando dir images: {}", e)))?;
    }

    // Limpiar base64 header si existe (ej. "data:image/png;base64,iVBORw0K...")
    let b64 = if let Some(idx) = base64_data.find(',') {
        &base64_data[idx + 1..]
    } else {
        &base64_data
    };

    use base64::{Engine as _, engine::general_purpose::STANDARD};
    let bytes = STANDARD.decode(b64)
        .map_err(|e| AppError::Interno(format!("Error decodificando base64: {}", e)))?;

    // Generar un nombre único para evitar colisiones
    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_millis();
    
    let extension = PathBuf::from(&nombre_archivo)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("jpg")
        .to_string();
        
    let final_filename = format!("{}_{}.{}", "img", timestamp, extension);
    let file_path = images_dir.join(&final_filename);

    fs::write(&file_path, bytes)
        .map_err(|e| AppError::Interno(format!("Error guardando archivo: {}", e)))?;

    // Devolvemos solo el nombre del archivo para guardarlo en la BD
    Ok(final_filename)
}

/// Obtiene una imagen de la carpeta de datos de la app en formato base64.
#[tauri::command]
pub fn obtener_imagen_b64(app: AppHandle, nombre_archivo: String) -> AppResult<String> {
    // Evitar path traversal: solo se permite un nombre de archivo simple, sin
    // separadores de ruta ni referencias a directorios superiores.
    if nombre_archivo.contains('/')
        || nombre_archivo.contains('\\')
        || nombre_archivo.contains("..")
    {
        return Err(AppError::Validation("Nombre de imagen no válido".into()));
    }

    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| AppError::Interno(format!("No app data dir: {}", e)))?;
        
    let file_path = app_data_dir.join("images").join(&nombre_archivo);
    
    if !file_path.exists() {
        return Err(AppError::NoEncontrado("Imagen no encontrada".into()));
    }

    let bytes = fs::read(&file_path)
        .map_err(|e| AppError::Interno(format!("Error leyendo archivo: {}", e)))?;

    use base64::{Engine as _, engine::general_purpose::STANDARD};
    let b64 = STANDARD.encode(&bytes);

    let ext = file_path.extension().and_then(|e| e.to_str()).unwrap_or("jpeg");
    let mime_type = match ext.to_lowercase().as_str() {
        "png" => "image/png",
        "webp" => "image/webp",
        "gif" => "image/gif",
        _ => "image/jpeg",
    };

    Ok(format!("data:{};base64,{}", mime_type, b64))
}
