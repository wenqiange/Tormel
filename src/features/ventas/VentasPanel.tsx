import { useEffect, useState } from "react";
import { api, type VentaCompleta } from "../../lib/api";
import { formatCentimos } from "../../lib/format";
import { CircleDollarSign, Banknote, CreditCard, Receipt, RefreshCw, Layers } from "lucide-react";
import "./VentasPanel.css";

export function VentasPanel() {
  const [ventas, setVentas] = useState<VentaCompleta[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargarVentasDiarias = async () => {
    try {
      setLoading(true);
      const resVentas = await api.obtenerVentasDiarias();
      setVentas(resVentas);
      setError(null);
    } catch (err) {
      console.error("Error al cargar ventas diarias:", err);
      setError("No se pudo cargar el listado de facturación.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarVentasDiarias();
  }, []);

  // Calcular acumulados de la facturación diaria
  const totalCobrado = ventas.reduce((acc, v) => acc + v.total, 0);
  const totalEfectivo = ventas.reduce((acc, v) => {
    const pagoEfectivo = v.pagos.filter(p => p.metodo === "efectivo").reduce((s, p) => s + p.importe, 0);
    return acc + pagoEfectivo;
  }, 0);
  const totalTarjeta = ventas.reduce((acc, v) => {
    const pagoTarjeta = v.pagos.filter(p => p.metodo === "tarjeta").reduce((s, p) => s + p.importe, 0);
    return acc + pagoTarjeta;
  }, 0);
  const numTickets = ventas.length;

  const formatearFechaHora = (fechaStr: string | null) => {
    if (!fechaStr) return "-";
    try {
      // Formato esperado de SQLite: YYYY-MM-DDTHH:MM:SS
      const partes = fechaStr.split("T");
      if (partes.length === 2) {
        const fecha = partes[0].split("-").reverse().join("/");
        const hora = partes[1].substring(0, 5); // Solo HH:MM
        return `${fecha} — ${hora}`;
      }
      return fechaStr;
    } catch (e) {
      return fechaStr;
    }
  };

  if (loading) {
    return <div className="ventas-loading">Cargando facturación diaria...</div>;
  }

  return (
    <div className="ventas-panel-container">
      {/* Tarjetas de Estadísticas Rápidas */}
      <div className="ventas-stats-grid">
        <div className="stat-card total-facturado">
          <span className="stat-icon"><CircleDollarSign size={24} /></span>
          <div className="stat-content">
            <span className="stat-label">Total Cobrado Hoy</span>
            <h2 className="stat-value">{formatCentimos(totalCobrado)}</h2>
          </div>
        </div>

        <div className="stat-card stat-cash">
          <span className="stat-icon"><Banknote size={24} /></span>
          <div className="stat-content">
            <span className="stat-label">Caja (Efectivo)</span>
            <h2 className="stat-value">{formatCentimos(totalEfectivo)}</h2>
          </div>
        </div>

        <div className="stat-card stat-card-payment">
          <span className="stat-icon"><CreditCard size={24} /></span>
          <div className="stat-content">
            <span className="stat-label">Tarjeta bancaria</span>
            <h2 className="stat-value">{formatCentimos(totalTarjeta)}</h2>
          </div>
        </div>

        <div className="stat-card stat-tickets">
          <span className="stat-icon"><Receipt size={24} /></span>
          <div className="stat-content">
            <span className="stat-label">Tickets Cobrados</span>
            <h2 className="stat-value">{numTickets} ventas</h2>
          </div>
        </div>
      </div>

      {error && <div className="ventas-error-banner">{error}</div>}

      {/* Listado Detallado de Ventas */}
      <div className="ventas-list-section">
        <div className="ventas-list-header">
          <h3>Historial de Transacciones (Hoy)</h3>
          <button className="btn btn-secondary btn-refresh" onClick={cargarVentasDiarias} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <RefreshCw size={16} /> Actualizar
          </button>
        </div>

        <div className="table-responsive">
          <table className="ventas-table">
            <thead>
              <tr>
                <th>Nº Factura / Ticket</th>
                <th>Fecha y Hora</th>
                <th>Origen / Mesa</th>
                <th>Productos Vendidos</th>
                <th>Método Pago</th>
                <th className="text-right">Total Cobrado</th>
              </tr>
            </thead>
            <tbody>
              {ventas.map((v) => (
                <tr key={v.id} className="venta-row">
                  <td className="venta-factura-num">
                    {v.numero ? <><Receipt size={14} style={{verticalAlign: 'middle', marginRight: 4}}/> {v.numero}</> : `Abierta #${v.id}`}
                  </td>
                  <td className="venta-fecha">
                    {formatearFechaHora(v.cerrada_at)}
                  </td>
                  <td className="venta-mesa-orig">
                    <span className="badge badge-accent">
                      {v.nombre_mesa ?? "Venta Directa"}
                    </span>
                  </td>
                  <td className="venta-productos-lista">
                    <div className="product-tags-container">
                      {v.lineas.map((linea) => (
                        <span key={linea.id} className="product-sale-tag">
                          {linea.cantidad}x {linea.producto_nombre}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="venta-metodo-pago">
                    {v.pagos.map((p) => (
                      <span key={p.id} className={`pago-method-badge method-${p.metodo}`}>
                        {p.metodo === "efectivo" ? <><Banknote size={14} style={{verticalAlign: 'middle', marginRight: 4}}/> Efectivo</> : p.metodo === "tarjeta" ? <><CreditCard size={14} style={{verticalAlign: 'middle', marginRight: 4}}/> Tarjeta</> : <><Layers size={14} style={{verticalAlign: 'middle', marginRight: 4}}/> Otro</>}
                      </span>
                    ))}
                    {v.pagos.length === 0 && <span className="pago-method-badge text-muted">Sin pago</span>}
                  </td>
                  <td className="venta-total-amount text-right">
                    {formatCentimos(v.total)}
                  </td>
                </tr>
              ))}

              {ventas.length === 0 && (
                <tr>
                  <td colSpan={6} className="table-empty-state">
                    No se han registrado ventas cobradas todavía.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
