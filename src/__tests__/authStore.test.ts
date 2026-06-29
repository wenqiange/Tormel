import { describe, it, expect } from 'vitest';
import { setSesion, logout, getSesion } from '../stores/authStore';

// Mock de localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem(key: string) { return store[key] || null; },
    setItem(key: string, value: string) { store[key] = value.toString(); },
    removeItem(key: string) { delete store[key]; },
    clear() { store = {}; }
  };
})();
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

describe('authStore state management', () => {
  it('should initialize without user', () => {
    const user = getSesion();
    expect(user).toBeNull();
  });

  it('should store user on login', () => {
    const testUser = {
      id: 1,
      usuario_id: 1,
      nombre: 'Administrador',
      rol: 'admin' as const,
      created_at: '2026-06-29',
    };
    
    setSesion(testUser);
  });

  it('should clear user on logout', () => {
    logout();
    const currentUser = getSesion();
    expect(currentUser).toBeNull();
  });
});
