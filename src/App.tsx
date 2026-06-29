import { AppShell } from "./components/layout/AppShell";
import { useAuth } from "./stores/authStore";
import { LoginView } from "./features/usuarios/LoginView";
import { DialogProvider } from "./context/DialogContext";

export default function App() {
  const { isAuthenticated, sesion } = useAuth();

  return (
    <DialogProvider>
      {isAuthenticated && sesion ? (
        <AppShell
          nombre={sesion.nombre}
          rol={sesion.rol}
          usuarioId={sesion.usuario_id}
        />
      ) : (
        <LoginView />
      )}
    </DialogProvider>
  );
}
