import { useEffect, useState } from "react";
import { api, type Mesa, type Producto, type Familia, type VentaCompleta } from "../../lib/api";
import { CheckoutModal } from "./CheckoutModal";
import { SelectorModificadoresModal } from "./SelectorModificadoresModal";
import { TecladoNumericoModal } from "../../components/TecladoNumericoModal";
import { useDialog } from "../../context/DialogContext";
import { X, Utensils, Receipt, Banknote, Trash2, Coffee, Minus, Plus, Edit2, ArrowLeftRight } from "lucide-react";
import type { GrupoModificadoresConElementos } from "../../lib/api";
import "./OrderModal.css";

interface OrderModalProps {
  mesa: Mesa;
  usuarioId: number;
  onClose: () => void;
}

export function OrderModal({ mesa, usuarioId, onClose }: OrderModalProps) {
  const [familias, setFamilias] = useState<Familia[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [mesas, setMesas] = useState<Mesa[]>([]);
  const [familiaActiva, setFamiliaActiva] = useState<number | null>(null);
  
  // Lista de comandas activas para esta mesa (pueden ser múltiples si está dividida)
  const [ventasActivas, setVentasActivas] = useState<VentaCompleta[]>([]);
  
  const [busqueda, setBusqueda] = useState("");
  
  // Checkout overlay
  const [checkoutVenta, setCheckoutVenta] = useState<VentaCompleta | null>(null);
  const [loading, setLoading] = useState(true);
  const [mesaEstado, setMesaEstado] = useState(mesa.estado);
  const { showAlert, showConfirm } = useDialog();

  // Modificadores
  const [showSelectorModificadores, setShowSelectorModificadores] = useState(false);
  const [modificadoresProducto, setModificadoresProducto] = useState<GrupoModificadoresConElementos[]>([]);
  const [productoParaModificar, setProductoParaModificar] = useState<Producto | null>(null);

  // Traspaso entre mesas
  const [showTraspasarModal, setShowTraspasarModal] = useState(false);

  // Teclado Numérico Modal
  const [tecladoNumerico, setTecladoNumerico] = useState<{
    isOpen: boolean;
    title: string;
    message?: string;
    defaultValue?: string;
    placeholder?: string;
    onAccept: (val: string) => void;
  } | null>(null);

  // La comanda principal de la mesa (siempre la primera de la lista de activas)
  const ventaActiva = ventasActivas[0] || null;

  useEffect(() => {
    const cargarCatalogoyVenta = async () => {
      try {
        setLoading(true);
        // Cargar familias y productos del catálogo
        const resFamilias = await api.listarFamilias();
        const resProductos = await api.listarProductos();
        const resMesas = await api.listarMesas();
        setFamilias(resFamilias);
        setProductos(resProductos);
        setMesas(resMesas);
        
        if (resFamilias.length > 0) {
          setFamiliaActiva(resFamilias[0].id);
        }

        // Cargar comandas activas de la mesa
        const ventas = await api.obtenerVentasActivasMesa(mesa.id);
        setVentasActivas(ventas);
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

  const recargarVentas = async () => {
    try {
      const ventas = await api.obtenerVentasActivasMesa(mesa.id);
      setVentasActivas(ventas);
      if (ventas.length === 0) {
        setMesaEstado("libre");
      }
    } catch (err) {
      console.error("Error al recargar ventas:", err);
    }
  };

  const handleAgregarProducto = async (productoId: number) => {
    try {
      const prod = productos.find(p => p.id === productoId);
      if (!prod) return;

      // 1. Verificar si el producto tiene modificadores
      const mods = await api.obtenerModificadoresProducto(productoId);
      if (mods && mods.length > 0) {
        setProductoParaModificar(prod);
        setModificadoresProducto(mods);
        setShowSelectorModificadores(true);
        return;
      }

      if (prod.precio === 0) {
        setTecladoNumerico({
          isOpen: true,
          title: "Precio Personalizado",
          message: `Introduce el precio para ${prod.nombre} (€):`,
          placeholder: "0,00",
          defaultValue: "",
          onAccept: async (precioInput) => {
            setTecladoNumerico(null);
            const parsed = parseFloat(precioInput);
            if (isNaN(parsed) || parsed < 0) {
              await showAlert({ title: "Error", message: "Precio inválido.", type: "danger" });
              return;
            }
            try {
              await api.agregarProductoMesa(mesa.id, usuarioId, productoId, 1, parsed);
              await recargarVentas();
              if (mesaEstado === "libre") {
                setMesaEstado("ocupada");
              }
            } catch (err) {
              console.error("Error al añadir producto con precio personalizado:", err);
              await showAlert({ title: "Error", message: "No se pudo añadir el producto al pedido.", type: "danger" });
            }
          }
        });
        return;
      }

      // Agregar 1 unidad
      await api.agregarProductoMesa(mesa.id, usuarioId, productoId, 1, undefined);
      await recargarVentas();
      
      if (mesaEstado === "libre") {
        setMesaEstado("ocupada");
      }
    } catch (err) {
      console.error("Error al añadir producto:", err);
      await showAlert({ title: "Error", message: "No se pudo añadir el producto al pedido.", type: "danger" });
    }
  };

  const handleSaveModificadores = async (seleccionados: number[]) => {
    if (!productoParaModificar) return;
    try {
      await api.agregarProductoMesaConModificadores(
        mesa.id,
        usuarioId,
        productoParaModificar.id,
        1,
        seleccionados
      );
      await recargarVentas();
      if (mesaEstado === "libre") {
        setMesaEstado("ocupada");
      }
      setShowSelectorModificadores(false);
      setProductoParaModificar(null);
    } catch (err) {
      console.error("Error al guardar modificadores:", err);
      await showAlert({ title: "Error", message: "No se pudo añadir el producto con modificadores.", type: "danger" });
    }
  };


  const handleCambiarCantidad = async (productoId: number, cantidadActual: number, delta: number) => {
    try {
      const nuevaCantidad = cantidadActual + delta;
      await api.actualizarCantidadProductoMesa(mesa.id, usuarioId, productoId, nuevaCantidad);
      await recargarVentas();
    } catch (err) {
      console.error("Error al modificar cantidad de producto:", err);
    }
  };

  const handleCambiarPrecioLinea = (productoId: number, nombreProducto: string) => {
    const linea = ventaActiva?.lineas.find(l => l.producto_id === productoId);
    const precioActual = linea ? (linea.total / linea.cantidad).toFixed(2) : "";

    setTecladoNumerico({
      isOpen: true,
      title: "Modificar Precio",
      message: `Introduce el nuevo precio para ${nombreProducto} (€):`,
      defaultValue: precioActual,
      placeholder: "0,00",
      onAccept: async (precioInput) => {
        setTecladoNumerico(null);
        const parsed = parseFloat(precioInput);
        if (isNaN(parsed) || parsed < 0) {
          await showAlert({ title: "Error", message: "Precio inválido.", type: "danger" });
          return;
        }

        try {
          await api.actualizarPrecioProductoMesa(mesa.id, usuarioId, productoId, parsed);
          await recargarVentas();
        } catch (err) {
          console.error("Error al cambiar precio:", err);
          await showAlert({ title: "Error", message: "No se pudo cambiar el precio.", type: "danger" });
        }
      }
    });
  };

  const handleEliminarProducto = async (productoId: number) => {
    try {
      await api.eliminarProductoMesa(mesa.id, productoId);
      await recargarVentas();
    } catch (err) {
      console.error("Error al eliminar producto del pedido:", err);
    }
  };

  const handleConfirmarTraspaso = async (destId: number, destNombre: string) => {
    const confirm = await showConfirm({
      title: "Confirmar Traspaso",
      message: `¿Estás seguro de que deseas traspasar todo el pedido de la ${mesa.nombre} a la ${destNombre}?`
    });
    if (!confirm) return;

    try {
      setLoading(true);
      await api.traspasarComanda(mesa.id, destId);
      setShowTraspasarModal(false);
      await showAlert(`Pedido traspasado con éxito a la mesa ${destNombre}.`);
      onClose();
    } catch (err) {
      console.error("Error al traspasar comanda:", err);
      await showAlert({ title: "Error", message: "No se pudo realizar el traspaso: " + err, type: "danger" });
    } finally {
      setLoading(false);
    }
  };

  const handleMoverItem = async (lineaId: number, destinoVentaId: number) => {
    try {
      await api.moverLineaComanda(lineaId, destinoVentaId, 1);
      await recargarVentas();
    } catch (err) {
      console.error("Error al mover item:", err);
      await showAlert({ title: "Error", message: "No se pudo mover el producto.", type: "danger" });
    }
  };

  const handleDividirCuenta = async () => {
    try {
      setLoading(true);
      await api.crearDivisionCuenta(mesa.id, usuarioId);
      await recargarVentas();
    } catch (err) {
      console.error("Error al iniciar división de cuenta:", err);
      await showAlert({ title: "Error", message: "No se pudo iniciar la división de cuenta.", type: "danger" });
    } finally {
      setLoading(false);
    }
  };

  const handleFinalizarDivision = async () => {
    if (ventasActivas.length < 2) return;
    const confirm = await showConfirm({
      title: "Finalizar División",
      message: "¿Deseas fusionar todos los productos en la cuenta principal y cerrar la división?"
    });
    if (!confirm) return;

    try {
      setLoading(true);
      const mainVenta = ventasActivas[0];
      const splitVenta = ventasActivas[1];

      // Mover todas las líneas de la cuenta dividida a la principal
      for (const linea of splitVenta.lineas) {
        await api.moverLineaComanda(linea.id, mainVenta.id, linea.cantidad);
      }

      // Eliminar la cuenta dividida vacía
      await api.eliminarVentaVacia(splitVenta.id);
      await recargarVentas();
      await showAlert("Fusión completada con éxito.");
    } catch (err) {
      console.error("Error al fusionar cuentas:", err);
      await showAlert({ title: "Error", message: "No se pudo fusionar la división.", type: "danger" });
    } finally {
      setLoading(false);
    }
  };

  const renderVentaSection = (v: VentaCompleta, index: number) => {
    const isMain = index === 0;
    const lineas = v.lineas ?? [];
    const subtotal = v.subtotal ?? 0.0;
    const iva = v.total_iva ?? 0.0;
    const total = v.total ?? 0.0;

    return (
      <div key={v.id} className="order-section" style={{ borderBottom: index === 0 && ventasActivas.length > 1 ? '2px dashed var(--color-surface-border)' : 'none', paddingBottom: index === 0 && ventasActivas.length > 1 ? '1rem' : '0' }}>
        <div className="order-list-header" style={{ padding: '0.75rem 1rem' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 'bold' }}>
            {ventasActivas.length > 1 ? (isMain ? "Cuenta Principal" : "Cuenta Dividida") : "Consumos de la Mesa"}
          </h3>
          <span className="order-items-count">{lineas.length} productos</span>
        </div>

        <div className="order-items-list" style={{ padding: '0.5rem 1rem' }}>
          {lineas.map((linea) => (
            <div key={linea.id} className="order-item-row animate-fadeIn" style={{ padding: '0.5rem 0.75rem' }}>
              <div className="order-item-detail">
                <span className="order-item-name" style={{ fontSize: '0.9rem', fontWeight: '500' }}>{linea.producto_nombre}</span>
                {linea.modificadores && linea.modificadores.length > 0 && (
                  <div className="order-item-mods" style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '2px' }}>
                    {linea.modificadores.map(m => (
                      <span key={m.id} className="badge badge-secondary" style={{ fontSize: '0.7rem', padding: '2px 5px', borderRadius: '4px', backgroundColor: 'rgba(255,255,255,0.06)' }}>
                        {m.nombre} {m.precio_extra > 0 ? `(+${m.precio_extra.toFixed(2)}€)` : ''}
                      </span>
                    ))}
                  </div>
                )}

                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span className="order-item-price-unit" style={{ fontSize: '0.8rem' }}>{(linea.total / linea.cantidad).toFixed(2)} €/u</span>
                  <button 
                    className="btn-item-qty" 
                    style={{ padding: '2px', background: 'transparent', color: 'var(--color-text-secondary)', border: 'none', cursor: 'pointer' }}
                    onClick={() => handleCambiarPrecioLinea(linea.producto_id, linea.producto_nombre)}
                    title="Modificar Precio"
                  >
                    <Edit2 size={11} />
                  </button>
                </div>
              </div>

              <div className="order-item-controls" style={{ gap: '0.5rem' }}>
                {/* Botón Mover Item (solo en modo split) */}
                {ventasActivas.length > 1 && (
                  <button
                    className="btn-item-qty"
                    onClick={() => handleMoverItem(linea.id, isMain ? ventasActivas[1].id : ventasActivas[0].id)}
                    title="Mover 1 unidad"
                    style={{ background: 'rgba(99, 102, 241, 0.1)', color: 'var(--color-accent)', border: 'none', padding: '4px 6px', display: 'flex', alignItems: 'center', gap: '2px', borderRadius: '6px' }}
                  >
                    <ArrowLeftRight size={12} />
                    <span style={{ fontSize: '0.75rem', fontWeight: 'bold' }}>Mover</span>
                  </button>
                )}

                <button
                  className="btn-item-qty"
                  onClick={() => handleCambiarCantidad(linea.producto_id, linea.cantidad, -1)}
                >
                  <Minus size={14} />
                </button>
                <span className="order-item-qty" style={{ fontSize: '0.9rem', minWidth: '16px', textAlign: 'center' }}>{linea.cantidad}</span>
                <button
                  className="btn-item-qty"
                  onClick={() => handleAgregarProducto(linea.producto_id)}
                >
                  <Plus size={14} />
                </button>
                
                <span className="order-item-total" style={{ fontSize: '0.9rem', fontWeight: 'bold', minWidth: '60px', textAlign: 'right' }}>{(linea.total).toFixed(2)} €</span>
                
                <button
                  className="btn-item-delete"
                  title="Eliminar producto"
                  onClick={() => handleEliminarProducto(linea.producto_id)}
                  style={{ padding: '4px' }}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}

          {lineas.length === 0 && (
            <div className="order-empty-state" style={{ padding: '1rem' }}>
              <span className="order-empty-icon"><Coffee size={32} /></span>
              <p style={{ fontSize: '0.85rem' }}>Mesa vacía. Añade productos desde el catálogo para abrir la cuenta.</p>
            </div>
          )}
        </div>

        {/* Resumen del pedido y botón cobrar */}
        <div className="order-summary-section" style={{ padding: '0.75rem 1rem' }}>
          <div className="summary-row" style={{ fontSize: '0.85rem' }}>
            <span>Subtotal (Base Imponible)</span>
            <span>{subtotal.toFixed(2)} €</span>
          </div>
          <div className="summary-row" style={{ fontSize: '0.85rem' }}>
            <span>IVA (10%)</span>
            <span>{iva.toFixed(2)} €</span>
          </div>
          <div className="summary-row summary-total" style={{ fontSize: '1rem', marginTop: '4px' }}>
            <span>Total a Pagar</span>
            <span>{total.toFixed(2)} €</span>
          </div>

          <div className="order-actions" style={{ marginTop: '0.5rem', gap: '0.5rem' }}>
            <button
              className="btn btn-secondary btn-ticket"
              onClick={() => handleGenerarTicket(v.id)}
              disabled={lineas.length === 0}
              style={{ padding: '8px 12px', fontSize: '0.9rem' }}
            >
              <Receipt size={16} style={{marginRight: 6, verticalAlign: 'middle'}}/> Ticket
            </button>
            
            <button
              className="btn btn-primary btn-pay"
              onClick={() => setCheckoutVenta(v)}
              disabled={lineas.length === 0}
              style={{ padding: '8px 12px', fontSize: '0.9rem' }}
            >
              <Banknote size={16} style={{marginRight: 6, verticalAlign: 'middle'}}/> Cobrar
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Generar / Imprimir Ticket
  const handleGenerarTicket = async (ventaId: number) => {
    try {
      await api.imprimirTicketVenta(ventaId);
      await recargarVentas();
      await showAlert("Ticket generado correctamente.");
    } catch (err) {
      console.error("Error al imprimir ticket:", err);
      await showAlert({ title: "Error", message: "Error al generar el ticket.", type: "danger" });
    }
  };

  if (loading) {
    return (
      <div className="modal-overlay">
        <div className="order-modal-loading">Cargando catálogo y pedido...</div>
      </div>
    );
  }

  return (
    <div className="modal-overlay">
      <div className="order-modal-container animate-slideUp">
        {/* Cabecera del pedido */}
        <header className="order-modal-header">
          <div className="order-header-left">
            <span className="order-header-icon"><Utensils size={24} /></span>
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
            
            {/* Botón de Traspasar Mesa */}
            <button
              className="btn btn-secondary"
              onClick={() => setShowTraspasarModal(true)}
              style={{ marginLeft: '1.5rem', display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', fontSize: '0.85rem' }}
            >
              <ArrowLeftRight size={16} />
              Traspasar Mesa
            </button>
          </div>
          <button className="btn-close-modal" onClick={onClose} title="Cerrar y guardar cambios">
            <X size={24} />
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
                <button className="btn-clear-search" onClick={() => setBusqueda("")}><X size={16} /></button>
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

          {/* SECCIÓN DERECHA: Sidebar de Comandas (Principal y/o Dividida) */}
          <div className="orders-sidebar">
            {/* Barra de Acciones de Cuenta (Dividir / Unir) */}
            <div className="orders-sidebar-actions" style={{ display: 'flex', gap: '0.5rem', padding: '0.75rem 1rem', borderBottom: '1px solid var(--color-surface-border)', background: 'var(--color-bg-primary)', flexShrink: 0 }}>
              {ventasActivas.length === 1 ? (
                <button
                  className="btn btn-secondary"
                  onClick={handleDividirCuenta}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', background: 'rgba(99, 102, 241, 0.1)', color: 'var(--color-accent)', borderColor: 'var(--color-accent)' }}
                >
                  <ArrowLeftRight size={18} />
                  Dividir Cuenta
                </button>
              ) : (
                <button
                  className="btn btn-secondary"
                  onClick={handleFinalizarDivision}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', background: 'rgba(239, 68, 68, 0.1)', color: 'var(--color-danger)', borderColor: 'var(--color-danger)' }}
                >
                  <ArrowLeftRight size={18} />
                  Finalizar División
                </button>
              )}
            </div>

            {/* Listado de las ventas activas */}
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflowY: 'auto', gap: '0.5rem' }}>
              {ventasActivas.map((v, index) => renderVentaSection(v, index))}
            </div>
          </div>
        </div>
      </div>

      {/* Modal de Cobro */}
      {checkoutVenta && (
        <CheckoutModal
          mesa={mesa}
          ventaId={checkoutVenta.id}
          total={checkoutVenta.total}
          onClose={() => setCheckoutVenta(null)}
          onSuccess={async () => {
            setCheckoutVenta(null);
            // Recargar ventas activas
            const remaining = await api.obtenerVentasActivasMesa(mesa.id);
            setVentasActivas(remaining);
            if (remaining.length === 0) {
              onClose(); // Cerrar todo el modal del pedido si no quedan cuentas abiertas
            }
          }}
        />
      )}

      {/* Selector de Modificadores */}
      {showSelectorModificadores && productoParaModificar && (
        <SelectorModificadoresModal
          producto={productoParaModificar}
          grupos={modificadoresProducto}
          onClose={() => {
            setShowSelectorModificadores(false);
            setProductoParaModificar(null);
          }}
          onSave={handleSaveModificadores}
        />
      )}

      {/* Popup de Traspasar Mesa */}
      {showTraspasarModal && (
        <div className="modal-overlay animate-fadeIn" style={{ zIndex: 1200 }}>
          <div className="numpad-modal-card animate-slideUp" style={{ maxWidth: '500px', width: '90%' }}>
            <header className="numpad-modal-header">
              <h3>Traspasar Pedido a otra Mesa</h3>
              <button className="numpad-modal-close" onClick={() => setShowTraspasarModal(false)}>
                <X size={20} />
              </button>
            </header>
            <div className="numpad-modal-body" style={{ maxHeight: '400px', overflowY: 'auto' }}>
              <p style={{ color: 'var(--color-text-secondary)', marginBottom: '1.5rem', textAlign: 'center' }}>
                Selecciona la mesa de destino a la que quieres transferir toda la comanda actual de la <strong>{mesa.nombre}</strong>.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: '0.75rem' }}>
                {mesas
                  .filter((m) => m.id !== mesa.id && m.activa)
                  .map((m) => {
                    const isOccupied = m.estado !== "libre";
                    return (
                      <button
                        key={m.id}
                        onClick={() => handleConfirmarTraspaso(m.id, m.nombre)}
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          padding: '0.75rem',
                          borderRadius: '12px',
                          background: 'var(--color-bg-tertiary)',
                          border: '1px solid var(--color-surface-border)',
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                        }}
                      >
                        <span style={{ fontSize: '1rem', fontWeight: 'bold', color: 'var(--color-text-primary)' }}>{m.nombre}</span>
                        <span style={{
                          fontSize: '0.75rem',
                          marginTop: '4px',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          background: isOccupied ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                          color: isOccupied ? '#f87171' : '#34d399'
                        }}>
                          {isOccupied ? 'Ocupada' : 'Libre'}
                        </span>
                      </button>
                    );
                  })}
              </div>
            </div>
            <footer className="numpad-modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowTraspasarModal(false)}>Cancelar</button>
            </footer>
          </div>
        </div>
      )}

      {/* Teclado Numérico Tactil (Popup) */}
      {tecladoNumerico && tecladoNumerico.isOpen && (
        <TecladoNumericoModal
          title={tecladoNumerico.title}
          message={tecladoNumerico.message}
          defaultValue={tecladoNumerico.defaultValue}
          placeholder={tecladoNumerico.placeholder}
          onClose={() => setTecladoNumerico(null)}
          onAccept={tecladoNumerico.onAccept}
        />
      )}
    </div>
  );
}
