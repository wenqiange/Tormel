import React, { useState, useEffect } from "react";
import { api } from "../../lib/api";
import { useDialog } from "../../context/DialogContext";
import { Building2, Save, Image as ImageIcon, Trash2 } from "lucide-react";
import "./AjustesPanel.css";

export function AjustesPanel() {
  const [nombre, setNombre] = useState("");
  const [nif, setNif] = useState("");
  const [direccion, setDireccion] = useState("");
  const [codigoPostal, setCodigoPostal] = useState("");
  const [ciudad, setCiudad] = useState("");
  const [provincia, setProvincia] = useState("");
  const [telefono, setTelefono] = useState("");
  const [email, setEmail] = useState("");
  const [moneda, setMoneda] = useState("EUR");
  const [logoPath, setLogoPath] = useState<string | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const { showAlert } = useDialog();

  useEffect(() => {
    cargarDatos();
  }, []);

  const cargarDatos = async () => {
    try {
      const data = await api.obtenerDatosNegocio();
      setNombre(data.nombre);
      setNif(data.nif);
      setDireccion(data.direccion);
      setCodigoPostal(data.codigo_postal);
      setCiudad(data.ciudad);
      setProvincia(data.provincia);
      setTelefono(data.telefono);
      setEmail(data.email);
      setMoneda(data.moneda);
      setLogoPath(data.logo_path);

      if (data.logo_path) {
        try {
          const b64 = await api.obtenerImagenB64(data.logo_path);
          setLogoUrl(b64);
        } catch (err) {
          console.error("Error al cargar la imagen de logo:", err);
        }
      }
    } catch (e: any) {
      console.error(e);
      showAlert({ title: "Error", message: "No se pudieron cargar los datos del negocio", type: "danger" });
    } finally {
      setCargando(false);
    }
  };

  const handleLogoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const base64 = reader.result as string;
        const savedFilename = await api.guardarImagenB64(file.name, base64);
        setLogoPath(savedFilename);
        
        const loadedB64 = await api.obtenerImagenB64(savedFilename);
        setLogoUrl(loadedB64);
      } catch (err: any) {
        console.error(err);
        showAlert({ title: "Error", message: "Error al subir la imagen: " + err.toString(), type: "danger" });
      }
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveLogo = () => {
    setLogoPath(null);
    setLogoUrl(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setGuardando(true);
    try {
      await api.guardarDatosNegocio({
        nombre,
        nif,
        direccion,
        codigo_postal: codigoPostal,
        ciudad,
        provincia,
        telefono,
        email,
        logo_path: logoPath,
        moneda,
      });
      await showAlert({
        title: "Datos Guardados",
        message: "Los datos del establecimiento se han guardado correctamente.",
        type: "info"
      });
    } catch (err: any) {
      console.error(err);
      await showAlert({ title: "Error", message: "No se pudieron guardar los datos: " + err.toString(), type: "danger" });
    } finally {
      setGuardando(false);
    }
  };

  if (cargando) {
    return <div className="ajustes-loading animate-pulse">Cargando ajustes del establecimiento...</div>;
  }

  return (
    <div className="ajustes-panel-container animate-fadeIn">
      <form onSubmit={handleSave} className="ajustes-form-grid">
        <div className="ajustes-card main-info-card">
          <div className="card-header">
            <h3><Building2 size={20} /> Datos del Establecimiento</h3>
          </div>
          
          <div className="card-body">
            <div className="form-row">
              <div className="form-group col-6">
                <label>Nombre Comercial / Razón Social</label>
                <input 
                  type="text" 
                  className="input" 
                  value={nombre} 
                  onChange={e => setNombre(e.target.value)} 
                  placeholder="Ej: Cafetería Central"
                  required
                />
              </div>
              <div className="form-group col-6">
                <label>NIF / CIF</label>
                <input 
                  type="text" 
                  className="input" 
                  value={nif} 
                  onChange={e => setNif(e.target.value)} 
                  placeholder="Ej: B12345678"
                  required
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group col-12">
                <label>Dirección</label>
                <input 
                  type="text" 
                  className="input" 
                  value={direccion} 
                  onChange={e => setDireccion(e.target.value)} 
                  placeholder="Ej: Calle Gran Vía 45"
                  required
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group col-4">
                <label>Código Postal</label>
                <input 
                  type="text" 
                  className="input" 
                  value={codigoPostal} 
                  onChange={e => setCodigoPostal(e.target.value)} 
                  placeholder="28013"
                  required
                />
              </div>
              <div className="form-group col-4">
                <label>Ciudad</label>
                <input 
                  type="text" 
                  className="input" 
                  value={ciudad} 
                  onChange={e => setCiudad(e.target.value)} 
                  placeholder="Madrid"
                  required
                />
              </div>
              <div className="form-group col-4">
                <label>Provincia</label>
                <input 
                  type="text" 
                  className="input" 
                  value={provincia} 
                  onChange={e => setProvincia(e.target.value)} 
                  placeholder="Madrid"
                  required
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group col-6">
                <label>Teléfono</label>
                <input 
                  type="text" 
                  className="input" 
                  value={telefono} 
                  onChange={e => setTelefono(e.target.value)} 
                  placeholder="912345678"
                />
              </div>
              <div className="form-group col-6">
                <label>Email de contacto</label>
                <input 
                  type="email" 
                  className="input" 
                  value={email} 
                  onChange={e => setEmail(e.target.value)} 
                  placeholder="contacto@local.com"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="ajustes-sidebar-cards">
          <div className="ajustes-card logo-card">
            <div className="card-header">
              <h3><ImageIcon size={20} /> Logotipo</h3>
            </div>
            <div className="card-body logo-upload-container">
              {logoUrl ? (
                <div className="logo-preview-box">
                  <img src={logoUrl} alt="Logo Negocio" />
                  <button type="button" className="btn btn-danger btn-sm logo-delete-btn" onClick={handleRemoveLogo}>
                    <Trash2 size={16} /> Eliminar Logo
                  </button>
                </div>
              ) : (
                <div className="logo-placeholder-box">
                  <ImageIcon size={48} className="placeholder-icon" />
                  <p>Sin logotipo configurado</p>
                  <label className="btn btn-secondary btn-sm logo-upload-label">
                    Subir Imagen
                    <input 
                      type="file" 
                      accept="image/*" 
                      onChange={handleLogoChange} 
                      style={{ display: 'none' }} 
                    />
                  </label>
                </div>
              )}
            </div>
          </div>

          <div className="ajustes-card config-card">
            <div className="card-header">
              <h3>Configuración Regional</h3>
            </div>
            <div className="card-body">
              <div className="form-group">
                <label>Moneda oficial</label>
                <select className="input" value={moneda} onChange={e => setMoneda(e.target.value)}>
                  <option value="EUR">Euro (€)</option>
                  <option value="USD">Dólar ($)</option>
                  <option value="GBP">Libra (£)</option>
                </select>
              </div>
            </div>
          </div>

          <button 
            type="submit" 
            className="btn btn-primary btn-xl btn-save-ajustes" 
            disabled={guardando}
          >
            <Save size={20} style={{ marginRight: 8, verticalAlign: 'middle' }} />
            {guardando ? "Guardando..." : "Guardar Cambios"}
          </button>
        </div>
      </form>
    </div>
  );
}
