import { useState, useEffect, useRef } from "react";
import { api, Familia, Producto, NuevoProducto, ActualizarProducto } from "../../lib/api";
import { centimosADecimalInput, parseEurosACentimos } from "../../lib/format";
import { Image as ImageIcon, Trash2 } from "lucide-react";
import { useDialog } from "../../context/DialogContext";

interface ProductoFormModalProps {
  familiaSeleccionada: number | null;
  familias: Familia[];
  productoAEditar?: Producto | null;
  onClose: () => void;
  onGuardado: () => void;
}

export function ProductoFormModal({ 
  familiaSeleccionada, 
  familias, 
  productoAEditar, 
  onClose, 
  onGuardado 
}: ProductoFormModalProps) {
  const [nombre, setNombre] = useState(productoAEditar?.nombre || "");
  const [precio, setPrecio] = useState(
    productoAEditar?.precio != null ? centimosADecimalInput(productoAEditar.precio) : ""
  );
  const [tipoIva, setTipoIva] = useState(productoAEditar?.tipo_iva?.toString() || "21");
  const [familiaId, setFamiliaId] = useState(
    productoAEditar?.familia_id || familiaSeleccionada || (familias[0]?.id ?? 0)
  );
  const [imagenPath, setImagenPath] = useState(productoAEditar?.imagen_path || "");
  const [previewB64, setPreviewB64] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);
  const { showAlert, showConfirm } = useDialog();
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Cargar previsualización de imagen si ya existe
  useEffect(() => {
    if (productoAEditar?.imagen_path) {
      api.obtenerImagenB64(productoAEditar.imagen_path)
        .then(b64 => setPreviewB64(b64))
        .catch(e => console.error("No se pudo cargar la imagen:", e));
    }
  }, [productoAEditar]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (ev) => {
      const b64 = ev.target?.result as string;
      setPreviewB64(b64); // Mostrar inmediatamente
      try {
        setCargando(true);
        const path = await api.guardarImagenB64(file.name, b64);
        setImagenPath(path);
      } catch (err) {
        console.error("Error guardando imagen:", err);
        await showAlert({ title: "Error", message: "Error al guardar la imagen", type: "danger" });
      } finally {
        setCargando(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCargando(true);
    
    try {
      const precioNum = parseEurosACentimos(precio);
      const ivaNum = parseFloat(tipoIva);

      if (precioNum === null || precioNum < 0) {
        await showAlert({ title: "Error", message: "Precio inválido.", type: "danger" });
        setCargando(false);
        return;
      }

      if (productoAEditar) {
        const actualizar: ActualizarProducto = {
          nombre,
          precio: precioNum,
          tipo_iva: ivaNum,
          familia_id: familiaId,
          imagen_path: imagenPath || null
        };
        await api.actualizarProducto(productoAEditar.id, actualizar);
      } else {
        const nuevo: NuevoProducto = {
          nombre,
          precio: precioNum,
          tipo_iva: ivaNum,
          familia_id: familiaId,
          imagen_path: imagenPath || null
        };
        await api.crearProducto(nuevo);
      }
      onGuardado();
      onClose();
    } catch (err) {
      console.error(err);
      await showAlert({ title: "Error", message: "Error al guardar producto", type: "danger" });
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="caja-modal-overlay">
      <div className="caja-modal" style={{ maxWidth: '500px' }}>
        <div className="caja-modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
          <h2>{productoAEditar ? "Editar Producto" : "Nuevo Producto"}</h2>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            {productoAEditar && (
              <button 
                type="button"
                onClick={async () => {
                  const isConfirmed = await showConfirm({
                    title: "Confirmar eliminación",
                    message: "¿Seguro que deseas eliminar este producto?",
                    type: "warning"
                  });
                  if (isConfirmed) {
                    setCargando(true);
                    try {
                      await api.eliminarProducto(productoAEditar.id);
                      onGuardado();
                      onClose();
                    } catch (e) {
                      await showAlert({ title: "Error", message: "Error al eliminar producto", type: "danger" });
                    } finally {
                      setCargando(false);
                    }
                  }
                }}
                className="btn-icon" 
                title="Eliminar Producto" 
                style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '4px' }}
              >
                <Trash2 size={20} />
              </button>
            )}
            <button className="caja-close-btn" onClick={onClose} disabled={cargando}>×</button>
          </div>
        </div>
        
        <form onSubmit={handleSubmit} className="caja-modal-body">
          <div 
            className="img-upload-area" 
            onClick={() => fileInputRef.current?.click()}
          >
            {previewB64 ? (
              <img src={previewB64} alt="Previsualización" className="img-upload-preview" />
            ) : (
              <div className="img-upload-text">
                <ImageIcon size={32} color="#888" />
                <span>Haz clic para añadir una foto</span>
              </div>
            )}
            <input 
              type="file" 
              ref={fileInputRef} 
              style={{ display: 'none' }} 
              accept="image/png, image/jpeg, image/webp"
              onChange={handleFileChange}
            />
          </div>

          <div className="caja-form-group">
            <label>Nombre del Producto</label>
            <input 
              type="text" 
              required
              value={nombre}
              onChange={e => setNombre(e.target.value)}
              placeholder="Ej: Café con Leche"
            />
          </div>

          <div className="cierre-grid">
            <div className="caja-form-group">
              <label>Precio Final (€)</label>
              <input 
                type="number" 
                step="0.01" 
                required
                value={precio}
                onChange={e => setPrecio(e.target.value)}
                placeholder="1.50"
              />
            </div>
            <div className="caja-form-group">
              <label>Familia</label>
              <select 
                value={familiaId} 
                onChange={e => setFamiliaId(parseInt(e.target.value))}
                className="caja-form-group-select"
                style={{ padding: '0.75rem', borderRadius: '6px', backgroundColor: 'var(--color-bg)', color: 'var(--color-text)', border: '1px solid var(--color-border)' }}
              >
                {familias.map(f => (
                  <option key={f.id} value={f.id}>{f.nombre}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="caja-form-group">
            <label>Tipo de IVA (%)</label>
            <select 
              value={tipoIva} 
              onChange={e => setTipoIva(e.target.value)}
              style={{ padding: '0.75rem', borderRadius: '6px', backgroundColor: 'var(--color-bg)', color: 'var(--color-text)', border: '1px solid var(--color-border)' }}
            >
              <option value="21">21% (General)</option>
              <option value="10">10% (Reducido - Hostelería)</option>
              <option value="4">4% (Superreducido)</option>
              <option value="0">0% (Exento)</option>
            </select>
          </div>

          <div className="caja-modal-footer">
            <button type="button" className="caja-btn-secondary" onClick={onClose} disabled={cargando}>
              Cancelar
            </button>
            <button type="submit" className="caja-btn-primary" disabled={cargando || !nombre || !precio}>
              {cargando ? "Guardando..." : "Guardar Producto"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
