import { useState } from "react";
import { Save, X } from "lucide-react";
import { api, etiquetaRol, type Usuario, type Rol } from "../../lib/api";
import { useDialog } from "../../context/DialogContext";
import "./UsuariosPanel.css";

interface UsuarioFormModalProps {
  usuarioInicial?: Usuario;
  onClose: () => void;
  onGuardado: () => void;
}

// Roles ofrecidos en Tormel: Administrador (todo) y Usuario (mesas y cobro).
const ROLES: Rol[] = ["admin", "camarero"];

export function UsuarioFormModal({ usuarioInicial, onClose, onGuardado }: UsuarioFormModalProps) {
  const esEdicion = Boolean(usuarioInicial);

  const [nombre, setNombre] = useState(usuarioInicial?.nombre ?? "");
  const [rol, setRol] = useState<Rol>(usuarioInicial?.rol ?? "camarero");
  const [pin, setPin] = useState("");
  const [saving, setSaving] = useState(false);

  const { showAlert } = useDialog();

  const handlePinChange = (valor: string) => {
    // Solo dígitos, máximo 6
    setPin(valor.replace(/\D/g, "").slice(0, 6));
  };

  const validar = (): string | null => {
    if (nombre.trim().length < 2) return "Introduce un nombre válido (mínimo 2 caracteres)";
    // En creación el PIN es obligatorio; en edición es opcional (vacío = sin cambios)
    const pinNecesario = !esEdicion || pin.length > 0;
    if (pinNecesario && (pin.length < 4 || pin.length > 6)) {
      return "El PIN debe tener entre 4 y 6 dígitos";
    }
    return null;
  };

  const handleGuardar = async (e: React.FormEvent) => {
    e.preventDefault();
    const errorMsg = validar();
    if (errorMsg) {
      await showAlert({ title: "Datos incompletos", message: errorMsg, type: "warning" });
      return;
    }

    try {
      setSaving(true);
      if (usuarioInicial) {
        await api.actualizarUsuario(usuarioInicial.id, {
          nombre: nombre.trim(),
          rol,
          ...(pin.length > 0 ? { pin } : {}),
        });
      } else {
        await api.crearUsuario({ nombre: nombre.trim(), rol, pin });
      }
      onGuardado();
    } catch (err) {
      console.error("Error al guardar el usuario:", err);
      await showAlert({
        title: "Error",
        message: typeof err === "string" ? err : "No se pudo guardar el usuario",
        type: "danger",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal usuario-modal">
        <header className="modal-header usuario-modal-header">
          <h3>{esEdicion ? "Editar Usuario" : "Nuevo Usuario"}</h3>
          <button className="btn-icon" onClick={onClose} disabled={saving} title="Cerrar">
            <X size={20} />
          </button>
        </header>

        <form onSubmit={handleGuardar}>
          <div className="modal-body usuario-form">
            <div className="form-group">
              <label className="form-label">Nombre *</label>
              <input
                type="text"
                className="input"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Ej. María López"
                autoFocus
              />
            </div>

            <div className="form-group">
              <label className="form-label">Rol *</label>
              <div className="rol-selector">
                {ROLES.map((r) => (
                  <button
                    type="button"
                    key={r}
                    className={`rol-option ${rol === r ? "active" : ""}`}
                    onClick={() => setRol(r)}
                  >
                    <span className="rol-option-name">{etiquetaRol(r)}</span>
                    <span className="rol-option-desc">
                      {r === "admin"
                        ? "Acceso total al sistema"
                        : "Mesas, cobro y tickets"}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">
                {esEdicion ? "Nuevo PIN" : "PIN *"}
              </label>
              <input
                type="text"
                inputMode="numeric"
                className="input pin-input"
                value={pin}
                onChange={(e) => handlePinChange(e.target.value)}
                placeholder={esEdicion ? "Dejar vacío para mantener el actual" : "4 a 6 dígitos"}
                autoComplete="off"
              />
              <span className="form-hint">El usuario accederá introduciendo este PIN.</span>
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              <Save size={18} />
              {saving ? "Guardando..." : "Guardar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
