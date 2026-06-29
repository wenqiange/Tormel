import { useEffect, useMemo, useState } from "react";
import { api, type Ticket, type TipoTicket } from "../../lib/api";
import { FileText, ClipboardList, RefreshCw, Receipt, Settings } from "lucide-react";
import { GenerarFacturaModal } from "./GenerarFacturaModal";
import { SmtpConfigModal } from "./SmtpConfigModal";
import "../tickets/TicketsPanel.css"; // Reuse styling for the table

type Filtro = "todos" | "fiscal" | "pre_cuenta";

export function FacturasPanel() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showConfigSmtp, setShowConfigSmtp] = useState(false);
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [busqueda, setBusqueda] = useState("");
  const [seleccionado, setSeleccionado] = useState<Ticket | null>(null);

  const cargarTickets = async () => {
    try {
      setLoading(true);
      const res = await api.listarTickets();
      // Facturas are usually generated for fiscal tickets, but let's allow all for flexibility
      setTickets(res);
      setError(null);
    } catch (err) {
      console.error("Error al cargar tickets:", err);
      setError("No se pudo cargar la lista de tickets.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarTickets();
  }, []);

  const ticketsFiltrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return tickets.filter((t) => {
      const coincideFiltro = filtro === "todos" || t.tipo === filtro;
      const coincideBusqueda =
        q === "" ||
        (t.numero ?? "").toLowerCase().includes(q) ||
        (t.mesa_nombre ?? "").toLowerCase().includes(q);
      return coincideFiltro && coincideBusqueda;
    });
  }, [tickets, filtro, busqueda]);

  const formatearFechaHora = (fechaStr: string | null) => {
    if (!fechaStr) return "-";
    const partes = fechaStr.split("T");
    if (partes.length === 2) {
      const fecha = partes[0].split("-").reverse().join("/");
      const hora = partes[1].substring(0, 5);
      return `${fecha} — ${hora}`;
    }
    return fechaStr;
  };

  const badgeTipo = (tipo: TipoTicket) =>
    tipo === "fiscal" ? (
      <span className="badge badge-success"><Receipt size={12} style={{verticalAlign: 'middle', marginRight: 2}}/> Fiscal</span>
    ) : (
      <span className="badge badge-warning"><ClipboardList size={12} style={{verticalAlign: 'middle', marginRight: 2}}/> Pre-cuenta</span>
    );

  if (loading) {
    return <div className="tickets-loading">Cargando tickets...</div>;
  }

  return (
    <div className="tickets-panel-container animate-fadeIn">
      <div className="panel-header" style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div className="panel-header-left">
          <FileText size={32} className="text-primary" />
          <div>
            <h2 style={{ margin: 0, fontSize: '1.8rem', color: 'var(--color-text)', fontWeight: 700, letterSpacing: '-0.02em' }}>Generar Facturas</h2>
            <p style={{ margin: '4px 0 0', color: 'var(--color-text-secondary)' }}>Selecciona un ticket para exportarlo como factura a nombre de un cliente</p>
          </div>
        </div>
        <div className="panel-actions">
          <button className="btn btn-secondary" onClick={() => setShowConfigSmtp(true)}>
            <Settings size={18} />
            Configurar Correo
          </button>
        </div>
      </div>

      {error && <div className="tickets-error-banner">{error}</div>}

      <div className="tickets-toolbar">
        <div className="tickets-filters">
          <button
            className={`filter-chip ${filtro === "todos" ? "active" : ""}`}
            onClick={() => setFiltro("todos")}
          >
            Todos
          </button>
          <button
            className={`filter-chip ${filtro === "fiscal" ? "active" : ""}`}
            onClick={() => setFiltro("fiscal")}
          >
            Fiscales
          </button>
        </div>

        <div className="tickets-search">
          <input
            type="text"
            className="input"
            placeholder="Buscar por nº de ticket o mesa..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
          <button className="btn btn-secondary btn-refresh" onClick={cargarTickets} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <RefreshCw size={16} /> Actualizar
          </button>
        </div>
      </div>

      <div className="tickets-list-section">
        <div className="table-responsive">
          <table className="tickets-table">
            <thead>
              <tr>
                <th>Tipo</th>
                <th>Nº Ticket</th>
                <th>Fecha y Hora</th>
                <th>Mesa</th>
                <th className="text-right">Total</th>
                <th className="text-right">Acción</th>
              </tr>
            </thead>
            <tbody>
              {ticketsFiltrados.map((t) => (
                <tr key={t.id} className="ticket-row" onClick={() => setSeleccionado(t)}>
                  <td>{badgeTipo(t.tipo)}</td>
                  <td className="ticket-num">
                    {t.numero ?? <span className="text-muted">#{t.id}</span>}
                  </td>
                  <td>{formatearFechaHora(t.created_at)}</td>
                  <td>
                    <span className="badge badge-accent">
                      {t.mesa_nombre ?? "Venta directa"}
                    </span>
                  </td>
                  <td className="ticket-total text-right">{t.total.toFixed(2)} €</td>
                  <td className="text-right">
                    <button 
                      className="btn btn-primary" 
                      style={{ padding: '6px 12px', fontSize: '0.85rem' }}
                      onClick={(e) => { e.stopPropagation(); setSeleccionado(t); }}
                    >
                      <FileText size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />
                      Emitir Factura
                    </button>
                  </td>
                </tr>
              ))}
              {ticketsFiltrados.length === 0 && (
                <tr>
                  <td colSpan={6} className="table-empty-state">
                    No se encontraron tickets.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {seleccionado && (
        <GenerarFacturaModal ticket={seleccionado} onClose={() => setSeleccionado(null)} />
      )}

      {showConfigSmtp && (
        <SmtpConfigModal onClose={() => setShowConfigSmtp(false)} />
      )}
    </div>
  );
}
