use std::sync::Mutex;

use crate::auth::permissions::{requerir_permiso, Permiso};
use crate::error::{AppError, AppResult};
use crate::models::usuario::SesionUsuario;

/// Estado de sesión gestionado por Tauri.
///
/// El backend es la única fuente de verdad sobre QUIÉN está operando y QUÉ puede
/// hacer. Antes la identidad (`usuario_id`) viajaba como parámetro desde el
/// cliente y los permisos solo se ocultaban en la interfaz; ambos eran
/// falsificables. Ahora la identidad se fija en `login` y se lee del backend, y
/// cada comando sensible exige el permiso correspondiente sobre esta sesión.
#[derive(Default)]
pub struct SessionState {
    pub current: Mutex<Option<SesionUsuario>>,
}

impl SessionState {
    /// Fija la sesión activa tras un login correcto.
    pub fn set(&self, sesion: SesionUsuario) -> AppResult<()> {
        let mut guard = self
            .current
            .lock()
            .map_err(|e| AppError::Interno(format!("Error de bloqueo de sesión: {}", e)))?;
        *guard = Some(sesion);
        Ok(())
    }

    /// Cierra la sesión activa.
    pub fn clear(&self) -> AppResult<()> {
        let mut guard = self
            .current
            .lock()
            .map_err(|e| AppError::Interno(format!("Error de bloqueo de sesión: {}", e)))?;
        *guard = None;
        Ok(())
    }

    /// Devuelve la sesión activa o error si no hay ninguna.
    pub fn actual(&self) -> AppResult<SesionUsuario> {
        let guard = self
            .current
            .lock()
            .map_err(|e| AppError::Interno(format!("Error de bloqueo de sesión: {}", e)))?;
        guard.clone().ok_or(AppError::NoAutenticado)
    }

    /// Exige que la sesión activa tenga el permiso indicado y la devuelve.
    pub fn exigir(&self, permiso: Permiso) -> AppResult<SesionUsuario> {
        let sesion = self.actual()?;
        requerir_permiso(&sesion.rol, &permiso)?;
        Ok(sesion)
    }
}
