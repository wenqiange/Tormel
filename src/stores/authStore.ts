import { useState, useCallback } from "react";
import { type SesionUsuario, type Rol } from "../lib/api";

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
    login: setSesion,
    logout,
  };
}
