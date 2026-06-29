import { useState, useEffect } from "react";
import { api, Familia, Producto } from "../../lib/api";
import { ProductoFormModal } from "./ProductoFormModal";
import { formatCurrency } from "../../lib/format";
import { useDialog } from "../../context/DialogContext";
import { Image as ImageIcon, Trash2, Plus } from "lucide-react";
import "./ProductosPanel.css";

// Un subcomponente para renderizar la imagen de un producto de forma segura
function ProductoImage({ path }: { path: string }) {
  const [b64, setB64] = useState<string | null>(null);

  useEffect(() => {
    if (path) {
      api.obtenerImagenB64(path)
        .then(setB64)
        .catch(() => setB64(null));
    }
  }, [path]);

  if (!b64) {
    return <div className="producto-no-img"><ImageIcon size={32} color="#ccc" /></div>;
  }
  return <img src={b64} alt="Producto" className="producto-img" />;
}

export function ProductosPanel() {
  const [familias, setFamilias] = useState<Familia[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [familiaActiva, setFamiliaActiva] = useState<number | null>(null);
  
  const [cargando, setCargando] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [productoEdit, setProductoEdit] = useState<Producto | null>(null);
  const { showPrompt, showConfirm, showAlert } = useDialog();

  const cargarDatos = async () => {
    setCargando(true);
    try {
      const fams = await api.listarFamilias();
      setFamilias(fams);
      const prods = await api.listarProductos();
      setProductos(prods);
      if (fams.length > 0 && familiaActiva === null) {
        setFamiliaActiva(fams[0].id);
      }
    } catch (error) {
      console.error("Error cargando catálogo:", error);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarDatos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleNuevoProducto = () => {
    setProductoEdit(null);
    setShowModal(true);
  };

  const handleEditarProducto = (p: Producto) => {
    setProductoEdit(p);
    setShowModal(true);
  };

  const handleCrearFamilia = async () => {
    const nombre = await showPrompt({
      title: "Nueva Familia",
      message: "Nombre de la nueva familia:"
    });
    if (!nombre) return;
    const colores = ["#ef4444", "#f97316", "#f59e0b", "#84cc16", "#22c55e", "#06b6d4", "#3b82f6", "#8b5cf6", "#d946ef", "#f43f5e"];
    const color = colores[Math.floor(Math.random() * colores.length)];
    try {
      await api.crearFamilia(nombre, color);
      cargarDatos();
    } catch (err) {
      await showAlert({ title: "Error", message: "Error al crear familia", type: "danger" });
    }
  };

  const handleEliminarFamilia = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    const isConfirmed = await showConfirm({
      title: "Confirmar eliminación",
      message: "¿Seguro que deseas eliminar esta familia? Sus productos ya no serán visibles en ella.",
      type: "warning"
    });
    if (!isConfirmed) return;
    try {
      await api.eliminarFamilia(id);
      if (familiaActiva === id) setFamiliaActiva(null);
      cargarDatos();
    } catch (err) {
      await showAlert({ title: "Error", message: "Error al eliminar familia", type: "danger" });
    }
  };

  const productosVisibles = productos.filter(p => familiaActiva === null || p.familia_id === familiaActiva);

  if (cargando && familias.length === 0) {
    return <div style={{ padding: '2rem' }}>Cargando catálogo...</div>;
  }

  return (
    <div className="productos-admin-container">
      {/* Sidebar de Familias */}
      <aside className="familias-sidebar">
        <div className="sidebar-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3>Familias</h3>
          <button className="btn-icon" onClick={handleCrearFamilia} title="Nueva Familia" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-primary)' }}>
            <Plus size={20} />
          </button>
        </div>
        <div className="familias-list">
          <div 
            className={`familia-item ${familiaActiva === null ? "active" : ""}`}
            onClick={() => setFamiliaActiva(null)}
          >
            <div className="familia-color-dot" style={{ backgroundColor: '#666' }}></div>
            <span style={{ flex: 1 }}>Todas</span>
          </div>
          {familias.map(f => (
            <div 
              key={f.id}
              className={`familia-item ${familiaActiva === f.id ? "active" : ""}`}
              onClick={() => setFamiliaActiva(f.id)}
            >
              <div className="familia-color-dot" style={{ backgroundColor: f.color || '#fff' }}></div>
              <span style={{ flex: 1 }}>{f.nombre}</span>
              <button 
                className="btn-delete-familia" 
                onClick={(e) => handleEliminarFamilia(e, f.id)}
                style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', opacity: 0.6 }}
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      </aside>

      {/* Grid principal de productos */}
      <main className="productos-main">
        <header className="productos-header">
          <h2>Catálogo de Productos</h2>
          <button className="caja-btn-primary" onClick={handleNuevoProducto} style={{ padding: '0.5rem 1rem', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Plus size={16} /> Nuevo Producto
          </button>
        </header>
        
        <div className="productos-grid">
          {productosVisibles.map(p => (
            <div key={p.id} className="producto-card" onClick={() => handleEditarProducto(p)}>
              <div className="producto-img-container">
                <ProductoImage path={p.imagen_path || ""} />
              </div>
              <div className="producto-info">
                <h4 className="producto-nombre" title={p.nombre}>{p.nombre}</h4>
                <div className="producto-precio">{formatCurrency(p.precio)}</div>
              </div>
            </div>
          ))}
          {productosVisibles.length === 0 && (
            <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '3rem', color: '#666' }}>
              No hay productos en esta familia.
            </div>
          )}
        </div>
      </main>

      {showModal && (
        <ProductoFormModal 
          familias={familias}
          familiaSeleccionada={familiaActiva}
          productoAEditar={productoEdit}
          onClose={() => setShowModal(false)}
          onGuardado={cargarDatos}
        />
      )}
    </div>
  );
}
