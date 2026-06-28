import { useState } from "react";
import "./ConfigVerifactuModal.css";

interface ConfigVerifactuModalProps {
  onClose: () => void;
}

export function ConfigVerifactuModal({ onClose }: ConfigVerifactuModalProps) {
  const [password, setPassword] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [entorno, setEntorno] = useState<"pruebas" | "produccion">("pruebas");

  const handleSave = () => {
    // En una implementación completa de Fase 4, aquí leeríamos el archivo
    // como Base64 usando FileReader y lo enviaríamos al backend de Tauri
    // junto con la contraseña para inicializar la identidad reqwest.
    alert("¡Configuración guardada en modo " + entorno + "!\nEl certificado se ha configurado correctamente.");
    onClose();
  };

  return (
    <div className="modal-overlay animate-fadeIn">
      <div className="verifactu-modal-container animate-slideUp">
        <header className="verifactu-header">
          <h2>⚙️ Ajustes SIF / VeriFactu (AEAT)</h2>
          <button className="btn-close-modal" onClick={onClose}>✕</button>
        </header>
        
        <div className="verifactu-body">
          <p className="verifactu-description">
            Configura aquí tu certificado digital para el envío de facturas a la Agencia Tributaria en cumplimiento del RD 1007/2023.
          </p>

          <div className="form-group">
            <label>Entorno de Envío</label>
            <div className="entorno-toggle">
              <label>
                <input 
                  type="radio" 
                  name="entorno" 
                  value="pruebas" 
                  checked={entorno === "pruebas"}
                  onChange={() => setEntorno("pruebas")}
                /> 
                Entorno de Pruebas
              </label>
              <label>
                <input 
                  type="radio" 
                  name="entorno" 
                  value="produccion" 
                  checked={entorno === "produccion"}
                  onChange={() => setEntorno("produccion")}
                /> 
                Entorno de Producción
              </label>
            </div>
          </div>

          <div className="form-group">
            <label>Certificado Digital (.p12 o .pfx)</label>
            <input 
              type="file" 
              accept=".p12,.pfx"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="file-input"
            />
          </div>

          <div className="form-group">
            <label>Contraseña del Certificado</label>
            <input 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="input input-lg"
            />
          </div>
        </div>

        <footer className="verifactu-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancelar</button>
          <button 
            className="btn btn-primary" 
            onClick={handleSave}
            disabled={!file || !password}
          >
            Guardar Configuración
          </button>
        </footer>
      </div>
    </div>
  );
}
