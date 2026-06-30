import { useState } from "react";
import { TipoMovimiento } from "../../lib/api";
import { parseEurosACentimos } from "../../lib/format";

import "./CajaPanel.css";

interface MovimientoModalProps {
  tipo: TipoMovimiento;
  onClose: () => void;
  onConfirm: (importe: number, concepto: string) => Promise<void>;
}

export function MovimientoModal({ tipo, onClose, onConfirm }: MovimientoModalProps) {
  const [importe, setImporte] = useState("");
  const [concepto, setConcepto] = useState("");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseEurosACentimos(importe);
    if (val === null || val <= 0) {
      setError("Introduce un importe válido mayor que 0");
      return;
    }
    if (concepto.trim() === "") {
      setError("Introduce un concepto para este movimiento");
      return;
    }

    setCargando(true);
    setError(null);
    try {
      await onConfirm(val, concepto);
      onClose();
    } catch (err: any) {
      setError(err?.message || "Error al registrar el movimiento");
      setCargando(false);
    }
  };

  const isEntrada = tipo === "entrada";

  return (
    <div className="caja-modal-overlay">
      <div className="caja-modal">
        <div className={`caja-modal-header ${isEntrada ? "header-entrada" : "header-salida"}`}>
          <h2>{isEntrada ? "Ingreso de Efectivo" : "Retirada de Efectivo"}</h2>
          <button className="caja-close-btn" onClick={onClose}>×</button>
        </div>
        <form onSubmit={handleSubmit} className="caja-modal-body">
          {error && <div className="caja-error-message">{error}</div>}
          
          <div className="caja-form-group">
            <label>Concepto</label>
            <input 
              type="text" 
              value={concepto}
              onChange={(e) => setConcepto(e.target.value)}
              placeholder={isEntrada ? "Ej. Cambio inicial adicional" : "Ej. Pago a proveedor de hielo"}
              autoFocus
            />
          </div>

          <div className="caja-form-group">
            <label>Importe (€)</label>
            <input 
              type="number" 
              step="0.01" 
              min="0.01"
              value={importe}
              onChange={(e) => setImporte(e.target.value)}
              placeholder="0.00"
            />
          </div>

          <div className="caja-modal-footer">
            <button type="button" className="caja-btn-secondary" onClick={onClose} disabled={cargando}>
              Cancelar
            </button>
            <button type="submit" className={`caja-btn-primary ${isEntrada ? "btn-entrada" : "btn-salida"}`} disabled={cargando}>
              {cargando ? "Registrando..." : "Registrar Movimiento"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
