import { useState } from "react";

import { formatCentimos, parseEurosACentimos } from "../../lib/format";
import "./CajaPanel.css";

interface CierreCajaModalProps {
  efectivoEsperado: number;
  onClose: () => void;
  onConfirm: (fondoFinal: number, notas: string) => Promise<void>;
}

export function CierreCajaModal({ efectivoEsperado, onClose, onConfirm }: CierreCajaModalProps) {
  const [fondoFinal, setFondoFinal] = useState("");
  const [notas, setNotas] = useState("");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseEurosACentimos(fondoFinal);
    if (val === null || val < 0) {
      setError("Introduce el total de efectivo contado en caja.");
      return;
    }

    setCargando(true);
    setError(null);
    try {
      await onConfirm(val, notas);
    } catch (err: any) {
      setError(err?.message || "Error al realizar el cierre de caja");
      setCargando(false);
    }
  };

  // Importes en céntimos. `efectivoEsperado` viene en céntimos.
  const valFondo = parseEurosACentimos(fondoFinal);
  const descuadre = valFondo === null ? 0 : valFondo - efectivoEsperado;
  const isDescuadre = Math.abs(descuadre) > 0;

  return (
    <div className="caja-modal-overlay">
      <div className="caja-modal cierre-modal">
        <div className="caja-modal-header header-salida">
          <h2>Cierre de Caja (Arqueo Z)</h2>
          <button className="caja-close-btn" onClick={onClose} disabled={cargando}>×</button>
        </div>
        
        <form onSubmit={handleSubmit} className="caja-modal-body">
          <p className="caja-info-text">
            Por favor, cuenta el dinero físico que hay actualmente en el cajón portamonedas e introduce la cantidad total.
          </p>

          {error && <div className="caja-error-message">{error}</div>}
          
          <div className="cierre-grid">
            <div className="caja-form-group">
              <label>Efectivo contado (€)</label>
              <input 
                type="number" 
                step="0.01" 
                min="0"
                value={fondoFinal}
                onChange={(e) => setFondoFinal(e.target.value)}
                placeholder="0.00"
                autoFocus
                className="input-large"
              />
            </div>

            <div className="caja-form-group">
              <label>Efectivo esperado por el sistema</label>
              <div className="valor-estatico">{formatCentimos(efectivoEsperado)}</div>
            </div>
          </div>

          {valFondo !== null && isDescuadre && (
            <div className={`caja-descuadre-alert ${descuadre > 0 ? "sobrante" : "faltante"}`}>
              <strong>Descuadre detectado: </strong> 
              {descuadre > 0 ? "Sobran " : "Faltan "} 
              {formatCentimos(Math.abs(descuadre))}
            </div>
          )}

          <div className="caja-form-group">
            <label>Notas o justificación (opcional)</label>
            <textarea 
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              placeholder={isDescuadre ? "Justifica el descuadre..." : "Observaciones del turno..."}
              rows={3}
            />
          </div>

          <div className="caja-modal-footer">
            <button type="button" className="caja-btn-secondary" onClick={onClose} disabled={cargando}>
              Cancelar
            </button>
            <button type="submit" className="caja-btn-primary btn-salida" disabled={cargando}>
              {cargando ? "Cerrando Caja..." : "Confirmar Cierre Z"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
