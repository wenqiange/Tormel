import { useEffect } from "react";
import { AppShell } from "./components/layout/AppShell";
import { setSesion } from "./stores/authStore";
import { DialogProvider } from "./context/DialogContext";

export default function App() {
  // Simulamos un login por defecto como Administrador para el desarrollo
  useEffect(() => {
    setSesion({ usuario_id: 1, nombre: "Administrador", rol: "admin" });
  }, []);

  return (
    <DialogProvider>
      <AppShell nombre="Administrador" rol="admin" />
    </DialogProvider>
  );
}
