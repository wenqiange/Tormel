import { useState } from "react";
import { api, Mesa, NuevaMesa } from "../../lib/api";

interface MesaConfigModalProps {
  zonaId: number;
  mesaAEditar?: Mesa | null;
  onClose: () => void;
  onGuardado: () => void;
}

export function MesaConfigModal({ zonaId, mesaAEditar, onClose, onGuardado }: MesaConfigModalProps) {
  const [nombre, setNombre] = useState(mesaAEditar?.nombre || "");
  const [capacidad, setCapacidad] = useState(mesaAEditar?.capacidad?.toString() || "4");
  const [forma, setForma] = useState<"rectangular" | "circular">(mesaAEditar?.forma || "rectangular");
  const [cargando, setCargando] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCargando(true);
    try {
      const cap = parseInt(capacidad) || 4;
      if (mesaAEditar) {
        await api.actualizarConfigMesa(mesaAEditar.id, nombre, cap, forma);
      } else {
        const nueva: NuevaMesa = {
          zona_id: zonaId,
          nombre,
          capacidad: cap,
          forma,
          // Ajustes por defecto de tamaño
          ancho: forma === "circular" ? 80 : 100,
          alto: forma === "circular" ? 80 : 100,
          pos_x: 20,
          pos_y: 20
        };
        await api.crearMesa(nueva);
      }
      onGuardado();
      onClose();
    } catch (err) {
      console.error(err);
      alert("Error guardando la mesa");
    } finally {
      setCargando(false);
    }
  };

  const handleEliminar = async () => {
    if (!mesaAEditar) return;
    if (window.confirm(`¿Estás seguro de que deseas eliminar la mesa ${mesaAEditar.nombre}?`)) {
      setCargando(true);
      try {
        await api.eliminarMesa(mesaAEditar.id);
        onGuardado();
        onClose();
      } catch (err) {
        console.error(err);
        alert("Error eliminando la mesa");
        setCargando(false);
      }
    }
  };

  return (
    <div className="caja-modal-overlay">
      <div className="caja-modal" style={{ maxWidth: '400px' }}>
        <div className="caja-modal-header">
          <h2>{mesaAEditar ? "Configurar Mesa" : "Nueva Mesa"}</h2>
          <button className="caja-close-btn" onClick={onClose} disabled={cargando}>×</button>
        </div>
        
        <form onSubmit={handleSubmit} className="caja-modal-body">
          <div className="caja-form-group">
            <label>Nombre / Número</label>
            <input 
              type="text" 
              required
              value={nombre}
              onChange={e => setNombre(e.target.value)}
              placeholder="Ej: Mesa 1"
            />
          </div>

          <div className="cierre-grid">
            <div className="caja-form-group">
              <label>Capacidad (personas)</label>
              <input 
                type="number" 
                min="1"
                required
                value={capacidad}
                onChange={e => setCapacidad(e.target.value)}
              />
            </div>

            <div className="caja-form-group">
              <label>Forma Física</label>
              <select 
                value={forma} 
                onChange={e => setForma(e.target.value as "rectangular" | "circular")}
                style={{ padding: '0.75rem', borderRadius: '6px', backgroundColor: 'var(--color-bg)', color: 'var(--color-text)', border: '1px solid var(--color-border)' }}
              >
                <option value="rectangular">Rectangular / Cuadrada</option>
                <option value="circular">Circular</option>
              </select>
            </div>
          </div>

          <div className="caja-modal-footer" style={{ justifyContent: mesaAEditar ? 'space-between' : 'flex-end' }}>
            {mesaAEditar && (
              <button type="button" className="caja-btn-secondary" style={{ borderColor: '#ef4444', color: '#ef4444' }} onClick={handleEliminar} disabled={cargando}>
                Eliminar Mesa
              </button>
            )}
            <div style={{ display: 'flex', gap: '1rem' }}>
              <button type="button" className="caja-btn-secondary" onClick={onClose} disabled={cargando}>
                Cancelar
              </button>
              <button type="submit" className="caja-btn-primary" disabled={cargando || !nombre}>
                Guardar
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
