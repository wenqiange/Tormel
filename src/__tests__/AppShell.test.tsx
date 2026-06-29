import { render, screen } from '@testing-library/react';
import { AppShell } from '../components/layout/AppShell';
import { describe, it, expect, vi } from 'vitest';

// Mocks simples para evitar fallos por uso de Tauri invoke en subcomponentes
vi.mock('../../stores/authStore', () => ({
  logout: vi.fn(),
}));
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn().mockResolvedValue([]),
}));

describe('AppShell Component', () => {
  it('renders sidebar and basic elements for admin', () => {
    render(<AppShell nombre="Test Admin" rol="admin" />);
    
    // Verifica que existe la sección de VeriFactu (AEAT)
    expect(screen.getByText('AEAT')).toBeInTheDocument();
    
    // Verifica que existe el nombre de usuario
    expect(screen.getByText('Test Admin')).toBeInTheDocument();
    
    // Verifica que Mesas está activo por defecto (el primero que encuentra es el del menú lateral)
    expect(screen.getAllByText('Mesas')[0].closest('button')).toHaveClass('active');
  });
  
  it('does not show admin-only menus to camarero', () => {
    render(<AppShell nombre="Test Camarero" rol="camarero" />);
    
    // El camarero no debe ver Usuarios ni Configuración Verifactu
    expect(screen.queryByText('Usuarios')).not.toBeInTheDocument();
    expect(screen.queryByText('AEAT')).not.toBeInTheDocument();
  });
});
