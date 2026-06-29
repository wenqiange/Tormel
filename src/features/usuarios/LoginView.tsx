import { useState, useEffect, useCallback } from "react";
import { Delete, ChevronLeft, ShieldCheck } from "lucide-react";
import { api, etiquetaRol, type Usuario } from "../../lib/api";
import { setSesion } from "../../stores/authStore";
import "./LoginView.css";

const PIN_MAX = 6;

export function LoginView() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [enviando, setEnviando] = useState(false);

  // Usuario seleccionado (null = pantalla de selección)
  const [seleccionado, setSeleccionado] = useState<Usuario | null>(null);
  const [pin, setPin] = useState("");

  // Setup inicial (solo cuando no existe ningún usuario)
  const [setupName, setSetupName] = useState("");

  const cargarUsuarios = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.listarUsuarios(true);
      setUsuarios(res);
    } catch (e) {
      setError(typeof e === "string" ? e : "Error al cargar los usuarios");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    cargarUsuarios();
  }, [cargarUsuarios]);

  // ── Selección de usuario ──
  const elegirUsuario = (usuario: Usuario) => {
    setSeleccionado(usuario);
    setPin("");
    setError("");
  };

  const volverASeleccion = () => {
    setSeleccionado(null);
    setPin("");
    setError("");
  };

  // ── Teclado PIN ──
  const pulsarTecla = (digito: string) => {
    setError("");
    setPin((prev) => (prev.length >= PIN_MAX ? prev : prev + digito));
  };

  const borrar = () => {
    setError("");
    setPin((prev) => prev.slice(0, -1));
  };

  const confirmar = useCallback(async () => {
    if (!seleccionado || pin.length < 4 || enviando) return;
    setEnviando(true);
    setError("");
    try {
      const sesion = await api.login(seleccionado.id, pin);
      setSesion(sesion);
    } catch (e) {
      setError(typeof e === "string" ? e : "PIN incorrecto");
      setPin("");
    } finally {
      setEnviando(false);
    }
  }, [seleccionado, pin, enviando]);

  // Soporte de teclado físico durante la entrada del PIN
  useEffect(() => {
    if (!seleccionado) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key >= "0" && e.key <= "9") pulsarTecla(e.key);
      else if (e.key === "Backspace") borrar();
      else if (e.key === "Enter") confirmar();
      else if (e.key === "Escape") volverASeleccion();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [seleccionado, confirmar]);

  // ── Setup inicial del administrador ──
  const handleSetup = useCallback(async () => {
    const nombre = setupName.trim();
    if (nombre.length < 2) {
      setError("Introduce un nombre válido (mínimo 2 caracteres)");
      return;
    }
    setEnviando(true);
    setError("");
    try {
      await api.crearAdminInicial(nombre);
      setSetupName("");
      await cargarUsuarios();
    } catch (e) {
      setError(typeof e === "string" ? e : "Error al crear el administrador");
    } finally {
      setEnviando(false);
    }
  }, [setupName, cargarUsuarios]);

  const esPrimeraEjecucion = !loading && usuarios.length === 0;

  return (
    <div className="login-container">
      <div className="login-card animate-slideUp">
        <div className="login-header">
          <div className="login-logo">
            <span className="login-logo-icon">◈</span>
          </div>
          <h1 className="login-title">Tormel POS</h1>
          <p className="login-subtitle">
            {esPrimeraEjecucion
              ? "Configuración inicial del negocio"
              : seleccionado
              ? "Introduce tu PIN para acceder"
              : "Selecciona tu usuario para acceder"}
          </p>
        </div>

        {/* ── Configuración inicial ── */}
        {esPrimeraEjecucion ? (
          <div className="setup-form">
            <div className="form-group">
              <label htmlFor="adminName" className="form-label">
                Nombre del Administrador
              </label>
              <input
                id="adminName"
                type="text"
                className="input input-lg"
                placeholder="Ej: Juan Pérez"
                value={setupName}
                onChange={(e) => {
                  setSetupName(e.target.value);
                  setError("");
                }}
                onKeyDown={(e) => e.key === "Enter" && !enviando && handleSetup()}
                disabled={enviando}
                autoFocus
              />
            </div>

            <p className="login-hint">
              <ShieldCheck size={16} />
              Se creará con el PIN por defecto <strong>111111</strong>
            </p>

            {error && <div className="login-error">{error}</div>}

            <button
              className={`btn btn-primary btn-xl login-submit ${enviando ? "loading" : ""}`}
              onClick={handleSetup}
              disabled={enviando}
            >
              {enviando ? "Creando..." : "Comenzar"}
            </button>
          </div>
        ) : loading ? (
          <div className="login-loading animate-pulse">Cargando personal...</div>
        ) : !seleccionado ? (
          /* ── Pantalla 1: selección de usuario ── */
          <div className="direct-access-container">
            <div className="users-grid">
              {usuarios.map((usuario) => (
                <button
                  key={usuario.id}
                  className="user-direct-card"
                  onClick={() => elegirUsuario(usuario)}
                >
                  <div className="user-avatar">
                    {usuario.nombre.substring(0, 2).toUpperCase()}
                  </div>
                  <span className="user-name">{usuario.nombre}</span>
                  <span className="user-role-badge">{etiquetaRol(usuario.rol)}</span>
                </button>
              ))}
            </div>
            {error && <div className="login-error">{error}</div>}
          </div>
        ) : (
          /* ── Pantalla 2: entrada del PIN ── */
          <div className="pin-container">
            <button className="pin-back" onClick={volverASeleccion} disabled={enviando}>
              <ChevronLeft size={18} />
              Cambiar usuario
            </button>

            <div className="pin-user">
              <div className="user-avatar pin-user-avatar">
                {seleccionado.nombre.substring(0, 2).toUpperCase()}
              </div>
              <div className="pin-user-info">
                <span className="pin-user-name">{seleccionado.nombre}</span>
                <span className="user-role-badge">{etiquetaRol(seleccionado.rol)}</span>
              </div>
            </div>

            <div className="pin-dots">
              {Array.from({ length: PIN_MAX }).map((_, i) => (
                <span
                  key={i}
                  className={`pin-dot ${i < pin.length ? "filled" : ""}`}
                />
              ))}
            </div>

            {error && <div className="login-error">{error}</div>}

            <div className="numpad pin-numpad">
              {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
                <button
                  key={d}
                  className="numpad-key"
                  onClick={() => pulsarTecla(d)}
                  disabled={enviando}
                >
                  {d}
                </button>
              ))}
              <button
                className="numpad-key"
                onClick={borrar}
                disabled={enviando || pin.length === 0}
                title="Borrar"
              >
                <Delete size={24} />
              </button>
              <button
                className="numpad-key"
                onClick={() => pulsarTecla("0")}
                disabled={enviando}
              >
                0
              </button>
              <button
                className="numpad-key numpad-key-action"
                onClick={confirmar}
                disabled={enviando || pin.length < 4}
                title="Entrar"
              >
                {enviando ? "···" : "OK"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
