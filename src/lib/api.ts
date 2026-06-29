import { invoke } from "@tauri-apps/api/core";

// ============================================================================
// Tipos TypeScript que reflejan los modelos Rust
// ============================================================================

// --- Enums ---

export type Rol = "admin" | "encargado" | "camarero";
export type EstadoMesa = "libre" | "ocupada" | "reservada" | "por_cobrar";
export type TipoVenta = "mesa" | "barra" | "llevar";
export type EstadoVenta = "abierta" | "cobrada" | "anulada";
export type MetodoPago = "efectivo" | "tarjeta" | "otro";
export type EstadoTurno = "abierto" | "cerrado";
export type TipoMovimiento = "entrada" | "salida";

// --- Modelos ---

export interface Usuario {
  id: number;
  nombre: string;
  rol: Rol;
  activo: boolean;
  created_at: string;
  updated_at: string;
}

export interface SesionUsuario {
  usuario_id: number;
  nombre: string;
  rol: Rol;
}

export interface TurnoCaja {
  id: number;
  usuario_id: number;
  fondo_inicial: number;
  fondo_final: number | null;
  total_efectivo: number;
  total_tarjeta: number;
  total_otros: number;
  total_ventas: number;
  diferencia: number | null;
  estado: EstadoTurno;
  notas: string | null;
  abierto_at: string;
  cerrado_at: string | null;
}

export interface MovimientoCaja {
  id: number;
  turno_id: number;
  usuario_id: number;
  tipo: TipoMovimiento;
  importe: number;
  concepto: string;
  created_at: string;
}

export interface ResumenCierre {
  turno: TurnoCaja;
  total_efectivo_ventas: number;
  total_tarjeta_ventas: number;
  total_otros_ventas: number;
  total_entradas_caja: number;
  total_salidas_caja: number;
  efectivo_esperado: number;
  diferencia: number;
  num_ventas: number;
  nombre_usuario: string;
}

export interface Zona {
  id: number;
  nombre: string;
  orden: number;
  activa: boolean;
  created_at: string;
}

export interface Mesa {
  id: number;
  zona_id: number;
  nombre: string;
  capacidad: number;
  estado: EstadoMesa;
  pos_x: number;
  pos_y: number;
  ancho: number;
  alto: number;
  forma: "rectangular" | "circular";
  activa: boolean;
  created_at: string;
  updated_at: string;
}

export interface Familia {
  id: number;
  nombre: string;
  familia_padre_id: number | null;
  orden: number;
  color: string;
  icono: string | null;
  activa: boolean;
  created_at: string;
}

export interface Producto {
  id: number;
  familia_id: number;
  nombre: string;
  codigo: string | null;
  precio: number;
  tipo_iva: number;
  imagen_path: string | null;
  activo: boolean;
  orden: number;
  created_at: string;
  updated_at: string;
}

export interface LineaVenta {
  id: number;
  venta_id: number;
  producto_id: number;
  producto_nombre: string;
  producto_precio: number;
  tipo_iva: number;
  cantidad: number;
  descuento_pct: number;
  subtotal: number;
  importe_iva: number;
  total: number;
  notas: string | null;
  created_at: string;
}

export interface Pago {
  id: number;
  venta_id: number;
  metodo: MetodoPago;
  importe: number;
  cambio: number;
  referencia: string | null;
  created_at: string;
}

export interface Venta {
  id: number;
  mesa_id: number | null;
  usuario_id: number;
  cliente_id: number | null;
  turno_id: number;
  serie_id: number | null;
  numero: string | null;
  tipo: TipoVenta;
  estado: EstadoVenta;
  comensales: number;
  subtotal: number;
  total_descuento: number;
  total_iva: number;
  total: number;
  notas: string | null;
  abierta_at: string;
  cerrada_at: string | null;
  // -- Campos VeriFactu (AEAT) --
  hash_registro: string | null;
  hash_anterior: string | null;
  huella_verifactu: string | null;
  estado_verifactu: string | null;
  fecha_hora_huso: string | null;
  qr_data: string | null;
  // -----------------------------
  created_at: string;
}

export type TipoTicket = "pre_cuenta" | "fiscal";

export interface TicketLinea {
  producto_nombre: string;
  cantidad: number;
  precio_unitario: number;
  total: number;
}

export interface Ticket {
  id: number;
  venta_id: number | null;
  tipo: TipoTicket;
  numero: string | null;
  mesa_nombre: string | null;
  usuario_nombre: string | null;
  metodo_pago: MetodoPago | null;
  comensales: number;
  subtotal: number;
  total_iva: number;
  total: number;
  qr_data: string | null;
  lineas: TicketLinea[];
  created_at: string;
}

// Representa una venta completa (con líneas, pagos, etc.).
// Hereda los campos de Venta debido al #[serde(flatten)] de Rust.
export interface VentaCompleta extends Venta {
  lineas: LineaVenta[];
  pagos: Pago[];
  nombre_mesa: string | null;
  nombre_usuario: string;
  nombre_cliente: string | null;
}

// --- DTOs ---

export interface NuevaZona {
  nombre: string;
  orden?: number;
}

export interface NuevaMesa {
  zona_id: number;
  nombre: string;
  capacidad?: number;
  pos_x?: number;
  pos_y?: number;
  ancho?: number;
  alto?: number;
  forma?: "rectangular" | "circular";
}

export interface NuevoProducto {
  familia_id: number;
  nombre: string;
  codigo?: string | null;
  precio: number;
  tipo_iva: number;
  imagen_path?: string | null;
  orden?: number;
}

export interface ActualizarProducto {
  nombre?: string;
  familia_id?: number;
  codigo?: string | null;
  precio?: number;
  tipo_iva?: number;
  imagen_path?: string | null;
  activo?: boolean;
  orden?: number;
}

export interface NuevoUsuario {
  nombre: string;
  rol: Rol;
  pin: string;
}

export interface ActualizarUsuario {
  nombre?: string;
  rol?: Rol;
  activo?: boolean;
  pin?: string;
}

export interface AbrirTurnoDTO {
  fondo_inicial: number;
}

export interface CerrarTurnoDTO {
  fondo_final: number;
  notas?: string;
}

export interface NuevoMovimientoDTO {
  tipo: TipoMovimiento;
  importe: number;
  concepto: string;
}

export interface Cliente {
  id: number;
  nombre: string;
  nif_cif: string | null;
  direccion: string | null;
  codigo_postal: string | null;
  ciudad: string | null;
  provincia: string | null;
  telefono: string | null;
  email: string | null;
  notas: string | null;
  created_at: string;
  updated_at: string;
}

export interface NuevoCliente {
  nombre: string;
  nif_cif?: string | null;
  direccion?: string | null;
  codigo_postal?: string | null;
  ciudad?: string | null;
  provincia?: string | null;
  telefono?: string | null;
  email?: string | null;
  notas?: string | null;
}

export interface ActualizarCliente {
  nombre?: string;
  nif_cif?: string | null;
  direccion?: string | null;
  codigo_postal?: string | null;
  ciudad?: string | null;
  provincia?: string | null;
  telefono?: string | null;
  email?: string | null;
  notas?: string | null;
}

// ============================================================================
// API — Funciones tipadas sobre invoke()
// ============================================================================

/// Etiqueta legible del rol para la interfaz.
/// El rol "camarero" se presenta como "Usuario" en Tormel.
export function etiquetaRol(rol: Rol): string {
  switch (rol) {
    case "admin":
      return "Administrador";
    case "encargado":
      return "Encargado";
    case "camarero":
      return "Usuario";
  }
}

export const api = {
  // --- Usuarios ---
  login: (usuarioId: number, pin: string) =>
    invoke<SesionUsuario>("login", { usuarioId, pin }),

  esPrimeraEjecucion: () => invoke<boolean>("es_primera_ejecucion"),

  crearAdminInicial: (nombre: string) =>
    invoke<Usuario>("crear_admin_inicial", { nombre }),

  listarUsuarios: (soloActivos?: boolean) =>
    invoke<Usuario[]>("listar_usuarios", { soloActivos }),

  obtenerUsuario: (id: number) =>
    invoke<Usuario>("obtener_usuario", { id }),

  crearUsuario: (datos: NuevoUsuario) =>
    invoke<Usuario>("crear_usuario", { datos }),

  actualizarUsuario: (id: number, datos: ActualizarUsuario) =>
    invoke<Usuario>("actualizar_usuario", { id, datos }),

  // --- Mesas ---
  listarZonas: () => invoke<Zona[]>("listar_zonas"),
  
  listarMesas: () => invoke<Mesa[]>("listar_mesas"),
  
  actualizarPosicionMesa: (id: number, posX: number, posY: number) =>
    invoke<void>("actualizar_posicion_mesa", { id, posX, posY }),
  
  obtenerVentaActivaMesa: (mesaId: number) =>
    invoke<VentaCompleta | null>("obtener_venta_activa_mesa", { mesaId }),
  
  agregarProductoMesa: (mesaId: number, usuarioId: number, productoId: number, cantidad: number, precioPersonalizado?: number) =>
    invoke<VentaCompleta>("agregar_producto_mesa", { mesaId, usuarioId, productoId, cantidad, precioPersonalizado }),
  
  actualizarCantidadProductoMesa: (mesaId: number, usuarioId: number, productoId: number, cantidad: number) =>
    invoke<VentaCompleta | null>("actualizar_cantidad_producto_mesa", { mesaId, usuarioId, productoId, cantidad }),
  
  actualizarPrecioProductoMesa: (mesaId: number, usuarioId: number, productoId: number, nuevoPrecio: number) =>
    invoke<VentaCompleta | null>("actualizar_precio_producto_mesa", { mesaId, usuarioId, productoId, nuevoPrecio }),
  
  eliminarProductoMesa: (mesaId: number, productoId: number) =>
    invoke<VentaCompleta | null>("eliminar_producto_mesa", { mesaId, productoId }),
  
  imprimirTicketMesa: (mesaId: number) =>
    invoke<void>("imprimir_ticket_mesa", { mesaId }),
  
  cobrarMesa: (mesaId: number, metodoPago: MetodoPago, importeEntregado: number) =>
    invoke<string>("cobrar_mesa", { mesaId, metodoPago, importeEntregado }),

  // --- Mesas Admin ---
  crearZona: (nueva: NuevaZona) => invoke<Zona>("crear_zona", { nueva }),
  eliminarZona: (id: number) => invoke<void>("eliminar_zona", { id }),
  crearMesa: (nueva: NuevaMesa) => invoke<Mesa>("crear_mesa", { nueva }),
  actualizarConfigMesa: (id: number, nombre?: string, capacidad?: number, forma?: string) => 
    invoke<Mesa>("actualizar_config_mesa", { id, nombre, capacidad, forma }),
  eliminarMesa: (id: number) => invoke<void>("eliminar_mesa", { id }),

  // --- Catálogo Admin ---
  crearProducto: (nuevo: NuevoProducto) => invoke<Producto>("crear_producto", { nuevo }),
  actualizarProducto: (id: number, actualizar: ActualizarProducto) => invoke<Producto>("actualizar_producto", { id, actualizar }),
  eliminarProducto: (id: number) => invoke<void>("eliminar_producto", { id }),

  // --- Archivos / Imágenes ---
  guardarImagenB64: (nombreArchivo: string, base64Data: string) => 
    invoke<string>("guardar_imagen_b64", { nombreArchivo, base64Data }),
  obtenerImagenB64: (nombreArchivo: string) => 
    invoke<string>("obtener_imagen_b64", { nombreArchivo }),
  listarFamilias: () => invoke<Familia[]>("listar_familias"),
  crearFamilia: (nombre: string, color: string) => invoke<Familia>("crear_familia", { nombre, color }),
  eliminarFamilia: (id: number) => invoke<void>("eliminar_familia", { id }),
  
  listarProductos: () => invoke<Producto[]>("listar_productos"),
  
  obtenerVentasDiarias: () => invoke<VentaCompleta[]>("obtener_ventas_diarias"),

  // --- Tickets (historial) ---
  listarTickets: () => invoke<Ticket[]>("listar_tickets"),

  obtenerTicket: (id: number) => invoke<Ticket>("obtener_ticket", { id }),

  // --- Caja ---
  obtenerTurnoActivo: () => invoke<TurnoCaja | null>("obtener_turno_activo"),
  
  abrirTurno: (usuarioId: number, payload: AbrirTurnoDTO) => 
    invoke<TurnoCaja>("abrir_turno", { usuarioId, payload }),
    
  cerrarTurno: (turnoId: number, payload: CerrarTurnoDTO) =>
    invoke<ResumenCierre>("cerrar_turno", { turnoId, payload }),
    
  registrarMovimientoCaja: (turnoId: number, usuarioId: number, payload: NuevoMovimientoDTO) =>
    invoke<MovimientoCaja>("registrar_movimiento_caja", { turnoId, usuarioId, payload }),
    
  obtenerMovimientosTurno: (turnoId: number) =>
    invoke<MovimientoCaja[]>("obtener_movimientos_turno", { turnoId }),
    
  obtenerResumenCierre: (turnoId: number) =>
    invoke<ResumenCierre>("obtener_resumen_cierre", { turnoId }),

  // --- Clientes ---
  listarClientes: () => invoke<Cliente[]>("listar_clientes"),
  
  obtenerCliente: (id: number) => invoke<Cliente>("obtener_cliente", { id }),
  
  crearCliente: (nuevo: NuevoCliente) => invoke<Cliente>("crear_cliente", { nuevo }),
  
  actualizarCliente: (id: number, actualizar: ActualizarCliente) => invoke<Cliente>("actualizar_cliente", { id, actualizar }),
  
  eliminarCliente: (id: number) => invoke<void>("eliminar_cliente", { id }),

  // --- Email ---
  enviarFacturaEmail: (toEmail: string, subject: string, body: string, pdfBytes: number[], filename: string) => 
    invoke<void>("enviar_factura_email", { toEmail, subject, body, pdfBytes, filename }),

  guardarConfigSmtp: (server: string, port: number, username: string, password: string) =>
    invoke<void>("guardar_config_smtp", { server, port, username, password }),
};
