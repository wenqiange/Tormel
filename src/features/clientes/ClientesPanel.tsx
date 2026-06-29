import { useState, useEffect } from "react";
import { api, type Cliente } from "../../lib/api";
import { Users, Plus, Edit2, Trash2, Search } from "lucide-react";
import { ClienteFormModal } from "./ClienteFormModal";
import { useDialog } from "../../context/DialogContext";
import "./ClientesPanel.css";

export function ClientesPanel() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  
  const [showModal, setShowModal] = useState(false);
  const [clienteEditando, setClienteEditando] = useState<Cliente | undefined>(undefined);

  const { showConfirm, showAlert } = useDialog();

  const cargarClientes = async () => {
    try {
      setLoading(true);
      const data = await api.listarClientes();
      setClientes(data);
    } catch (err) {
      console.error("Error al cargar clientes:", err);
      await showAlert({ title: "Error", message: "No se pudieron cargar los clientes", type: "danger" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarClientes();
  }, []);

  const handleNuevo = () => {
    setClienteEditando(undefined);
    setShowModal(true);
  };

  const handleEditar = (cliente: Cliente) => {
    setClienteEditando(cliente);
    setShowModal(true);
  };

  const handleEliminar = async (cliente: Cliente) => {
    const confirm = await showConfirm({
      title: "Eliminar Cliente",
      message: `¿Estás seguro de eliminar a ${cliente.nombre}? Esta acción no se puede deshacer y fallará si tiene ventas asociadas.`,
      type: "danger"
    });

    if (confirm) {
      try {
        await api.eliminarCliente(cliente.id);
        cargarClientes();
      } catch (err) {
        console.error("Error al eliminar cliente:", err);
        await showAlert({ title: "Error", message: "Error al eliminar el cliente. Es posible que tenga facturas asociadas.", type: "danger" });
      }
    }
  };

  const clientesFiltrados = clientes.filter(c => 
    c.nombre.toLowerCase().includes(busqueda.toLowerCase()) || 
    (c.nif_cif && c.nif_cif.toLowerCase().includes(busqueda.toLowerCase()))
  );

  if (loading) {
    return <div className="panel-loading">Cargando clientes...</div>;
  }

  return (
    <div className="clientes-panel animate-fadeIn">
      <div className="panel-header">
        <div className="panel-header-left">
          <Users size={32} className="text-primary" />
          <div>
            <h2>Directorio de Clientes</h2>
            <p>Gestiona los datos fiscales de tus clientes para facturación</p>
          </div>
        </div>
        <div className="panel-header-right">
          <div className="search-box">
            <Search size={18} className="search-icon" />
            <input 
              type="text" 
              className="input" 
              placeholder="Buscar por nombre o NIF..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
          </div>
          <button className="btn btn-primary" onClick={handleNuevo}>
            <Plus size={20} style={{ marginRight: 8, verticalAlign: 'middle' }} />
            Nuevo Cliente
          </button>
        </div>
      </div>

      <div className="clientes-content">
        {clientesFiltrados.length === 0 ? (
          <div className="empty-state">
            <Users size={64} style={{ opacity: 0.2, marginBottom: 16 }} />
            <h3>No hay clientes</h3>
            <p>Añade clientes para poder generarles facturas personalizadas</p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>NIF/CIF</th>
                  <th>Teléfono</th>
                  <th>Email</th>
                  <th>Ciudad</th>
                  <th className="text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {clientesFiltrados.map((cliente) => (
                  <tr key={cliente.id}>
                    <td className="fw-500">{cliente.nombre}</td>
                    <td>{cliente.nif_cif || <span className="text-muted">—</span>}</td>
                    <td>{cliente.telefono || <span className="text-muted">—</span>}</td>
                    <td>{cliente.email || <span className="text-muted">—</span>}</td>
                    <td>{cliente.ciudad || <span className="text-muted">—</span>}</td>
                    <td className="text-right">
                      <button className="btn-icon" onClick={() => handleEditar(cliente)} title="Editar">
                        <Edit2 size={18} />
                      </button>
                      <button className="btn-icon btn-icon-danger" onClick={() => handleEliminar(cliente)} title="Eliminar">
                        <Trash2 size={18} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <ClienteFormModal
          clienteInicial={clienteEditando}
          onClose={() => setShowModal(false)}
          onGuardado={() => {
            setShowModal(false);
            cargarClientes();
          }}
        />
      )}
    </div>
  );
}
