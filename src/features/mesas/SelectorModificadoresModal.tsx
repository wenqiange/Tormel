import { useState } from "react";
import { X, Check } from "lucide-react";
import type { Producto, GrupoModificadoresConElementos } from "../../lib/api";
import { formatCentimos } from "../../lib/format";
import "./SelectorModificadoresModal.css";

interface SelectorModificadoresModalProps {
  producto: Producto;
  grupos: GrupoModificadoresConElementos[];
  onClose: () => void;
  onSave: (modificadorIds: number[]) => void;
}

export function SelectorModificadoresModal({ producto, grupos, onClose, onSave }: SelectorModificadoresModalProps) {
  const [seleccionados, setSeleccionados] = useState<Record<number, number[]>>({});

  const handleToggleModificador = (grupoId: number, modId: number, maxSeleccion: number) => {
    setSeleccionados(prev => {
      const actuales = prev[grupoId] || [];
      if (actuales.includes(modId)) {
        return {
          ...prev,
          [grupoId]: actuales.filter(id => id !== modId)
        };
      } else {
        if (maxSeleccion === 1) {
          return {
            ...prev,
            [grupoId]: [modId]
          };
        } else if (actuales.length < maxSeleccion) {
          return {
            ...prev,
            [grupoId]: [...actuales, modId]
          };
        }
      }
      return prev;
    });
  };

  const handleSave = () => {
    for (const g of grupos) {
      const seleccionadosGrupo = seleccionados[g.grupo.id] || [];
      if (g.grupo.obligatorio && seleccionadosGrupo.length < g.grupo.min_seleccion) {
        alert(`Debes seleccionar al menos ${g.grupo.min_seleccion} opciones del grupo "${g.grupo.nombre}".`);
        return;
      }
    }

    const todosLosIds = Object.values(seleccionados).flat();
    onSave(todosLosIds);
  };

  const calcularTotalExtra = () => {
    let extra = 0;
    grupos.forEach(g => {
      const seleccionadosGrupo = seleccionados[g.grupo.id] || [];
      seleccionadosGrupo.forEach(modId => {
        const mod = g.elementos.find(m => m.id === modId);
        if (mod) {
          extra += mod.precio_extra;
        }
      });
    });
    return extra;
  };

  const totalExtra = calcularTotalExtra();
  const precioFinal = producto.precio + totalExtra;

  return (
    <div className="modal-overlay selector-mods-overlay">
      <div className="selector-mods-container animate-slideUp">
        <header className="selector-mods-header">
          <div>
            <h3>Opciones para {producto.nombre}</h3>
            <p className="text-muted" style={{ margin: 0, fontSize: '0.85rem' }}>Personaliza tu comanda</p>
          </div>
          <button className="btn-close-modal" onClick={onClose}><X size={20} /></button>
        </header>

        <div className="selector-mods-body">
          {grupos.map(g => {
            const seleccionadosGrupo = seleccionados[g.grupo.id] || [];
            return (
              <div key={g.grupo.id} className="mod-grupo-card">
                <div className="mod-grupo-header">
                  <h4 style={{ margin: 0 }}>{g.grupo.nombre}</h4>
                  {g.grupo.obligatorio ? (
                    <span className="badge badge-danger">Obligatorio</span>
                  ) : (
                    <span className="badge badge-secondary">Opcional</span>
                  )}
                </div>
                <div className="mod-grupo-options" style={{ marginTop: 10 }}>
                  {g.elementos.map(mod => {
                    const isSelected = seleccionadosGrupo.includes(mod.id);
                    return (
                      <button
                        key={mod.id}
                        type="button"
                        className={`mod-option-btn ${isSelected ? "selected" : ""}`}
                        onClick={() => handleToggleModificador(g.grupo.id, mod.id, g.grupo.max_seleccion)}
                      >
                        <span className="mod-option-check">
                          {isSelected && <Check size={14} />}
                        </span>
                        <span className="mod-option-name">{mod.nombre}</span>
                        {mod.precio_extra > 0 && (
                          <span className="mod-option-price">+{formatCentimos(mod.precio_extra)}</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        <footer className="selector-mods-footer">
          <div className="selector-price-summary">
            <span className="label">Precio final:</span>
            <span className="value">{formatCentimos(precioFinal)}</span>
          </div>
          <div className="footer-actions">
            <button className="btn btn-secondary" onClick={onClose}>Cancelar</button>
            <button className="btn btn-primary" onClick={handleSave}>Añadir al pedido</button>
          </div>
        </footer>
      </div>
    </div>
  );
}
