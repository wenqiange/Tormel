import { useState, useEffect, useCallback } from "react";
import { api, type Usuario } from "../../lib/api";
import { setSesion } from "../../stores/authStore";
import "./LoginView.css";

interface LoginViewProps {
  isFirstRun: boolean;
}

export function LoginView({ isFirstRun }: LoginViewProps) {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Estado del setup inicial (solo nombre)
  const [setupName, setSetupName] = useState("");

  // Cargar usuarios en el modo de acceso directo
  useEffect(() => {
    if (!isFirstRun) {
      setLoading(true);
      api.listarUsuarios(true)
        .then((res) => {
          setUsuarios(res);
        })
        .catch((e) => {
          setError(typeof e === "string" ? e : "Error al cargar los usuarios");
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [isFirstRun]);

  // Login de acceso directo al tocar el usuario
  const handleDirectLogin = useCallback(async (usuarioId: number) => {
    setLoading(true);
    setError("");
    try {
      const sesion = await api.login(usuarioId);
      setSesion(sesion);
    } catch (e) {
      setError(typeof e === "string" ? e : "Error al iniciar sesión");
    } finally {
      setLoading(false);
    }
  }, []);

  // Creación del administrador inicial
  const handleSetup = useCallback(async () => {
    const nombre = setupName.trim();
    if (nombre.length < 2) {
      setError("Introduce un nombre válido (mínimo 2 caracteres)");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const admin = await api.crearAdminInicial(nombre);
      // Login inmediato con el usuario creado
      const sesion = await api.login(admin.id);
      setSesion(sesion);
    } catch (e) {
      setError(typeof e === "string" ? e : "Error al crear el administrador");
      setLoading(false);
    }
  }, [setupName]);

  return (
    <div className="login-container">
      <div className="login-card animate-slideUp">
        {/* Logo y cabecera */}
        <div className="login-header">
          <div className="login-logo">
            <span className="login-logo-icon">◈</span>
          </div>
          <h1 className="login-title">Tormel POS</h1>
          <p className="login-subtitle">
            {isFirstRun
              ? "Configuración inicial del negocio"
              : "Selecciona tu usuario para acceder"}
          </p>
        </div>

        {/* Setup inicial (Nombre del administrador) */}
        {isFirstRun ? (
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
                onKeyDown={(e) => e.key === "Enter" && !loading && handleSetup()}
                disabled={loading}
                autoFocus
              />
            </div>

            {error && <div className="login-error">{error}</div>}

            <button
              className={`btn btn-primary btn-xl login-submit ${loading ? "loading" : ""}`}
              onClick={handleSetup}
              disabled={loading}
            >
              {loading ? "Creando..." : "Comenzar"}
            </button>
          </div>
        ) : (
          /* Acceso Directo (Lista de usuarios) */
          <div className="direct-access-container">
            {loading && usuarios.length === 0 ? (
              <div className="login-loading animate-pulse">Cargando personal...</div>
            ) : (
              <div className="users-grid">
                {usuarios.map((usuario) => (
                  <button
                    key={usuario.id}
                    className="user-direct-card"
                    onClick={() => handleDirectLogin(usuario.id)}
                    disabled={loading}
                  >
                    <div className="user-avatar">
                      {usuario.nombre.substring(0, 2).toUpperCase()}
                    </div>
                    <span className="user-name">{usuario.nombre}</span>
                    <span className="user-role-badge">
                      {usuario.rol === "admin"
                        ? "Administrador"
                        : usuario.rol === "encargado"
                        ? "Encargado"
                        : "Camarero"}
                    </span>
                  </button>
                ))}
              </div>
            )}

            {error && <div className="login-error">{error}</div>}
          </div>
        )}
      </div>
    </div>
  );
}
