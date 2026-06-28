import { useEffect, useState } from "react";
import { 
  api, 
  TurnoCaja, 
  ResumenCierre, 
  MovimientoCaja 
} from "../../lib/api";
import { formatCurrency, formatDateTime } from "../../lib/format";
import { useAuth } from "../../stores/authStore";
import { MovimientoModal } from "./MovimientoModal";
import { CierreCajaModal } from "./CierreCajaModal";
import { ConfigVerifactuModal } from "../verifactu/ConfigVerifactuModal";
import "./CajaPanel.css";

export function CajaPanel() {
  const { sesion: usuario } = useAuth();
  const [turnoActivo, setTurnoActivo] = useState<TurnoCaja | null>(null);
  const [resumen, setResumen] = useState<ResumenCierre | null>(null);
  const [movimientos, setMovimientos] = useState<MovimientoCaja[]>([]);
  const [cargando, setCargando] = useState(true);

  // Estados modales
  const [showMovimiento, setShowMovimiento] = useState<"entrada" | "salida" | null>(null);
  const [showCierre, setShowCierre] = useState(false);
  const [showVerifactu, setShowVerifactu] = useState(false);

  // Apertura form
  const [fondoInicial, setFondoInicial] = useState("");

  const cargarDatosCaja = async () => {
    try {
      setCargando(true);
      const turno = await api.obtenerTurnoActivo();
      setTurnoActivo(turno);
      
      if (turno) {
        const res = await api.obtenerResumenCierre(turno.id);
        setResumen(res);
        const movs = await api.obtenerMovimientosTurno(turno.id);
        setMovimientos(movs);
      } else {
        setResumen(null);
        setMovimientos([]);
      }
    } catch (error) {
      console.error("Error cargando datos de caja:", error);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarDatosCaja();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAbrirCaja = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!usuario) return;
    
    const val = parseFloat(fondoInicial);
    if (isNaN(val) || val < 0) return;

    try {
      await api.abrirTurno(usuario.usuario_id, { fondo_inicial: val });
      setFondoInicial("");
      await cargarDatosCaja();
    } catch (error) {
      console.error("Error al abrir caja:", error);
      alert(error);
    }
  };

  const handleConfirmarMovimiento = async (importe: number, concepto: string) => {
    if (!turnoActivo || !usuario || !showMovimiento) return;
    await api.registrarMovimientoCaja(turnoActivo.id, usuario.usuario_id, {
      tipo: showMovimiento,
      importe,
      concepto
    });
    await cargarDatosCaja();
  };

  const handleConfirmarCierre = async (fondoFinal: number, notas: string) => {
    if (!turnoActivo) return;
    const res = await api.cerrarTurno(turnoActivo.id, { fondo_final: fondoFinal, notas });
    console.log("Cierre completado:", res);
    setShowCierre(false);
    await cargarDatosCaja();
  };

  if (cargando) {
    return <div className="caja-loading">Cargando estado de la caja...</div>;
  }

  // PANTALLA: ABRIR CAJA
  if (!turnoActivo) {
    return (
      <div className="caja-container caja-cerrada">
        <div className="apertura-card">
          <div className="apertura-icon">💰</div>
          <h1>Caja Cerrada</h1>
          <p>Debes abrir un nuevo turno para poder realizar ventas.</p>
          
          <form onSubmit={handleAbrirCaja} className="apertura-form">
            <div className="caja-form-group">
              <label>Fondo de Caja Inicial (€)</label>
              <input 
                type="number" 
                step="0.01" 
                min="0"
                value={fondoInicial}
                onChange={(e) => setFondoInicial(e.target.value)}
                placeholder="Ej. 150.00"
                autoFocus
                required
              />
            </div>
            <button type="submit" className="caja-btn-primary">
              Abrir Turno de Caja
            </button>
          </form>
        </div>
      </div>
    );
  }

  // PANTALLA: DASHBOARD CAJA ABIERTA
  return (
    <div className="caja-container">
      <div className="caja-header">
        <div>
          <h1>Gestión de Caja</h1>
          <p className="caja-subtitle">
            Turno abierto el {formatDateTime(turnoActivo.abierto_at)}
          </p>
        </div>
        <button 
          className="caja-btn-primary btn-salida" 
          onClick={() => setShowCierre(true)}
        >
          🔒 Realizar Cierre Z
        </button>
      </div>

      <div className="caja-stats-grid">
        <div className="stat-card">
          <h3>Fondo Inicial</h3>
          <div className="stat-value">{formatCurrency(turnoActivo.fondo_inicial)}</div>
        </div>
        <div className="stat-card">
          <h3>Ventas Efectivo</h3>
          <div className="stat-value text-green">+{formatCurrency(turnoActivo.total_efectivo)}</div>
        </div>
        <div className="stat-card">
          <h3>Ventas Tarjeta</h3>
          <div className="stat-value text-blue">+{formatCurrency(turnoActivo.total_tarjeta)}</div>
        </div>
        <div className="stat-card highlight">
          <h3>Efectivo Esperado (Cajón)</h3>
          <div className="stat-value text-accent">
            {resumen ? formatCurrency(resumen.efectivo_esperado) : "..."}
          </div>
        </div>
      </div>

      <div className="caja-main-content">
        <div className="caja-actions-panel">
          <h2>Movimientos Manuales</h2>
          <p>Registra entradas de cambio o retiradas de dinero físico.</p>
          <div className="caja-action-buttons">
            <button 
              className="caja-btn-primary btn-entrada"
              onClick={() => setShowMovimiento("entrada")}
            >
              📥 Ingreso de Efectivo
            </button>
            <button 
              className="caja-btn-primary btn-salida"
              onClick={() => setShowMovimiento("salida")}
            >
              📤 Retirada de Efectivo
            </button>
            <button 
              className="caja-btn-primary"
              style={{ backgroundColor: 'var(--color-accent)', color: 'white', marginTop: '1rem', width: '100%' }}
              onClick={() => setShowVerifactu(true)}
            >
              ⚙️ Ajustes AEAT (VeriFactu)
            </button>
          </div>
        </div>

        <div className="caja-history-panel">
          <h2>Historial de Movimientos</h2>
          {movimientos.length === 0 ? (
            <div className="caja-empty-state">No hay movimientos manuales en este turno.</div>
          ) : (
            <div className="movimientos-list">
              {movimientos.map(m => (
                <div key={m.id} className="movimiento-item">
                  <div className="mov-icon">
                    {m.tipo === "entrada" ? "📥" : "📤"}
                  </div>
                  <div className="mov-details">
                    <span className="mov-concepto">{m.concepto}</span>
                    <span className="mov-time">{formatDateTime(m.created_at)}</span>
                  </div>
                  <div className={`mov-amount ${m.tipo === "entrada" ? "text-green" : "text-red"}`}>
                    {m.tipo === "entrada" ? "+" : "-"}{formatCurrency(m.importe)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {showMovimiento && (
        <MovimientoModal 
          tipo={showMovimiento}
          onClose={() => setShowMovimiento(null)}
          onConfirm={handleConfirmarMovimiento}
        />
      )}

      {showCierre && resumen && (
        <CierreCajaModal 
          efectivoEsperado={resumen.efectivo_esperado}
          onClose={() => setShowCierre(false)}
          onConfirm={handleConfirmarCierre}
        />
      )}

      {showVerifactu && (
        <ConfigVerifactuModal onClose={() => setShowVerifactu(false)} />
      )}
    </div>
  );
}
