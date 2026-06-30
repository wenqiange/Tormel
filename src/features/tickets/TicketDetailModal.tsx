import { QRCodeSVG } from "qrcode.react";
import { Printer } from "lucide-react";
import type { Ticket } from "../../lib/api";
import { formatCentimos } from "../../lib/format";
import "./TicketDetailModal.css";

interface TicketDetailModalProps {
  ticket: Ticket;
  onClose: () => void;
}

const etiquetaMetodo = (metodo: string | null) => {
  switch (metodo) {
    case "efectivo":
      return "Efectivo";
    case "tarjeta":
      return "Tarjeta";
    case "otro":
      return "Otro";
    default:
      return "—";
  }
};

const formatearFechaHora = (fechaStr: string | null) => {
  if (!fechaStr) return "-";
  const partes = fechaStr.split("T");
  if (partes.length === 2) {
    const fecha = partes[0].split("-").reverse().join("/");
    const hora = partes[1].substring(0, 8);
    return `${fecha} ${hora}`;
  }
  return fechaStr;
};

export function TicketDetailModal({ ticket, onClose }: TicketDetailModalProps) {
  const esFiscal = ticket.tipo === "fiscal";

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="ticket-detail-card animate-slideUp" onClick={(e) => e.stopPropagation()}>
        <header className="ticket-detail-header">
          <h3>{esFiscal ? "Ticket fiscal" : "Pre-cuenta"}</h3>
          <button className="btn-close-modal" onClick={onClose} title="Cerrar">
            ✕
          </button>
        </header>

        {/* Recibo */}
        <div className="ticket-receipt" id="ticket-receipt-print">
          <div className="receipt-business">
            <h2>TORMEL POS</h2>
            <p>{esFiscal ? "Factura simplificada (ticket)" : "Documento no fiscal — Pre-cuenta"}</p>
          </div>

          <div className="receipt-meta">
            {ticket.numero && (
              <div className="receipt-meta-row">
                <span>Nº</span>
                <strong>{ticket.numero}</strong>
              </div>
            )}
            <div className="receipt-meta-row">
              <span>Fecha</span>
              <span>{formatearFechaHora(ticket.created_at)}</span>
            </div>
            <div className="receipt-meta-row">
              <span>Mesa</span>
              <span>{ticket.mesa_nombre ?? "Venta directa"}</span>
            </div>
            <div className="receipt-meta-row">
              <span>Atendido por</span>
              <span>{ticket.usuario_nombre ?? "—"}</span>
            </div>
            <div className="receipt-meta-row">
              <span>Comensales</span>
              <span>{ticket.comensales}</span>
            </div>
          </div>

          <div className="receipt-divider" />

          <div className="receipt-lines">
            <div className="receipt-line receipt-line-head">
              <span className="rl-qty">Ud.</span>
              <span className="rl-name">Producto</span>
              <span className="rl-total">Importe</span>
            </div>
            {ticket.lineas.map((l, idx) => (
              <div className="receipt-line" key={idx}>
                <span className="rl-qty">{l.cantidad}</span>
                <span className="rl-name">
                  {l.producto_nombre}
                  <small>{formatCentimos(l.precio_unitario)}/u</small>
                </span>
                <span className="rl-total">{formatCentimos(l.total)}</span>
              </div>
            ))}
            {ticket.lineas.length === 0 && (
              <div className="receipt-line receipt-empty">Sin líneas registradas</div>
            )}
          </div>

          <div className="receipt-divider" />

          <div className="receipt-totals">
            <div className="receipt-total-row">
              <span>Base imponible</span>
              <span>{formatCentimos(ticket.subtotal)}</span>
            </div>
            <div className="receipt-total-row">
              <span>IVA</span>
              <span>{formatCentimos(ticket.total_iva)}</span>
            </div>
            <div className="receipt-total-row receipt-total-grand">
              <span>TOTAL</span>
              <span>{formatCentimos(ticket.total)}</span>
            </div>
            {esFiscal && (
              <div className="receipt-total-row">
                <span>Forma de pago</span>
                <span>{etiquetaMetodo(ticket.metodo_pago)}</span>
              </div>
            )}
          </div>

          {esFiscal && ticket.qr_data && (
            <div className="receipt-qr">
              <div className="receipt-qr-box">
                <QRCodeSVG value={ticket.qr_data} size={150} level="M" />
              </div>
              <p>Factura verificable en la sede electrónica de la AEAT</p>
              <p className="receipt-qr-brand">VERI*FACTU</p>
            </div>
          )}

          {!esFiscal && (
            <p className="receipt-warning">
              Este documento NO es una factura. Pendiente de cobro.
            </p>
          )}
        </div>

        <footer className="ticket-detail-footer">
          <button className="btn btn-secondary btn-lg" onClick={onClose}>
            Cerrar
          </button>
          <button className="btn btn-primary btn-lg" onClick={() => window.print()} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Printer size={18} /> Imprimir
          </button>
        </footer>
      </div>
    </div>
  );
}
