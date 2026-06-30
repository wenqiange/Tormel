import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { api, type Mesa, type MetodoPago } from "../../lib/api";
import { formatCentimos, centimosADecimalInput, parseEurosACentimos } from "../../lib/format";
import { Banknote, CreditCard, Layers, Zap } from "lucide-react";
import { useDialog } from "../../context/DialogContext";
import "./CheckoutModal.css";

interface CheckoutModalProps {
  mesa: Mesa;
  ventaId: number;
  total: number;
  onClose: () => void;
  onSuccess: () => void;
}

export function CheckoutModal({ mesa, ventaId, total, onClose, onSuccess }: CheckoutModalProps) {
  const [metodo, setMetodo] = useState<MetodoPago>("efectivo");
  const [entregadoStr, setEntregadoStr] = useState("");
  const [loading, setLoading] = useState(false);
  const [qrData, setQrData] = useState<string | null>(null);
  const { showAlert } = useDialog();

  // `total` viene en céntimos. La entrada del usuario (`entregadoStr`) está en euros.
  const totalEuros = total / 100;
  const entregadoCentimos = parseEurosACentimos(entregadoStr) ?? 0;
  const cambio = entregadoCentimos > total ? entregadoCentimos - total : 0;
  const falta = total > entregadoCentimos ? total - entregadoCentimos : 0;

  // Manejo de pulsaciones del Numpad
  const handleKeyClick = (key: string) => {
    if (key === "C") {
      setEntregadoStr("");
    } else if (key === "⌫") {
      setEntregadoStr((prev) => prev.slice(0, -1));
    } else if (key === ".") {
      if (!entregadoStr.includes(".")) {
        setEntregadoStr((prev) => prev + ".");
      }
    } else {
      // Evitar meter más de dos decimales
      const parts = entregadoStr.split(".");
      if (parts[1] && parts[1].length >= 2) return;
      setEntregadoStr((prev) => prev + key);
    }
  };

  // Precios sugeridos rápidos (en euros, para botones de pago en efectivo)
  const sugeridos = [
    totalEuros,
    Math.ceil(totalEuros),
    Math.ceil(totalEuros / 5) * 5,
    Math.ceil(totalEuros / 10) * 10,
    Math.ceil(totalEuros / 20) * 20,
    Math.ceil(totalEuros / 50) * 50,
  ].filter((val, index, self) => val >= totalEuros && self.indexOf(val) === index).slice(0, 4);

  const handleConfirmarCobro = async () => {
    if (metodo === "efectivo" && entregadoCentimos < total) {
      await showAlert("El importe entregado es menor que el total de la cuenta.");
      return;
    }

    try {
      setLoading(true);
      const importeFinal = metodo === "efectivo" ? entregadoCentimos : total;
      const qr_url = await api.cobrarVenta(ventaId, metodo, importeFinal);
      setQrData(qr_url);
    } catch (err) {
      console.error("Error al cobrar:", err);
      await showAlert({ title: "Error", message: "Error al procesar el cobro: " + err, type: "danger" });
    } finally {
      setLoading(false);
    }
  };

  if (qrData) {
    return (
      <div className="checkout-overlay animate-fadeIn">
        <div className="checkout-card animate-slideUp" style={{ textAlign: 'center', padding: '2rem' }}>
          <h2 style={{ color: 'var(--color-success)', marginBottom: '1rem' }}>¡Venta Cobrada y Firmada!</h2>
          <p style={{ color: 'var(--color-text-secondary)', marginBottom: '2rem' }}>
            La factura ha sido generada bajo la normativa AEAT VeriFactu.
          </p>
          
          <div style={{ background: 'white', padding: '1.5rem', display: 'inline-block', borderRadius: '12px', marginBottom: '1.5rem' }}>
            <QRCodeSVG value={qrData} size={200} level="M" />
          </div>
          
          <p style={{ fontSize: '0.85rem', color: 'var(--color-text-tertiary)', marginBottom: '2rem' }}>
            * Factura verificable en la sede electrónica de la AEAT<br />VERI*FACTU
          </p>
          
          <button className="btn btn-primary btn-lg" onClick={onSuccess} style={{ width: '100%' }}>
            Cerrar y Volver al Plano
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="checkout-overlay animate-fadeIn">
      <div className="checkout-card animate-slideUp">
        {/* Cabecera */}
        <header className="checkout-header">
          <h3>Cobrar {mesa.nombre}</h3>
          <button className="btn-close-checkout" onClick={onClose} disabled={loading}>
            ✕
          </button>
        </header>

        <div className="checkout-body">
          {/* Total Destacado */}
          <div className="checkout-total-banner">
            <span className="total-label">TOTAL A COBRAR</span>
            <span className="total-amount">{formatCentimos(total)}</span>
          </div>

          {/* Selector de Método de Pago */}
          <div className="payment-methods-selector">
            <button
              className={`method-btn ${metodo === "efectivo" ? "active" : ""}`}
              onClick={() => {
                setMetodo("efectivo");
                setEntregadoStr("");
              }}
              disabled={loading}
            >
              <span className="method-icon"><Banknote size={24} /></span>
              <span>Efectivo</span>
            </button>
            
            <button
              className={`method-btn ${metodo === "tarjeta" ? "active" : ""}`}
              onClick={() => {
                setMetodo("tarjeta");
                setEntregadoStr(centimosADecimalInput(total));
              }}
              disabled={loading}
            >
              <span className="method-icon"><CreditCard size={24} /></span>
              <span>Tarjeta</span>
            </button>
            
            <button
              className={`method-btn ${metodo === "otro" ? "active" : ""}`}
              onClick={() => {
                setMetodo("otro");
                setEntregadoStr(centimosADecimalInput(total));
              }}
              disabled={loading}
            >
              <span className="method-icon"><Layers size={24} /></span>
              <span>Otro</span>
            </button>
          </div>

          {/* Bloque de Efectivo con Numpad */}
          {metodo === "efectivo" && (
            <div className="cash-billing-section">
              {/* Entradas rápidas */}
              <div className="quick-amounts">
                {sugeridos.map((val) => (
                  <button
                    key={val}
                    className="btn btn-secondary btn-quick-cash"
                    onClick={() => setEntregadoStr(val.toFixed(2))}
                    disabled={loading}
                  >
                    {val.toFixed(2)} €
                  </button>
                ))}
              </div>

              {/* Input y Devolución */}
              <div className="cash-summary-display">
                <div className="cash-input-field">
                  <span className="display-label">Entregado</span>
                  <span className="display-value">{entregadoStr || "0.00"} €</span>
                </div>

                <div className={`cash-change-field ${cambio > 0 ? "has-change" : ""}`}>
                  <span className="display-label">{cambio > 0 ? "Cambio a devolver" : "Falta por pagar"}</span>
                  <span className="display-value">
                    {cambio > 0 ? formatCentimos(cambio) : formatCentimos(falta)}
                  </span>
                </div>
              </div>

              {/* Numpad */}
              <div className="numpad">
                {["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "⌫"].map((key) => (
                  <button
                    key={key}
                    className={`numpad-key ${key === "⌫" ? "numpad-key-delete" : ""}`}
                    onClick={() => handleKeyClick(key)}
                    disabled={loading}
                  >
                    {key}
                  </button>
                ))}
                <button
                  className="numpad-key numpad-key-clear"
                  onClick={() => handleKeyClick("C")}
                  disabled={loading}
                >
                  C
                </button>
              </div>
            </div>
          )}

          {/* Información de Tarjeta u Otros */}
          {metodo !== "efectivo" && (
            <div className="non-cash-info-section animate-fadeIn">
              <span className="payment-ready-icon"><Zap size={48} /></span>
              <p>Proceda al cobro mediante la pasarela de pago o datáfono.</p>
              <p className="subtext">El importe a cargar en el terminal es de {formatCentimos(total)}</p>
            </div>
          )}
        </div>

        {/* Acciones */}
        <footer className="checkout-footer">
          <button className="btn btn-secondary btn-lg" onClick={onClose} disabled={loading}>
            Cancelar
          </button>
          
          <button
            className="btn btn-primary btn-lg btn-confirm-pay"
            onClick={handleConfirmarCobro}
            disabled={loading || (metodo === "efectivo" && entregadoCentimos < total)}
          >
            {loading ? "Registrando VeriFactu..." : "Confirmar Cobro"}
          </button>
        </footer>
      </div>
    </div>
  );
}
