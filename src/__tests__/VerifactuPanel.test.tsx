import { render, screen, fireEvent, act } from '@testing-library/react';
import { VerifactuPanel } from '../features/verifactu/VerifactuPanel';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mocks simples para evitar fallos por uso de Tauri invoke
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn().mockImplementation(async (cmd) => {
    if (cmd === 'obtener_ventas_diarias') {
      return [
        {
          id: 1,
          numero: 'F-001',
          total: 100.5,
          abierta_at: '2026-06-29T10:00:00Z',
          hash_registro: 'A1B2C3D4E5F6',
          estado_verifactu: 'enviado',
          tipo: 'fiscal'
        }
      ];
    }
    return [];
  }),
}));

describe('VerifactuPanel Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders Declaracion Responsable by default', async () => {
    await act(async () => {
      render(<VerifactuPanel />);
    });
    
    expect(screen.getByText('Declaración Responsable del Fabricante')).toBeInTheDocument();
    expect(screen.getByText('ID Sistema Informático')).toBeInTheDocument();
    expect(screen.getByText('01')).toBeInTheDocument();
    expect(screen.getByText('Versión')).toBeInTheDocument();
    expect(screen.getByText('0.1.0')).toBeInTheDocument();
  });

  it('switches to Consulta Registros AEAT tab and loads sales', async () => {
    await act(async () => {
      render(<VerifactuPanel />);
    });
    
    const consultaTabBtn = screen.getByText('Consulta Registros AEAT');
    
    await act(async () => {
      fireEvent.click(consultaTabBtn);
    });
    
    // Verifica que se cambió a la tabla
    expect(screen.getByText('Nº Factura')).toBeInTheDocument();
    expect(screen.getByText('Huella / Hash Registro')).toBeInTheDocument();
    
    // Verifica los datos mockeados devueltos por obtener_ventas_diarias
    expect(screen.getByText('F-001')).toBeInTheDocument();
    expect(screen.getByText('A1B2C3D4E5F6')).toBeInTheDocument();
    expect(screen.getByText('enviado')).toBeInTheDocument();
    expect(screen.getByText('100.50 €')).toBeInTheDocument();
  });
});
