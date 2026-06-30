use std::collections::HashMap;
use std::sync::Mutex;
use std::time::{Duration, Instant};

/// Nº de intentos fallidos consecutivos antes de bloquear temporalmente al usuario.
const MAX_INTENTOS: u32 = 5;
/// Duración base del bloqueo (se duplica con cada bloqueo sucesivo).
const BLOQUEO_BASE_SEGUNDOS: u64 = 30;
/// Tope del bloqueo para no dejar a un empleado fuera indefinidamente.
const BLOQUEO_MAX_SEGUNDOS: u64 = 300;

struct Registro {
    fallos: u32,
    bloqueado_hasta: Option<Instant>,
}

/// Limitador de intentos de inicio de sesión por usuario.
///
/// Mitiga la fuerza bruta sobre PIN de 4–6 dígitos: aunque Argon2 ralentiza cada
/// verificación, sin un límite un atacante podría automatizar `invoke("login")`.
/// El estado es en memoria (se reinicia al reiniciar la app), lo cual es
/// suficiente y habitual para un TPV de escritorio.
#[derive(Default)]
pub struct LoginGuard {
    intentos: Mutex<HashMap<i64, Registro>>,
}

impl LoginGuard {
    /// Comprueba si el usuario puede intentar autenticarse.
    /// Devuelve `Err(segundos_restantes)` si está bloqueado.
    pub fn comprobar(&self, usuario_id: i64) -> Result<(), u64> {
        let mut map = match self.intentos.lock() {
            Ok(m) => m,
            Err(_) => return Ok(()), // ante un mutex envenenado, no bloquear el login
        };

        if let Some(reg) = map.get_mut(&usuario_id) {
            if let Some(hasta) = reg.bloqueado_hasta {
                let ahora = Instant::now();
                if ahora < hasta {
                    return Err((hasta - ahora).as_secs() + 1);
                }
                // El bloqueo ha expirado: se permite reintentar.
                reg.bloqueado_hasta = None;
            }
        }
        Ok(())
    }

    /// Registra un intento fallido y aplica bloqueo exponencial si procede.
    pub fn registrar_fallo(&self, usuario_id: i64) {
        let mut map = match self.intentos.lock() {
            Ok(m) => m,
            Err(_) => return,
        };

        let reg = map.entry(usuario_id).or_insert(Registro {
            fallos: 0,
            bloqueado_hasta: None,
        });
        reg.fallos += 1;

        if reg.fallos >= MAX_INTENTOS {
            let exceso = (reg.fallos - MAX_INTENTOS).min(4);
            let segundos =
                (BLOQUEO_BASE_SEGUNDOS * 2u64.pow(exceso)).min(BLOQUEO_MAX_SEGUNDOS);
            reg.bloqueado_hasta = Some(Instant::now() + Duration::from_secs(segundos));
        }
    }

    /// Limpia el registro de un usuario tras un login correcto.
    pub fn registrar_exito(&self, usuario_id: i64) {
        if let Ok(mut map) = self.intentos.lock() {
            map.remove(&usuario_id);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn no_bloquea_antes_del_limite() {
        let guard = LoginGuard::default();
        for _ in 0..(MAX_INTENTOS - 1) {
            guard.registrar_fallo(1);
            assert!(guard.comprobar(1).is_ok(), "no debe bloquear antes del límite");
        }
    }

    #[test]
    fn bloquea_al_alcanzar_el_limite() {
        let guard = LoginGuard::default();
        for _ in 0..MAX_INTENTOS {
            guard.registrar_fallo(1);
        }
        let restante = guard.comprobar(1).expect_err("debe estar bloqueado");
        assert!(restante > 0 && restante <= BLOQUEO_MAX_SEGUNDOS);
    }

    #[test]
    fn el_exito_resetea_los_intentos() {
        let guard = LoginGuard::default();
        for _ in 0..MAX_INTENTOS {
            guard.registrar_fallo(2);
        }
        assert!(guard.comprobar(2).is_err());
        guard.registrar_exito(2);
        assert!(guard.comprobar(2).is_ok(), "tras un éxito no debe quedar bloqueo");
    }

    #[test]
    fn los_usuarios_son_independientes() {
        let guard = LoginGuard::default();
        for _ in 0..MAX_INTENTOS {
            guard.registrar_fallo(1);
        }
        // El usuario 1 está bloqueado, pero el 2 no debe verse afectado.
        assert!(guard.comprobar(1).is_err());
        assert!(guard.comprobar(2).is_ok());
    }
}
