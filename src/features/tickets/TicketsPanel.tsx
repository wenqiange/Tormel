import { useEffect, useMemo, useState } from "react";
import { api, type Ticket, type TipoTicket } from "../../lib/api";
import { TicketDetailModal } from "./TicketDetailModal";
import { Banknote, CreditCard, Layers, Receipt, CheckSquare, ClipboardList, RefreshCw, CircleDollarSign } from "lucide-react";
import "./TicketsPanel.css";

type Filtro = "todos" | "fiscal" | "pre_cuenta";

export function TicketsPanel() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [busqueda, setBusqueda] = useState("");
  const [seleccionado, setSeleccionado] = useState<Ticket | null>(null);

  const cargarTickets = async () => {
    try {
      setLoading(true);
      const res = await api.listarTickets();
      setTickets(res);
      setError(null);
    } catch (err) {
      console.error("Error al cargar el historial de tickets:", err);
      setError("No se pudo cargar el historial de tickets.");
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
        (t.mesa_nombre ?? "").toLowerCase().includes(q) ||
        (t.usuario_nombre ?? "").toLowerCase().includes(q);
      return coincideFiltro && coincideBusqueda;
    });
  }, [tickets, filtro, busqueda]);

  const numFiscales = tickets.filter((t) => t.tipo === "fiscal").length;
  const numPreCuentas = tickets.filter((t) => t.tipo === "pre_cuenta").length;
  const totalFacturado = tickets
    .filter((t) => t.tipo === "fiscal")
    .reduce((acc, t) => acc + t.total, 0);

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

  const etiquetaMetodo = (metodo: string | null) => {
    switch (metodo) {
      case "efectivo":
        return <><Banknote size={14} style={{verticalAlign: 'middle', marginRight: 4}}/> Efectivo</>;
      case "tarjeta":
        return <><CreditCard size={14} style={{verticalAlign: 'middle', marginRight: 4}}/> Tarjeta</>;
      case "otro":
        return <><Layers size={14} style={{verticalAlign: 'middle', marginRight: 4}}/> Otro</>;
      default:
        return "—";
    }
  };

  const badgeTipo = (tipo: TipoTicket) =>
    tipo === "fiscal" ? (
      <span className="badge badge-success"><Receipt size={12} style={{verticalAlign: 'middle', marginRight: 2}}/> Fiscal</span>
    ) : (
      <span className="badge badge-warning"><ClipboardList size={12} style={{verticalAlign: 'middle', marginRight: 2}}/> Pre-cuenta</span>
    );

  if (loading) {
    return <div className="tickets-loading">Cargando historial de tickets...</div>;
  }

  return (
    <div className="tickets-panel-container">
      {/* Estadísticas */}
      <div className="tickets-stats-grid">
        <div className="stat-card">
          <span className="stat-icon"><Receipt size={24} /></span>
          <div className="stat-content">
            <span className="stat-label">Tickets totales</span>
            <h2 className="stat-value">{tickets.length}</h2>
          </div>
        </div>
        <div className="stat-card">
          <span className="stat-icon"><CheckSquare size={24} /></span>
          <div className="stat-content">
            <span className="stat-label">Fiscales</span>
            <h2 className="stat-value">{numFiscales}</h2>
          </div>
        </div>
        <div className="stat-card">
          <span className="stat-icon"><ClipboardList size={24} /></span>
          <div className="stat-content">
            <span className="stat-label">Pre-cuentas</span>
            <h2 className="stat-value">{numPreCuentas}</h2>
          </div>
        </div>
        <div className="stat-card">
          <span className="stat-icon"><CircleDollarSign size={24} /></span>
          <div className="stat-content">
            <span className="stat-label">Total facturado</span>
            <h2 className="stat-value">{totalFacturado.toFixed(2)} €</h2>
          </div>
        </div>
      </div>

      {error && <div className="tickets-error-banner">{error}</div>}

      {/* Controles */}
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
          <button
            className={`filter-chip ${filtro === "pre_cuenta" ? "active" : ""}`}
            onClick={() => setFiltro("pre_cuenta")}
          >
            Pre-cuentas
          </button>
        </div>

        <div className="tickets-search">
          <input
            type="text"
            className="input"
            placeholder="Buscar por nº, mesa o usuario..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
          <button className="btn btn-secondary btn-refresh" onClick={cargarTickets} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <RefreshCw size={16} /> Actualizar
          </button>
        </div>
      </div>

      {/* Listado */}
      <div className="tickets-list-section">
        <div className="table-responsive">
          <table className="tickets-table">
            <thead>
              <tr>
                <th>Tipo</th>
                <th>Nº / Ref.</th>
                <th>Fecha y Hora</th>
                <th>Mesa</th>
                <th>Usuario</th>
                <th>Pago</th>
                <th className="text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {ticketsFiltrados.map((t) => (
                <tr
                  key={t.id}
                  className="ticket-row"
                  onClick={() => setSeleccionado(t)}
                  title="Ver ticket"
                >
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
                  <td>{t.usuario_nombre ?? "—"}</td>
                  <td>
                    {t.tipo === "fiscal" ? etiquetaMetodo(t.metodo_pago) : <span className="text-muted">—</span>}
                  </td>
                  <td className="ticket-total text-right">{t.total.toFixed(2)} €</td>
                </tr>
              ))}

              {ticketsFiltrados.length === 0 && (
                <tr>
                  <td colSpan={7} className="table-empty-state">
                    No hay tickets que coincidan con el filtro.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {seleccionado && (
        <TicketDetailModal ticket={seleccionado} onClose={() => setSeleccionado(null)} />
      )}
    </div>
  );
}
