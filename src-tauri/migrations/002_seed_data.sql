-- ============================================================================
-- Tormel POS — Migración 002: Datos Semilla
-- ============================================================================

-- 1. Insertar usuario Administrador inicial (id = 1)
INSERT OR IGNORE INTO usuario (id, nombre, pin_hash, rol, activo)
VALUES (1, 'Administrador', '', 'admin', 1);

-- 2. Insertar zonas del local
INSERT OR IGNORE INTO zona (id, nombre, orden, activa) VALUES
(1, 'Sala', 1, 1),
(2, 'Terraza', 2, 1),
(3, 'Barra', 3, 1);

-- 3. Insertar mesas
-- Sala (zona_id = 1)
INSERT OR IGNORE INTO mesa (id, zona_id, nombre, capacidad, estado, pos_x, pos_y, ancho, alto, forma, activa) VALUES
(1, 1, 'Mesa 1', 4, 'libre', 80, 60, 80, 80, 'circular', 1),
(2, 1, 'Mesa 2', 4, 'libre', 240, 60, 100, 70, 'rectangular', 1),
(3, 1, 'Mesa 3', 6, 'libre', 400, 60, 120, 70, 'rectangular', 1),
(4, 1, 'Mesa 4', 2, 'libre', 80, 220, 70, 70, 'circular', 1),
(5, 1, 'Mesa 5', 4, 'libre', 240, 220, 100, 70, 'rectangular', 1),
(6, 1, 'Mesa 6', 4, 'libre', 400, 220, 100, 70, 'rectangular', 1);

-- Terraza (zona_id = 2)
INSERT OR IGNORE INTO mesa (id, zona_id, nombre, capacidad, estado, pos_x, pos_y, ancho, alto, forma, activa) VALUES
(7, 2, 'T-1', 4, 'libre', 80, 80, 80, 80, 'rectangular', 1),
(8, 2, 'T-2', 4, 'libre', 260, 80, 80, 80, 'rectangular', 1),
(9, 2, 'T-3', 4, 'libre', 80, 240, 80, 80, 'rectangular', 1),
(10, 2, 'T-4', 4, 'libre', 260, 240, 80, 80, 'rectangular', 1);

-- Barra (zona_id = 3)
INSERT OR IGNORE INTO mesa (id, zona_id, nombre, capacidad, estado, pos_x, pos_y, ancho, alto, forma, activa) VALUES
(11, 3, 'Taburete 1', 1, 'libre', 60, 120, 50, 50, 'circular', 1),
(12, 3, 'Taburete 2', 1, 'libre', 150, 120, 50, 50, 'circular', 1),
(13, 3, 'Taburete 3', 1, 'libre', 240, 120, 50, 50, 'circular', 1),
(14, 3, 'Taburete 4', 1, 'libre', 330, 120, 50, 50, 'circular', 1),
(15, 3, 'Taburete 5', 1, 'libre', 420, 120, 50, 50, 'circular', 1);

-- 4. Insertar familias (categorías) de productos
INSERT OR IGNORE INTO familia (id, nombre, orden, color, activa) VALUES
(1, 'Bebidas', 1, '#3b82f6', 1),    -- Azul
(2, 'Comida', 2, '#10b981', 1),     -- Verde
(3, 'Cafetería', 3, '#f59e0b', 1),  -- Ambar
(4, 'Postres', 4, '#ec4899', 1);    -- Rosa

-- 5. Insertar productos
-- Bebidas (familia_id = 1)
INSERT OR IGNORE INTO producto (id, familia_id, nombre, precio, tipo_iva, activo, orden) VALUES
(1, 1, 'Coca-Cola', 2.50, 10.0, 1, 1),
(2, 1, 'Fanta Naranja', 2.50, 10.0, 1, 2),
(3, 1, 'Caña de Cerveza', 2.00, 10.0, 1, 3),
(4, 1, 'Tercio Estrella', 3.00, 10.0, 1, 4),
(5, 1, 'Copa de Vino Tinto', 3.50, 10.0, 1, 5),
(6, 1, 'Agua Mineral 50cl', 1.80, 10.0, 1, 6);

-- Comida (familia_id = 2)
INSERT OR IGNORE INTO producto (id, familia_id, nombre, precio, tipo_iva, activo, orden) VALUES
(7, 2, 'Hamburguesa Tormel', 9.50, 10.0, 1, 1),
(8, 2, 'Patatas Bravas', 6.00, 10.0, 1, 2),
(9, 2, 'Bocadillo de Calamares', 5.50, 10.0, 1, 3),
(10, 2, 'Croquetas de Jamón (6u)', 8.00, 10.0, 1, 4),
(11, 2, 'Ensalada César', 8.50, 10.0, 1, 5);

-- Cafetería (familia_id = 3)
INSERT OR IGNORE INTO producto (id, familia_id, nombre, precio, tipo_iva, activo, orden) VALUES
(12, 3, 'Café Solo', 1.20, 10.0, 1, 1),
(13, 3, 'Café con Leche', 1.50, 10.0, 1, 2),
(14, 3, 'Cortado', 1.35, 10.0, 1, 3),
(15, 3, 'Capuccino', 2.50, 10.0, 1, 4),
(16, 3, 'Infusión Té Verde', 1.80, 10.0, 1, 5);

-- Postres (familia_id = 4)
INSERT OR IGNORE INTO producto (id, familia_id, nombre, precio, tipo_iva, activo, orden) VALUES
(17, 4, 'Tarta de Queso Casera', 4.50, 10.0, 1, 1),
(18, 4, 'Coulant de Chocolate', 4.00, 10.0, 1, 2),
(19, 4, 'Copa de Helado Variado', 3.50, 10.0, 1, 3);

-- 6. Insertar turno de caja abierto por defecto (id = 1) para habilitar cobros inmediatos
INSERT OR IGNORE INTO turno_caja (id, usuario_id, fondo_inicial, total_efectivo, total_tarjeta, total_otros, total_ventas, estado)
VALUES (1, 1, 150.0, 0.0, 0.0, 0.0, 0, 'abierto');
