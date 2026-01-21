import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import api from '@/services/api';
import { User, LoginCredentials, PinLoginCredentials, LoginResponse } from '@/types';

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  
  // Actions
  login: (credentials: LoginCredentials) => Promise<void>;
  pinLogin: (credentials: PinLoginCredentials) => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
  setTokens: (accessToken: string, refreshToken: string) => void;
  clearError: () => void;
}

// Usuario mock para desarrollo (sin autenticación)
const mockAdminUser: User = {
  id: 'dev-admin',
  email: 'admin@tormel.com',
  firstName: 'Admin',
  lastName: 'Dev',
  role: 'ADMIN',
  isActive: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      // TODO: Restaurar para producción - cambiar a null y false
      user: mockAdminUser,
      accessToken: 'dev-token',
      refreshToken: 'dev-refresh-token',
      isAuthenticated: true,
      isLoading: false,
      error: null,

      login: async (credentials: LoginCredentials) => {
        set({ isLoading: true, error: null });
        try {
          const response = await api.post<LoginResponse>('/auth/login', credentials);
          const { user, accessToken, refreshToken } = response.data;
          
          set({
            user,
            accessToken,
            refreshToken,
            isAuthenticated: true,
            isLoading: false,
          });
        } catch (error: any) {
          set({
            error: error.response?.data?.message || 'Error al iniciar sesión',
            isLoading: false,
          });
          throw error;
        }
      },

      pinLogin: async (credentials: PinLoginCredentials) => {
        set({ isLoading: true, error: null });
        try {
          const response = await api.post<LoginResponse>('/auth/login/pin', credentials);
          const { user, accessToken, refreshToken } = response.data;
          
          set({
            user,
            accessToken,
            refreshToken,
            isAuthenticated: true,
            isLoading: false,
          });
        } catch (error: any) {
          set({
            error: error.response?.data?.message || 'PIN inválido',
            isLoading: false,
          });
          throw error;
        }
      },

      logout: async () => {
        const { refreshToken } = get();
        try {
          if (refreshToken) {
            await api.post('/auth/logout', { refreshToken });
          }
        } catch (error) {
          console.error('Logout error:', error);
        } finally {
          set({
            user: null,
            accessToken: null,
            refreshToken: null,
            isAuthenticated: false,
            error: null,
          });
        }
      },

      checkAuth: async () => {
        const { accessToken } = get();
        if (!accessToken) {
          set({ isAuthenticated: false });
          return;
        }

        try {
          const response = await api.get<User>('/auth/profile');
          set({
            user: response.data,
            isAuthenticated: true,
          });
        } catch (error) {
          set({
            user: null,
            accessToken: null,
            refreshToken: null,
            isAuthenticated: false,
          });
        }
      },

      setTokens: (accessToken: string, refreshToken: string) => {
        set({ accessToken, refreshToken });
      },

      clearError: () => {
        set({ error: null });
      },
    }),
    {
      name: 'tormel-auth',
      partialize: (state) => ({
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
