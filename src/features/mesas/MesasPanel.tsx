import React, { useEffect, useState, useRef } from "react";
import { api, type Mesa, type Zona } from "../../lib/api";
import { OrderModal } from "./OrderModal";
import { MesaConfigModal } from "./MesaConfigModal";
import { useAuth } from "../../stores/authStore";
import { useDialog } from "../../context/DialogContext";
import { User, ReceiptText } from "lucide-react";
import "./MesasPanel.css";

interface MesasPanelProps {
  usuarioId: number;
}

export function MesasPanel({ usuarioId }: MesasPanelProps) {
  const { rol } = useAuth();
  const esAdmin = rol === "admin" || rol === "encargado";

  const [zonas, setZonas] = useState<Zona[]>([]);
  const [mesas, setMesas] = useState<Mesa[]>([]);
  const [zonaActiva, setZonaActiva] = useState<number | null>(null);
  const [selectedMesa, setSelectedMesa] = useState<Mesa | null>(null);

  // Modo edición de planta
  const [editMode, setEditMode] = useState(false);
  const [configMesa, setConfigMesa] = useState<Mesa | "NUEVA" | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { showAlert, showPrompt, showConfirm } = useDialog();

  // Estados de Drag & Drop
  const [draggingId, setDraggingId] = useState<number | null>(null);
  const dragStartRef = useRef<{ pointerX: number; pointerY: number; tableX: number; tableY: number; hasMoved: boolean }>({
    pointerX: 0,
    pointerY: 0,
    tableX: 0,
    tableY: 0,
    hasMoved: false,
  });

  const canvasRef = useRef<HTMLDivElement>(null);

  const cargarDatos = async () => {
    try {
      setLoading(true);
      const resZonas = await api.listarZonas();
      const resMesas = await api.listarMesas();

      setZonas(resZonas);
      setMesas(resMesas);

      // Si la zona activa ya no existe o es nula, seleccionamos la primera
      if (resZonas.length > 0 && (!zonaActiva || !resZonas.find(z => z.id === zonaActiva))) {
        setZonaActiva(resZonas[0].id);
      } else if (resZonas.length === 0) {
        setZonaActiva(null);
      }

      setError(null);
    } catch (err: any) {
      console.error("Error al cargar mesas y zonas:", err);
      setError(`Error al cargar mesas: ${err?.message || JSON.stringify(err) || "Error desconocido"}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarDatos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const mesasFiltradas = mesas.filter((m) => m.zona_id === zonaActiva);

  // --- Lógica Drag & Drop ---
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>, mesa: Mesa) => {
    if (!editMode || e.button !== 0) return;

    e.currentTarget.setPointerCapture(e.pointerId);
    setDraggingId(mesa.id);

    dragStartRef.current = {
      pointerX: e.clientX,
      pointerY: e.clientY,
      tableX: mesa.pos_x,
      tableY: mesa.pos_y,
      hasMoved: false,
    };

    e.stopPropagation();
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>, mesaId: number) => {
    if (!editMode || draggingId !== mesaId) return;

    const deltaX = e.clientX - dragStartRef.current.pointerX;
    const deltaY = e.clientY - dragStartRef.current.pointerY;

    if (Math.abs(deltaX) > 4 || Math.abs(deltaY) > 4) {
      dragStartRef.current.hasMoved = true;
    }

    let nextX = dragStartRef.current.tableX + deltaX;
    let nextY = dragStartRef.current.tableY + deltaY;

    const GRID_SIZE = 10;
    nextX = Math.round(nextX / GRID_SIZE) * GRID_SIZE;
    nextY = Math.round(nextY / GRID_SIZE) * GRID_SIZE;

    if (canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      const mesa = mesas.find(m => m.id === mesaId);
      if (mesa) {
        nextX = Math.max(0, Math.min(nextX, rect.width - mesa.ancho));
        nextY = Math.max(0, Math.min(nextY, rect.height - mesa.alto));
      }
    }

    setMesas((prev) =>
      prev.map((m) => (m.id === mesaId ? { ...m, pos_x: nextX, pos_y: nextY } : m))
    );
  };

  const handlePointerUp = async (e: React.PointerEvent<HTMLDivElement>, mesa: Mesa) => {
    if (editMode && draggingId === mesa.id) {
      e.currentTarget.releasePointerCapture(e.pointerId);
      setDraggingId(null);

      const { hasMoved } = dragStartRef.current;
      if (!hasMoved) {
        setConfigMesa(mesa); // Clic en modo edición abre config
      } else {
        try {
          await api.actualizarPosicionMesa(mesa.id, mesa.pos_x, mesa.pos_y);
        } catch (err) {
          console.error("Error al guardar posición:", err);
        }
      }
    } else if (!editMode) {
      // Modo normal (Camareros): abre pedido
      setSelectedMesa(mesa);
    }
  };

  // --- Gestión de Zonas ---
  const handleAñadirZona = async () => {
    const nombre = await showPrompt({
      title: "Nueva Zona",
      message: "Nombre de la nueva zona (ej. Terraza)"
    });
    if (!nombre || nombre.trim() === "") return;
    try {
      await api.crearZona({ nombre });
      cargarDatos();
    } catch (err) {
      await showAlert({ title: "Error", message: "Error al crear zona", type: "danger" });
    }
  };

  const handleEliminarZona = async () => {
    if (!zonaActiva) return;
    const zonaActual = zonas.find(z => z.id === zonaActiva);
    if (!zonaActual) return;

    const confirmed = await showConfirm({
      title: "Confirmar Eliminación",
      message: `¿Seguro que quieres eliminar la zona "${zonaActual.nombre}" y TODAS SUS MESAS?`,
      type: "warning"
    });

    if (confirmed) {
      try {
        await api.eliminarZona(zonaActiva);
        cargarDatos();
      } catch (err) {
        await showAlert({ title: "Error", message: "Error al eliminar zona", type: "danger" });
      }
    }
  };

  const getMesaClaseEstado = (estado: string) => {
    switch (estado) {
      case "ocupada": return "mesa-ocupada";
      case "por_cobrar": return "mesa-por-cobrar";
      default: return "mesa-libre";
    }
  };

  // Escalar el tamaño de la fuente para que el texto ocupe el máximo sin salirse
  const getFontSize = (text: string, ancho: number, forma: string) => {
    const maxW = forma === 'circular' ? ancho * 0.70 : ancho * 0.85;
    // Si el texto es largo, se envolverá en 2 líneas (gracias a line-clamp: 2)
    const effectiveLength = text.length > 10 ? Math.ceil(text.length / 2) : text.length;
    // Estimación: 1 caracter ocupa aprox 0.55em de ancho
    let fs = maxW / (Math.max(effectiveLength, 3) * 0.55);
    // Limitamos a un tamaño lógico entre 9px y 18px
    fs = Math.min(Math.max(fs, 9), 18);
    return `${fs}px`;
  };

  if (loading && zonas.length === 0) {
    return <div className="mesas-loading">Cargando distribución del bar...</div>;
  }

  return (
    <div className="mesas-panel-container">
      {/* Controles Administrativos */}
      {esAdmin && (
        <div className="mesas-admin-toolbar">
          <label className="switch-edit-mode">
            <input
              type="checkbox"
              checked={editMode}
              onChange={(e) => setEditMode(e.target.checked)}
            />
            <span>Modo Edición de Planta</span>
          </label>

          {editMode && (
            <div className="admin-actions">
              <button className="caja-btn-secondary" onClick={handleAñadirZona}>+ Añadir Zona</button>
              {zonaActiva && (
                <>
                  <button className="caja-btn-secondary" onClick={() => setConfigMesa("NUEVA")}>+ Añadir Mesa</button>
                  <button className="caja-btn-secondary" style={{ color: '#ef4444', borderColor: '#ef4444' }} onClick={handleEliminarZona}>Eliminar Zona</button>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* Selector de Zonas */}
      {zonas.length > 0 ? (
        <div className="zonas-tabs">
          {zonas.map((zona) => (
            <button
              key={zona.id}
              className={`zona-tab-btn ${zonaActiva === zona.id ? "active" : ""}`}
              onClick={() => setZonaActiva(zona.id)}
            >
              {zona.nombre}
            </button>
          ))}
        </div>
      ) : (
        <div className="mesas-error-banner" style={{ margin: '1rem', backgroundColor: 'transparent' }}>
          No hay zonas configuradas. {esAdmin && editMode && "Haz clic en '+ Añadir Zona' para empezar."}
        </div>
      )}

      {error && <div className="mesas-error-banner">{error}</div>}

      {/* Plano de distribución */}
      <div className={`floorplan-canvas ${editMode ? 'edit-mode' : ''}`} ref={canvasRef}>
        <div className="floorplan-grid-overlay" />

        {mesasFiltradas.map((mesa) => (
          <div
            key={mesa.id}
            className={`mesa-item ${getMesaClaseEstado(mesa.estado)} ${mesa.forma} ${draggingId === mesa.id ? "dragging" : ""}`}
            style={{
              left: `${mesa.pos_x}px`,
              top: `${mesa.pos_y}px`,
              width: `${mesa.ancho}px`,
              height: `${mesa.alto}px`,
              cursor: editMode ? (draggingId === mesa.id ? 'grabbing' : 'grab') : 'pointer',
            }}
            onPointerDown={(e) => handlePointerDown(e, mesa)}
            onPointerMove={(e) => handlePointerMove(e, mesa.id)}
            onPointerUp={(e) => handlePointerUp(e, mesa)}
          >
            <div className="mesa-badge-capacidad"><User size={10} style={{ verticalAlign: 'middle', marginRight: 2 }} />{mesa.capacidad}</div>
            <div className="mesa-nombre" style={{ fontSize: getFontSize(mesa.nombre, mesa.ancho, mesa.forma) }}>{mesa.nombre}</div>
            {mesa.estado === "ocupada" && !editMode && <div className="mesa-indicador-punto"></div>}
          </div>
        ))}
      </div>

      <div className="mesas-leyenda">
        <div className="leyenda-item">
          <span className="leyenda-color color-gris"></span>
          <span>Libre</span>
        </div>
        <div className="leyenda-item">
          <span className="leyenda-color color-verde"></span>
          <span>Ocupada (Consumos)</span>
        </div>
        <div className="leyenda-item">
          <span className="leyenda-color color-naranja"></span>
          <span>Ticket Impreso</span>
        </div>
      </div>

      {/* Modales */}
      {selectedMesa && !editMode && (
        <OrderModal
          mesa={selectedMesa}
          usuarioId={usuarioId}
          onClose={() => {
            setSelectedMesa(null);
            cargarDatos();
          }}
        />
      )}

      {configMesa && zonaActiva && editMode && (
        <MesaConfigModal
          zonaId={zonaActiva}
          mesaAEditar={configMesa === "NUEVA" ? null : configMesa}
          onClose={() => setConfigMesa(null)}
          onGuardado={cargarDatos}
        />
      )}
    </div>
  );
}
