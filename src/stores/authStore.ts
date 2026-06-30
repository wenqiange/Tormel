import { useState, useCallback } from "react";
import { api, type SesionUsuario, type Rol } from "../lib/api";

// ============================================================================
// Auth Store — Estado de sesión del usuario
// ============================================================================

interface AuthState {
  sesion: SesionUsuario | null;
  isAuthenticated: boolean;
}

let globalAuthState: AuthState = {
  sesion: null,
  isAuthenticated: false,
};

// Listeners para notificar cambios
const listeners = new Set<() => void>();

function notifyListeners() {
  listeners.forEach((fn) => fn());
}

export function setSesion(sesion: SesionUsuario | null) {
  globalAuthState = {
    sesion,
    isAuthenticated: sesion !== null,
  };
  notifyListeners();
}

export function getSesion(): SesionUsuario | null {
  return globalAuthState.sesion;
}

export function getRol(): Rol | null {
  return globalAuthState.sesion?.rol ?? null;
}

export function logout() {
  // Cerrar también la sesión en el backend (fuente de verdad). Fire-and-forget:
  // el estado local se limpia igualmente aunque la llamada falle.
  void api.logout().catch(() => {});
  setSesion(null);
}

/// Hook de React para acceder al estado de autenticación.
export function useAuth() {
  const [, setTick] = useState(0);

  // Suscribirse a cambios
  const subscribe = useCallback(() => {
    const handler = () => setTick((t) => t + 1);
    listeners.add(handler);
    return () => listeners.delete(handler);
  }, []);

  // Efecto manual de suscripción
  useState(() => {
    const unsub = subscribe();
    return unsub;
  });

  return {
    sesion: globalAuthState.sesion,
    isAuthenticated: globalAuthState.isAuthenticated,
    rol: globalAuthState.sesion?.rol ?? null,
    nombre: globalAuthState.sesion?.nombre ?? "",
    pinPorDefecto: globalAuthState.sesion?.pin_por_defecto ?? false,
    login: setSesion,
    logout,
  };
}
