import { UserRole } from '@/types';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
}

// TODO: Restaurar autenticación para producción
export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  // Autenticación desactivada para desarrollo - permite acceso directo
  return <>{children}</>;
}
