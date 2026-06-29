import { useState, useEffect } from "react";
import { Settings, ShieldCheck } from "lucide-react";
import { useDialog } from "../../context/DialogContext";
import { api } from "../../lib/api";
import "./ConfigVerifactuModal.css";

interface ConfigVerifactuModalProps {
  onClose: () => void;
}

export function ConfigVerifactuModal({ onClose }: ConfigVerifactuModalProps) {
  const [password, setPassword] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [entorno, setEntorno] = useState<"pruebas" | "produccion">("pruebas");
  const [certificadoCargado, setCertificadoCargado] = useState(false);
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const { showAlert } = useDialog();

  useEffect(() => {
    async function cargarConfig() {
      try {
        const config = await api.obtenerConfigVerifactu();
        setCertificadoCargado(config.cargado);
        setEntorno(config.entorno as "pruebas" | "produccion");
      } catch (err) {
        console.error("Error al cargar la configuración de VeriFactu:", err);
      } finally {
        setLoadingConfig(false);
      }
    }
    cargarConfig();
  }, []);

  const handleSave = async () => {
    setGuardando(true);
    try {
      if (file) {
        const reader = new FileReader();
        reader.onload = async () => {
          try {
            const resultStr = reader.result as string;
            // Remover el encabezado data:*/*;base64,
            const b64Data = resultStr.split(",")[1] || resultStr;
            
            await api.guardarConfigVerifactu(b64Data, password, entorno);
            await showAlert({
              title: "Configuración Guardada",
              message: "¡Certificado digital y entorno de " + (entorno === "pruebas" ? "pruebas" : "producción") + " guardados correctamente en SQLite!",
              type: "info"
            });
            onClose();
          } catch (e: any) {
            console.error(e);
            showAlert({ title: "Error", message: "Fallo al guardar el certificado: " + e.toString(), type: "danger" });
            setGuardando(false);
          }
        };
        reader.onerror = () => {
          showAlert({ title: "Error", message: "Error al leer el archivo del certificado", type: "danger" });
          setGuardando(false);
        };
        reader.readAsDataURL(file);
      } else {
        // Solo actualizar el entorno
        await api.guardarConfigVerifactu(null, null, entorno);
        await showAlert({
          title: "Configuración Guardada",
          message: "¡Entorno de " + (entorno === "pruebas" ? "pruebas" : "producción") + " actualizado correctamente en SQLite!",
          type: "info"
        });
        onClose();
      }
    } catch (err: any) {
      console.error(err);
      await showAlert({ title: "Error", message: err.toString(), type: "danger" });
      setGuardando(false);
    }
  };

  const disableSave = guardando || loadingConfig || (file !== null && !password) || (!certificadoCargado && !file);

  return (
    <div className="modal-overlay animate-fadeIn">
      <div className="verifactu-modal-container animate-slideUp">
        <header className="verifactu-header">
          <h2 style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Settings size={24} /> Ajustes SIF / VeriFactu (AEAT)</h2>
          <button className="btn-close-modal" onClick={onClose} disabled={guardando}>✕</button>
        </header>
        
        <div className="verifactu-body">
          <p className="verifactu-description">
            Configura aquí tu certificado digital para el envío de facturas a la Agencia Tributaria en cumplimiento del RD 1007/2023.
          </p>

          {loadingConfig ? (
            <div className="text-muted" style={{ padding: "1rem", textAlign: "center" }}>
              Cargando configuración...
            </div>
          ) : (
            <>
              {certificadoCargado && (
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: 8, 
                  marginBottom: 20, 
                  padding: '10px 15px', 
                  borderRadius: 6, 
                  backgroundColor: 'rgba(16, 185, 129, 0.1)', 
                  color: '#10b981', 
                  border: '1px solid rgba(16, 185, 129, 0.2)', 
                  fontSize: '0.9rem' 
                }}>
                  <ShieldCheck size={18} />
                  <span>Certificado digital configurado correctamente en la base de datos.</span>
                </div>
              )}

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
                      disabled={guardando}
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
                      disabled={guardando}
                    /> 
                    Entorno de Producción
                  </label>
                </div>
              </div>

              <div className="form-group">
                <label>Certificado Digital (.p12 o .pfx) {certificadoCargado && "(Opcional si deseas cambiarlo)"}</label>
                <input 
                  type="file" 
                  accept=".p12,.pfx"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                  className="file-input"
                  disabled={guardando}
                />
              </div>

              <div className="form-group">
                <label>Contraseña del Certificado {file === null && certificadoCargado && "(No requerida si no cambias el archivo)"}</label>
                <input 
                  type="password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={certificadoCargado && file === null ? "••••••••" : "Introduce contraseña"}
                  className="input input-lg"
                  disabled={guardando || (file === null && certificadoCargado)}
                />
              </div>
            </>
          )}
        </div>

        <footer className="verifactu-footer">
          <button className="btn btn-secondary" onClick={onClose} disabled={guardando}>Cancelar</button>
          <button 
            className="btn btn-primary" 
            onClick={handleSave}
            disabled={disableSave}
          >
            {guardando ? "Guardando..." : "Guardar Configuración"}
          </button>
        </footer>
      </div>
    </div>
  );
}

