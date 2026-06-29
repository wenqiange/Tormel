import React, { useState } from "react";
import { LayoutDashboard, ShoppingCart, Users, Grid3X3, PackageOpen, Receipt, Landmark, DollarSign, User } from "lucide-react";
import { logout } from "../../stores/authStore";
import type { Rol } from "../../lib/api";
import { MesasPanel } from "../../features/mesas/MesasPanel";
import { VentasPanel } from "../../features/ventas/VentasPanel";
import { TicketsPanel } from "../../features/tickets/TicketsPanel";
import { CajaPanel } from "../../features/caja/CajaPanel";
import { ProductosPanel } from "../../features/productos/ProductosPanel";
import { VerifactuPanel } from "../../features/verifactu/VerifactuPanel";
import "./AppShell.css";

interface AppShellProps {
  nombre: string;
  rol: Rol;
  children?: React.ReactNode;
}

interface NavItem {
  id: string;
  icon: React.ReactNode;
  label: string;
  minRol?: Rol[];
}

const navItems: NavItem[] = [
  { id: "mesas", icon: <Grid3X3 size={20} />, label: "Mesas" },
  { id: "ventas", icon: <ShoppingCart size={20} />, label: "Ventas" },
  { id: "tickets", icon: <Receipt size={20} />, label: "Tickets" },
  { id: "productos", icon: <PackageOpen size={20} />, label: "Productos", minRol: ["admin", "encargado"] },
  { id: "caja", icon: <DollarSign size={20} />, label: "Caja", minRol: ["admin", "encargado"] },
  { id: "clientes", icon: <User size={20} />, label: "Clientes", minRol: ["admin", "encargado"] },
  { id: "verifactu", icon: <Landmark size={20} />, label: "AEAT", minRol: ["admin", "encargado"] },
  { id: "usuarios", icon: <Users size={20} />, label: "Usuarios", minRol: ["admin"] },
];

export function AppShell({ nombre, rol }: AppShellProps) {
  const [vistaActiva, setVistaActiva] = useState<string>("mesas");

  const visibleItems = navItems.filter(
    (item) => !item.minRol || item.minRol.includes(rol)
  );

  const activeItem = navItems.find((item) => item.id === vistaActiva);

  const renderContenido = () => {
    switch (vistaActiva) {
      case "mesas":
        return <MesasPanel usuarioId={1} />; // ID 1 es el Administrador por defecto
      case "ventas":
        return <VentasPanel />;
      case "tickets":
        return <TicketsPanel />;
      case "caja":
        return <CajaPanel />;
      case "productos":
        return <ProductosPanel />;
      case "verifactu":
        return <VerifactuPanel />;
      default:
        return (
          <div className="placeholder-content">
            <div className="placeholder-icon">{activeItem?.icon ?? <LayoutDashboard size={48} />}</div>
            <h2>Sección: {activeItem?.label}</h2>
            <p>Este módulo estará disponible próximamente en Tormel POS.</p>
          </div>
        );
    }
  };

  return (
    <div className="app-layout">
      {/* Sidebar */}
      <nav className="app-sidebar">
        <div className="sidebar-logo">
          <span className="sidebar-logo-icon"><LayoutDashboard size={24} /></span>
        </div>

        <div className="sidebar-nav">
          {visibleItems.map((item) => (
            <button
              key={item.id}
              className={`sidebar-nav-item ${vistaActiva === item.id ? "active" : ""}`}
              title={item.label}
              onClick={() => setVistaActiva(item.id)}
            >
              <span className="sidebar-nav-icon">{item.icon}</span>
              <span className="sidebar-nav-label">{item.label}</span>
            </button>
          ))}
        </div>

        <div className="sidebar-footer">
          <button
            className="sidebar-nav-item sidebar-user"
            title={`${nombre} (${rol})`}
            onClick={logout}
          >
            <span className="sidebar-nav-icon sidebar-user-avatar">
              {nombre.charAt(0).toUpperCase()}
            </span>
            <span className="sidebar-nav-label">{nombre}</span>
          </button>
        </div>
      </nav>

      {/* Contenido principal */}
      <main className="app-main">
        <header className="app-header">
          <h2 className="app-header-title">{activeItem?.label ?? "Mesas"}</h2>
          <div className="app-header-right">
            <span className="badge badge-success">Caja abierta</span>
          </div>
        </header>
        <div className="app-content">
          {renderContenido()}
        </div>
      </main>
    </div>
  );
}
