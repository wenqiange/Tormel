import { render, screen, act } from '@testing-library/react';
import { MesasPanel } from '../features/mesas/MesasPanel';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn().mockImplementation(async (cmd) => {
    if (cmd === 'listar_zonas') {
      return [{ id: 1, nombre: 'Terraza Principal', orden: 1, activa: true }];
    }
    if (cmd === 'listar_mesas') {
      return [
        {
          id: 1,
          zona_id: 1,
          nombre: 'T-1',
          capacidad: 4,
          estado: 'libre',
          forma: 'rectangular',
          activa: true
        },
        {
          id: 2,
          zona_id: 1,
          nombre: 'T-2',
          capacidad: 2,
          estado: 'ocupada',
          forma: 'redonda',
          activa: true
        }
      ];
    }
    return [];
  }),
}));

describe('MesasPanel Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders zones and tables from backend', async () => {
    await act(async () => {
      render(<MesasPanel usuarioId={1} />);
    });
    
    // Zonas
    expect(screen.getByText('Terraza Principal')).toBeInTheDocument();
    
    // Mesas
    expect(screen.getByText('T-1')).toBeInTheDocument();
    expect(screen.getByText('T-2')).toBeInTheDocument();
  });
});
