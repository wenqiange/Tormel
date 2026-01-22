import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { useEffect } from 'react';
import { socketService } from '@/services/socket';

// Layouts
import MainLayout from '@/components/layouts/MainLayout';
import AuthLayout from '@/components/layouts/AuthLayout';

// Pages
import LoginPage from '@/pages/auth/LoginPage';
import DashboardPage from '@/pages/dashboard/DashboardPage';
import TablesPage from '@/pages/tables/TablesPage';
import TableSessionPage from '@/pages/tables/TableSessionPage';
import OrdersPage from '@/pages/orders/OrdersPage';
// KitchenPage removido
import ProductsPage from '@/pages/products/ProductsPage';
import BillingPage from '@/pages/billing/BillingPage';
import UsersPage from '@/pages/admin/UsersPage';
import SettingsPage from '@/pages/admin/SettingsPage';

// Components
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import OfflineIndicator from '@/components/common/OfflineIndicator';

function App() {
  // TODO: Restaurar autenticación para producción
  // const { isAuthenticated, user, checkAuth } = useAuthStore();

  // useEffect(() => {
  //   checkAuth();
  // }, [checkAuth]);

  // Conectar socket directamente sin autenticación
  useEffect(() => {
    socketService.connect();
    return () => {
      socketService.disconnect();
    };
  }, []);

  return (
    <>
      <Routes>
        {/* Auth routes - Desactivado para desarrollo */}
        <Route element={<AuthLayout />}>
          <Route
            path="/login"
            element={<Navigate to="/" replace />}
          />
        </Route>

        {/* Protected routes */}
        <Route
          element={
            <ProtectedRoute>
              <MainLayout />
            </ProtectedRoute>
          }
        >
          <Route path="/" element={<DashboardPage />} />
          <Route path="/tables" element={<TablesPage />} />
          <Route path="/tables/:tableId" element={<TableSessionPage />} />
          <Route path="/orders" element={<OrdersPage />} />
          {/* Kitchen route removida */}
          <Route path="/products" element={<ProductsPage />} />
          <Route path="/billing" element={<BillingPage />} />
          
          {/* Admin routes */}
          <Route
            path="/admin/users"
            element={
              <ProtectedRoute allowedRoles={['ADMIN', 'MANAGER']}>
                <UsersPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/settings"
            element={
              <ProtectedRoute allowedRoles={['ADMIN']}>
                <SettingsPage />
              </ProtectedRoute>
            }
          />
        </Route>

        {/* Catch all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <OfflineIndicator />
    </>
  );
}

export default App;
