import { useEffect, useState } from "react";
import { api, type Mesa, type Producto, type Familia, type VentaCompleta } from "../../lib/api";
import { CheckoutModal } from "./CheckoutModal";
import "./OrderModal.css";

interface OrderModalProps {
  mesa: Mesa;
  usuarioId: number;
  onClose: () => void;
}

export function OrderModal({ mesa, usuarioId, onClose }: OrderModalProps) {
  const [familias, setFamilias] = useState<Familia[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [familiaActiva, setFamiliaActiva] = useState<number | null>(null);
  const [ventaActiva, setVentaActiva] = useState<VentaCompleta | null>(null);
  const [busqueda, setBusqueda] = useState("");
  
  // Checkout overlay
  const [showCheckout, setShowCheckout] = useState(false);
  const [loading, setLoading] = useState(true);
  const [mesaEstado, setMesaEstado] = useState(mesa.estado);

  useEffect(() => {
    const cargarCatalogoyVenta = async () => {
      try {
        setLoading(true);
        // Cargar familias y productos del catálogo
        const resFamilias = await api.listarFamilias();
        const resProductos = await api.listarProductos();
        setFamilias(resFamilias);
        setProductos(resProductos);
        
        if (resFamilias.length > 0) {
          setFamiliaActiva(resFamilias[0].id);
        }

        // Cargar pedido activo de la mesa
        const venta = await api.obtenerVentaActivaMesa(mesa.id);
        setVentaActiva(venta);
      } catch (err) {
        console.error("Error al inicializar la pantalla de pedido:", err);
      } finally {
        setLoading(false);
      }
    };

    cargarCatalogoyVenta();
  }, [mesa.id]);

  // Filtrado de productos por familia y búsqueda
  const productosFiltrados = productos.filter((prod) => {
    const coincideFamilia = familiaActiva === null || prod.familia_id === familiaActiva;
    const coincideBusqueda = prod.nombre.toLowerCase().includes(busqueda.toLowerCase());
    return coincideFamilia && coincideBusqueda;
  });

  // Acciones de Pedido

  const handleAgregarProducto = async (productoId: number) => {
    try {
      // Agregar 1 unidad
      const ventaActualizada = await api.agregarProductoMesa(mesa.id, usuarioId, productoId, 1);
      setVentaActiva(ventaActualizada);
      
      // Si la mesa estaba libre (Gris), ahora pasará a ocupada (Verde) en el backend.
      // Lo reflejamos en el estado local del modal para habilitar acciones.
      if (mesaEstado === "libre") {
        setMesaEstado("ocupada");
      }
    } catch (err) {
      console.error("Error al añadir producto:", err);
      alert("No se pudo añadir el producto al pedido.");
    }
  };

  const handleCambiarCantidad = async (productoId: number, cantidadActual: number, delta: number) => {
    try {
      const nuevaCantidad = cantidadActual + delta;
      const ventaActualizada = await api.actualizarCantidadProductoMesa(mesa.id, usuarioId, productoId, nuevaCantidad);
      setVentaActiva(ventaActualizada);

      // Si el pedido se quedó vacío, la mesa vuelve a estar libre
      if (!ventaActualizada || ventaActualizada.lineas.length === 0) {
        setMesaEstado("libre");
      }
    } catch (err) {
      console.error("Error al modificar cantidad de producto:", err);
    }
  };

  const handleEliminarProducto = async (productoId: number) => {
    try {
      const ventaActualizada = await api.eliminarProductoMesa(mesa.id, productoId);
      setVentaActiva(ventaActualizada);

      if (!ventaActualizada || ventaActualizada.lineas.length === 0) {
        setMesaEstado("libre");
      }
    } catch (err) {
      console.error("Error al eliminar producto del pedido:", err);
    }
  };

  // Generar / Imprimir Ticket
  const handleGenerarTicket = async () => {
    if (!ventaActiva || ventaActiva.lineas.length === 0) {
      alert("No se puede generar un ticket de un pedido vacío.");
      return;
    }
    try {
      await api.imprimirTicketMesa(mesa.id);
      setMesaEstado("por_cobrar");
      alert(`🧾 Ticket generado correctamente para ${mesa.nombre}.`);
    } catch (err) {
      console.error("Error al imprimir ticket:", err);
      alert("Error al generar el ticket.");
    }
  };

  if (loading) {
    return (
      <div className="modal-overlay">
        <div className="order-modal-loading">Cargando catálogo y pedido...</div>
      </div>
    );
  }

  const subtotal = ventaActiva?.subtotal ?? 0.0;
  const iva = ventaActiva?.total_iva ?? 0.0;
  const total = ventaActiva?.total ?? 0.0;
  const lineas = ventaActiva?.lineas ?? [];

  return (
    <div className="modal-overlay">
      <div className="order-modal-container animate-slideUp">
        {/* Cabecera del pedido */}
        <header className="order-modal-header">
          <div className="order-header-left">
            <span className="order-header-icon">🍽️</span>
            <div>
              <h2>Pedido — {mesa.nombre}</h2>
              <span className="order-header-status">
                Estado: {
                  mesaEstado === "libre" ? (
                    <span className="status-badge status-libre">Libre (Gris)</span>
                  ) : mesaEstado === "ocupada" ? (
                    <span className="status-badge status-ocupada">Ocupada (Verde)</span>
                  ) : (
                    <span className="status-badge status-por-cobrar">Por Cobrar (Naranja)</span>
                  )
                }
              </span>
            </div>
          </div>
          <button className="btn-close-modal" onClick={onClose} title="Cerrar y guardar cambios">
            ✕
          </button>
        </header>

        <div className="order-modal-body">
          {/* SECCIÓN IZQUIERDA: Catálogo de Productos */}
          <div className="catalog-section">
            <div className="catalog-search-bar">
              <input
                type="text"
                className="input input-lg"
                placeholder="Buscar producto por nombre..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
              />
              {busqueda && (
                <button className="btn-clear-search" onClick={() => setBusqueda("")}>✕</button>
              )}
            </div>

            {/* Categorías (Familias) */}
            <div className="catalog-families-nav">
              <button
                className={`family-nav-btn ${familiaActiva === null ? "active" : ""}`}
                onClick={() => setFamiliaActiva(null)}
              >
                Todos
              </button>
              {familias.map((fam) => (
                <button
                  key={fam.id}
                  className={`family-nav-btn ${familiaActiva === fam.id ? "active" : ""}`}
                  style={{
                    borderBottomColor: fam.color,
                    boxShadow: familiaActiva === fam.id ? `0 2px 8px ${fam.color}40` : "none"
                  }}
                  onClick={() => setFamiliaActiva(fam.id)}
                >
                  {fam.nombre}
                </button>
              ))}
            </div>

            {/* Rejilla de productos */}
            <div className="catalog-grid">
              {productosFiltrados.map((prod) => {
                const familia = familias.find((f) => f.id === prod.familia_id);
                const colorBorde = familia?.color ?? "var(--color-surface-border)";
                
                return (
                  <button
                    key={prod.id}
                    className="product-card"
                    style={{ borderLeft: `4px solid ${colorBorde}` }}
                    onClick={() => handleAgregarProducto(prod.id)}
                  >
                    <div className="product-card-info">
                      <span className="product-card-name">{prod.nombre}</span>
                      <span className="product-card-price">{prod.precio.toFixed(2)} €</span>
                    </div>
                  </button>
                );
              })}

              {productosFiltrados.length === 0 && (
                <div className="catalog-empty">
                  No se encontraron productos en esta sección.
                </div>
              )}
            </div>
          </div>

          {/* SECCIÓN DERECHA: Lista del Pedido Actual */}
          <div className="order-section">
            <div className="order-list-header">
              <h3>Consumos de la Mesa</h3>
              <span className="order-items-count">{lineas.length} productos</span>
            </div>

            <div className="order-items-list">
              {lineas.map((linea) => (
                <div key={linea.id} className="order-item-row animate-fadeIn">
                  <div className="order-item-detail">
                    <span className="order-item-name">{linea.producto_nombre}</span>
                    <span className="order-item-price-unit">{linea.total / linea.cantidad} €/u</span>
                  </div>

                  <div className="order-item-controls">
                    <button
                      className="btn-item-qty"
                      onClick={() => handleCambiarCantidad(linea.producto_id, linea.cantidad, -1)}
                    >
                      －
                    </button>
                    <span className="order-item-qty">{linea.cantidad}</span>
                    <button
                      className="btn-item-qty"
                      onClick={() => handleAgregarProducto(linea.producto_id)}
                    >
                      ＋
                    </button>
                    
                    <span className="order-item-total">{(linea.total).toFixed(2)} €</span>
                    
                    <button
                      className="btn-item-delete"
                      title="Eliminar producto"
                      onClick={() => handleEliminarProducto(linea.producto_id)}
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              ))}

              {lineas.length === 0 && (
                <div className="order-empty-state">
                  <span className="order-empty-icon">☕</span>
                  <p>Mesa vacía. Añade productos desde el catálogo para abrir la cuenta.</p>
                </div>
              )}
            </div>

            {/* Resumen del pedido y botón cobrar */}
            <div className="order-summary-section">
              <div className="summary-row">
                <span>Subtotal (Base Imponible)</span>
                <span>{subtotal.toFixed(2)} €</span>
              </div>
              <div className="summary-row">
                <span>IVA (10%)</span>
                <span>{iva.toFixed(2)} €</span>
              </div>
              <div className="summary-row summary-total">
                <span>Total a Pagar</span>
                <span>{total.toFixed(2)} €</span>
              </div>

              <div className="order-actions">
                <button
                  className="btn btn-secondary btn-lg btn-ticket"
                  onClick={handleGenerarTicket}
                  disabled={lineas.length === 0}
                >
                  🧾 Generar Ticket
                </button>
                
                <button
                  className="btn btn-primary btn-lg btn-pay"
                  onClick={() => setShowCheckout(true)}
                  disabled={lineas.length === 0}
                >
                  💵 Cobrar Cuenta
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal de Cobro */}
      {showCheckout && ventaActiva && (
        <CheckoutModal
          mesa={mesa}
          total={total}
          onClose={() => setShowCheckout(false)}
          onSuccess={() => {
            setShowCheckout(false);
            onClose(); // Cerrar la pantalla del pedido completa
          }}
        />
      )}
    </div>
  );
}
