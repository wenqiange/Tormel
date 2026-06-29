import { useState, useEffect } from "react";
import { Users, Plus, Edit2, Power, PowerOff } from "lucide-react";
import { api, etiquetaRol, type Usuario } from "../../lib/api";
import { useAuth } from "../../stores/authStore";
import { useDialog } from "../../context/DialogContext";
import { UsuarioFormModal } from "./UsuarioFormModal";
import "./UsuariosPanel.css";

export function UsuariosPanel() {
  const { sesion } = useAuth();
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [usuarioEditando, setUsuarioEditando] = useState<Usuario | undefined>(undefined);

  const { showConfirm, showAlert } = useDialog();

  const cargarUsuarios = async () => {
    try {
      setLoading(true);
      const data = await api.listarUsuarios(false);
      setUsuarios(data);
    } catch (err) {
      console.error("Error al cargar usuarios:", err);
      await showAlert({ title: "Error", message: "No se pudieron cargar los usuarios", type: "danger" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarUsuarios();
  }, []);

  const handleNuevo = () => {
    setUsuarioEditando(undefined);
    setShowModal(true);
  };

  const handleEditar = (usuario: Usuario) => {
    setUsuarioEditando(usuario);
    setShowModal(true);
  };

  const handleToggleActivo = async (usuario: Usuario) => {
    const desactivar = usuario.activo;
    const confirmado = await showConfirm({
      title: desactivar ? "Desactivar usuario" : "Activar usuario",
      message: desactivar
        ? `¿Desactivar a ${usuario.nombre}? No podrá iniciar sesión hasta reactivarlo.`
        : `¿Activar de nuevo a ${usuario.nombre}?`,
      type: desactivar ? "warning" : "info",
    });
    if (!confirmado) return;

    try {
      await api.actualizarUsuario(usuario.id, { activo: !usuario.activo });
      cargarUsuarios();
    } catch (err) {
      console.error("Error al cambiar el estado del usuario:", err);
      await showAlert({
        title: "Error",
        message: typeof err === "string" ? err : "No se pudo cambiar el estado del usuario",
        type: "danger",
      });
    }
  };

  if (loading) {
    return <div className="panel-loading">Cargando usuarios...</div>;
  }

  return (
    <div className="usuarios-panel animate-fadeIn">
      <div className="panel-header">
        <div className="panel-header-left">
          <Users size={32} className="text-primary" />
          <div>
            <h2>Usuarios</h2>
            <p>Gestiona los administradores y usuarios que acceden al sistema</p>
          </div>
        </div>
        <div className="panel-header-right">
          <button className="btn btn-primary" onClick={handleNuevo}>
            <Plus size={20} />
            Nuevo Usuario
          </button>
        </div>
      </div>

      <div className="usuarios-content">
        <div className="table-responsive">
          <table className="table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Rol</th>
                <th>Estado</th>
                <th className="text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {usuarios.map((usuario) => {
                const esYoMismo = usuario.id === sesion?.usuario_id;
                return (
                  <tr key={usuario.id} className={usuario.activo ? "" : "row-inactivo"}>
                    <td className="fw-500">
                      <div className="usuario-celda">
                        <span className="usuario-avatar">
                          {usuario.nombre.substring(0, 2).toUpperCase()}
                        </span>
                        {usuario.nombre}
                        {esYoMismo && <span className="badge badge-accent">Tú</span>}
                      </div>
                    </td>
                    <td>
                      <span className={`badge ${usuario.rol === "admin" ? "badge-accent" : "badge-info"}`}>
                        {etiquetaRol(usuario.rol)}
                      </span>
                    </td>
                    <td>
                      {usuario.activo ? (
                        <span className="badge badge-success">Activo</span>
                      ) : (
                        <span className="badge badge-danger">Inactivo</span>
                      )}
                    </td>
                    <td className="text-right">
                      <button className="btn-icon" onClick={() => handleEditar(usuario)} title="Editar">
                        <Edit2 size={18} />
                      </button>
                      <button
                        className="btn-icon"
                        onClick={() => handleToggleActivo(usuario)}
                        title={usuario.activo ? "Desactivar" : "Activar"}
                        disabled={esYoMismo}
                      >
                        {usuario.activo ? <PowerOff size={18} /> : <Power size={18} />}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <UsuarioFormModal
          usuarioInicial={usuarioEditando}
          onClose={() => setShowModal(false)}
          onGuardado={() => {
            setShowModal(false);
            cargarUsuarios();
          }}
        />
      )}
    </div>
  );
}
