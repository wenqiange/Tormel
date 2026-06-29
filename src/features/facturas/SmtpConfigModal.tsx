import { useState } from "react";
import { api } from "../../lib/api";
import { X, Save } from "lucide-react";
import { useDialog } from "../../context/DialogContext";

interface SmtpConfigModalProps {
  onClose: () => void;
}

export function SmtpConfigModal({ onClose }: SmtpConfigModalProps) {
  const [server, setServer] = useState("");
  const [port, setPort] = useState(587);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [guardando, setGuardando] = useState(false);
  const { showAlert } = useDialog();

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!server || !username || !password || !port) {
      showAlert({ title: "Error", message: "Todos los campos son obligatorios", type: "warning" });
      return;
    }

    setGuardando(true);
    try {
      await api.guardarConfigSmtp(server, Number(port), username, password);
      await showAlert({ title: "Guardado", message: "Configuración SMTP guardada correctamente en la BD del negocio.", type: "info" });
      onClose();
    } catch (err: any) {
      console.error(err);
      await showAlert({ title: "Error", message: err.toString(), type: "danger" });
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-container" style={{ maxWidth: 450 }}>
        <header className="modal-header">
          <h2>Configuración Correo (SMTP)</h2>
          <button className="btn-close-modal" onClick={onClose}><X size={20} /></button>
        </header>

        <form onSubmit={handleSave} className="modal-body">
          <p className="text-muted" style={{ marginBottom: 15, fontSize: '0.9rem' }}>
            Introduce los datos de tu servidor de correo para poder enviar facturas en PDF a los clientes.
          </p>

          <div className="form-group">
            <label>Servidor SMTP (Ej: smtp.gmail.com)</label>
            <input 
              type="text" 
              className="input" 
              value={server} 
              onChange={e => setServer(e.target.value)} 
              placeholder="smtp.gmail.com"
            />
          </div>

          <div className="form-group">
            <label>Puerto (Ej: 587)</label>
            <input 
              type="number" 
              className="input" 
              value={port} 
              onChange={e => setPort(Number(e.target.value))} 
            />
          </div>

          <div className="form-group">
            <label>Correo Electrónico</label>
            <input 
              type="email" 
              className="input" 
              value={username} 
              onChange={e => setUsername(e.target.value)} 
              placeholder="tu@correo.com"
            />
          </div>

          <div className="form-group">
            <label>Contraseña (App Password)</label>
            <input 
              type="password" 
              className="input" 
              value={password} 
              onChange={e => setPassword(e.target.value)} 
            />
          </div>

          <div className="modal-actions" style={{ marginTop: 24 }}>
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={guardando}>Cancelar</button>
            <button type="submit" className="btn btn-primary" disabled={guardando}>
              <Save size={18} style={{ marginRight: 8, verticalAlign: 'middle' }} />
              {guardando ? "Guardando..." : "Guardar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
