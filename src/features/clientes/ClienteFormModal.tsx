import { useState } from "react";
import { api, type Cliente, type NuevoCliente, type ActualizarCliente } from "../../lib/api";
import { Save, X } from "lucide-react";
import { useDialog } from "../../context/DialogContext";
import "./ClienteFormModal.css";

interface ClienteFormModalProps {
  clienteInicial?: Cliente;
  onClose: () => void;
  onGuardado: () => void;
}

export function ClienteFormModal({ clienteInicial, onClose, onGuardado }: ClienteFormModalProps) {
  const [formData, setFormData] = useState<NuevoCliente | ActualizarCliente>({
    nombre: clienteInicial?.nombre ?? "",
    nif_cif: clienteInicial?.nif_cif ?? "",
    direccion: clienteInicial?.direccion ?? "",
    codigo_postal: clienteInicial?.codigo_postal ?? "",
    ciudad: clienteInicial?.ciudad ?? "",
    provincia: clienteInicial?.provincia ?? "",
    telefono: clienteInicial?.telefono ?? "",
    email: clienteInicial?.email ?? "",
    notas: clienteInicial?.notas ?? "",
  });

  const [saving, setSaving] = useState(false);
  const { showAlert } = useDialog();

  const handleGuardar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nombre?.trim()) {
      await showAlert("El nombre del cliente es obligatorio");
      return;
    }

    try {
      setSaving(true);
      if (clienteInicial) {
        await api.actualizarCliente(clienteInicial.id, formData as ActualizarCliente);
      } else {
        await api.crearCliente(formData as NuevoCliente);
      }
      onGuardado();
    } catch (err) {
      console.error("Error al guardar el cliente:", err);
      await showAlert({ title: "Error", message: "Error al guardar el cliente", type: "danger" });
    } finally {
      setSaving(false);
    }
  };

  const handleInputChange = (field: keyof NuevoCliente, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <div className="modal-overlay">
      <div className="modal-container">
        <header className="modal-header">
          <h2>{clienteInicial ? "Editar Cliente" : "Nuevo Cliente"}</h2>
          <button className="btn-close-modal" onClick={onClose} disabled={saving}><X size={20} /></button>
        </header>

        <form className="cliente-form" onSubmit={handleGuardar}>
          <div className="form-group">
            <label>Nombre del Cliente *</label>
            <input
              type="text"
              className="input"
              value={formData.nombre ?? ""}
              onChange={(e) => handleInputChange("nombre", e.target.value)}
              placeholder="Ej. Restaurante El Sol"
              required
            />
          </div>

          <div className="form-group">
            <label>NIF / CIF</label>
            <input
              type="text"
              className="input"
              value={formData.nif_cif ?? ""}
              onChange={(e) => handleInputChange("nif_cif", e.target.value)}
            />
          </div>

          <div className="form-row">
            <div className="form-group" style={{ flex: 2 }}>
              <label>Dirección</label>
              <input
                type="text"
                className="input"
                value={formData.direccion ?? ""}
                onChange={(e) => handleInputChange("direccion", e.target.value)}
              />
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <label>Cód. Postal</label>
              <input
                type="text"
                className="input"
                value={formData.codigo_postal ?? ""}
                onChange={(e) => handleInputChange("codigo_postal", e.target.value)}
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Ciudad</label>
              <input
                type="text"
                className="input"
                value={formData.ciudad ?? ""}
                onChange={(e) => handleInputChange("ciudad", e.target.value)}
              />
            </div>
            <div className="form-group">
              <label>Provincia</label>
              <input
                type="text"
                className="input"
                value={formData.provincia ?? ""}
                onChange={(e) => handleInputChange("provincia", e.target.value)}
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Teléfono</label>
              <input
                type="text"
                className="input"
                value={formData.telefono ?? ""}
                onChange={(e) => handleInputChange("telefono", e.target.value)}
              />
            </div>
            <div className="form-group">
              <label>Email</label>
              <input
                type="email"
                className="input"
                value={formData.email ?? ""}
                onChange={(e) => handleInputChange("email", e.target.value)}
              />
            </div>
          </div>

          <div className="form-group">
            <label>Notas</label>
            <textarea
              className="input"
              rows={2}
              value={formData.notas ?? ""}
              onChange={(e) => handleInputChange("notas", e.target.value)}
            />
          </div>

          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving}>Cancelar</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              <Save size={18} style={{ marginRight: 8, verticalAlign: 'middle' }} />
              {saving ? "Guardando..." : "Guardar Cliente"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
