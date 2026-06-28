-- ============================================================================
-- Tormel POS — Migración 001: Esquema Inicial
-- ============================================================================
-- Base de datos SQLite para TPV de hostelería.
-- Todas las tablas, índices, triggers y datos semilla.
-- ============================================================================

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;
PRAGMA busy_timeout = 5000;

-- ============================================================================
-- NEGOCIO (Configuración del establecimiento)
-- ============================================================================
CREATE TABLE IF NOT EXISTS negocio (
    id              INTEGER PRIMARY KEY CHECK (id = 1),  -- Singleton
    nombre          TEXT    NOT NULL DEFAULT '',
    nif             TEXT    NOT NULL DEFAULT '',
    direccion       TEXT    NOT NULL DEFAULT '',
    codigo_postal   TEXT    NOT NULL DEFAULT '',
    ciudad          TEXT    NOT NULL DEFAULT '',
    provincia       TEXT    NOT NULL DEFAULT '',
    telefono        TEXT    NOT NULL DEFAULT '',
    email           TEXT    NOT NULL DEFAULT '',
    logo_path       TEXT,
    moneda          TEXT    NOT NULL DEFAULT 'EUR',
    configuracion   TEXT    NOT NULL DEFAULT '{}',  -- JSON libre para config extra
    created_at      TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%S', 'now', 'localtime')),
    updated_at      TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%S', 'now', 'localtime'))
);

-- Insertar registro singleton del negocio
INSERT INTO negocio (id) VALUES (1);

-- ============================================================================
-- USUARIOS
-- ============================================================================
CREATE TABLE IF NOT EXISTS usuario (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre          TEXT    NOT NULL,
    pin_hash        TEXT    NOT NULL,
    rol             TEXT    NOT NULL CHECK (rol IN ('admin', 'encargado', 'camarero')),
    activo          INTEGER NOT NULL DEFAULT 1,
    created_at      TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%S', 'now', 'localtime')),
    updated_at      TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%S', 'now', 'localtime'))
);

CREATE INDEX idx_usuario_activo ON usuario (activo);
CREATE INDEX idx_usuario_rol ON usuario (rol);

-- ============================================================================
-- ZONAS Y MESAS
-- ============================================================================
CREATE TABLE IF NOT EXISTS zona (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre          TEXT    NOT NULL,
    orden           INTEGER NOT NULL DEFAULT 0,
    activa          INTEGER NOT NULL DEFAULT 1,
    created_at      TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%S', 'now', 'localtime'))
);

CREATE TABLE IF NOT EXISTS mesa (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    zona_id         INTEGER NOT NULL REFERENCES zona(id),
    nombre          TEXT    NOT NULL,
    capacidad       INTEGER NOT NULL DEFAULT 4,
    estado          TEXT    NOT NULL DEFAULT 'libre'
                    CHECK (estado IN ('libre', 'ocupada', 'reservada', 'por_cobrar')),
    pos_x           INTEGER NOT NULL DEFAULT 0,
    pos_y           INTEGER NOT NULL DEFAULT 0,
    ancho           INTEGER NOT NULL DEFAULT 1,
    alto            INTEGER NOT NULL DEFAULT 1,
    forma           TEXT    NOT NULL DEFAULT 'rectangular'
                    CHECK (forma IN ('rectangular', 'circular')),
    activa          INTEGER NOT NULL DEFAULT 1,
    created_at      TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%S', 'now', 'localtime')),
    updated_at      TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%S', 'now', 'localtime'))
);

CREATE INDEX idx_mesa_zona ON mesa (zona_id);
CREATE INDEX idx_mesa_estado ON mesa (estado);

-- ============================================================================
-- FAMILIAS Y PRODUCTOS
-- ============================================================================
CREATE TABLE IF NOT EXISTS familia (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre              TEXT    NOT NULL,
    familia_padre_id    INTEGER REFERENCES familia(id),
    orden               INTEGER NOT NULL DEFAULT 0,
    color               TEXT    NOT NULL DEFAULT '#6366f1',  -- Indigo por defecto
    icono               TEXT,
    activa              INTEGER NOT NULL DEFAULT 1,
    created_at          TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%S', 'now', 'localtime'))
);

CREATE INDEX idx_familia_padre ON familia (familia_padre_id);

CREATE TABLE IF NOT EXISTS producto (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    familia_id      INTEGER NOT NULL REFERENCES familia(id),
    nombre          TEXT    NOT NULL,
    codigo          TEXT,
    precio          REAL    NOT NULL DEFAULT 0.0,
    tipo_iva        REAL    NOT NULL DEFAULT 10.0
                    CHECK (tipo_iva IN (0.0, 4.0, 10.0, 21.0)),
    imagen_path     TEXT,
    activo          INTEGER NOT NULL DEFAULT 1,
    orden           INTEGER NOT NULL DEFAULT 0,
    created_at      TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%S', 'now', 'localtime')),
    updated_at      TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%S', 'now', 'localtime'))
);

CREATE INDEX idx_producto_familia ON producto (familia_id);
CREATE INDEX idx_producto_activo ON producto (activo);
CREATE INDEX idx_producto_codigo ON producto (codigo) WHERE codigo IS NOT NULL;

-- ============================================================================
-- MODIFICADORES
-- ============================================================================
CREATE TABLE IF NOT EXISTS modificador_grupo (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre          TEXT    NOT NULL,
    obligatorio     INTEGER NOT NULL DEFAULT 0,
    min_seleccion   INTEGER NOT NULL DEFAULT 0,
    max_seleccion   INTEGER NOT NULL DEFAULT 1,
    activo          INTEGER NOT NULL DEFAULT 1,
    created_at      TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%S', 'now', 'localtime'))
);

CREATE TABLE IF NOT EXISTS modificador (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    grupo_id        INTEGER NOT NULL REFERENCES modificador_grupo(id) ON DELETE CASCADE,
    nombre          TEXT    NOT NULL,
    precio_extra    REAL    NOT NULL DEFAULT 0.0,
    orden           INTEGER NOT NULL DEFAULT 0,
    activo          INTEGER NOT NULL DEFAULT 1,
    created_at      TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%S', 'now', 'localtime'))
);

CREATE INDEX idx_modificador_grupo ON modificador (grupo_id);

-- Tabla de relación: qué grupos de modificadores aplican a qué productos
CREATE TABLE IF NOT EXISTS producto_modificador_grupo (
    producto_id     INTEGER NOT NULL REFERENCES producto(id) ON DELETE CASCADE,
    grupo_id        INTEGER NOT NULL REFERENCES modificador_grupo(id) ON DELETE CASCADE,
    PRIMARY KEY (producto_id, grupo_id)
);

-- ============================================================================
-- CLIENTES
-- ============================================================================
CREATE TABLE IF NOT EXISTS cliente (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre          TEXT    NOT NULL,
    nif_cif         TEXT,
    direccion       TEXT,
    codigo_postal   TEXT,
    ciudad          TEXT,
    provincia       TEXT,
    telefono        TEXT,
    email           TEXT,
    notas           TEXT,
    created_at      TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%S', 'now', 'localtime')),
    updated_at      TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%S', 'now', 'localtime'))
);

CREATE INDEX idx_cliente_nif ON cliente (nif_cif) WHERE nif_cif IS NOT NULL;
CREATE INDEX idx_cliente_nombre ON cliente (nombre);

-- ============================================================================
-- TURNOS DE CAJA
-- ============================================================================
CREATE TABLE IF NOT EXISTS turno_caja (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    usuario_id      INTEGER NOT NULL REFERENCES usuario(id),
    fondo_inicial   REAL    NOT NULL DEFAULT 0.0,
    fondo_final     REAL,
    total_efectivo  REAL    NOT NULL DEFAULT 0.0,
    total_tarjeta   REAL    NOT NULL DEFAULT 0.0,
    total_otros     REAL    NOT NULL DEFAULT 0.0,
    total_ventas    INTEGER NOT NULL DEFAULT 0,
    diferencia      REAL,
    estado          TEXT    NOT NULL DEFAULT 'abierto'
                    CHECK (estado IN ('abierto', 'cerrado')),
    notas           TEXT,
    abierto_at      TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%S', 'now', 'localtime')),
    cerrado_at      TEXT
);

CREATE INDEX idx_turno_usuario ON turno_caja (usuario_id);
CREATE INDEX idx_turno_estado ON turno_caja (estado);

CREATE TABLE IF NOT EXISTS movimiento_caja (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    turno_id        INTEGER NOT NULL REFERENCES turno_caja(id),
    usuario_id      INTEGER NOT NULL REFERENCES usuario(id),
    tipo            TEXT    NOT NULL CHECK (tipo IN ('entrada', 'salida')),
    importe         REAL    NOT NULL,
    concepto        TEXT    NOT NULL DEFAULT '',
    created_at      TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%S', 'now', 'localtime'))
);

CREATE INDEX idx_movimiento_turno ON movimiento_caja (turno_id);

-- ============================================================================
-- SERIES DE FACTURACIÓN
-- ============================================================================
CREATE TABLE IF NOT EXISTS serie_facturacion (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    codigo          TEXT    NOT NULL UNIQUE,     -- Ej: 'A', 'B', 'R'
    descripcion     TEXT    NOT NULL DEFAULT '',
    tipo            TEXT    NOT NULL CHECK (tipo IN ('simplificada', 'completa', 'rectificativa')),
    ultimo_numero   INTEGER NOT NULL DEFAULT 0,  -- Contador secuencial
    activa          INTEGER NOT NULL DEFAULT 1,
    created_at      TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%S', 'now', 'localtime'))
);

-- Series por defecto
INSERT INTO serie_facturacion (codigo, descripcion, tipo) VALUES
    ('A', 'Facturas simplificadas (tickets)', 'simplificada'),
    ('B', 'Facturas completas', 'completa'),
    ('R', 'Facturas rectificativas', 'rectificativa');

-- ============================================================================
-- VENTAS
-- ============================================================================
CREATE TABLE IF NOT EXISTS venta (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    mesa_id         INTEGER REFERENCES mesa(id),          -- NULL = venta directa
    usuario_id      INTEGER NOT NULL REFERENCES usuario(id),
    cliente_id      INTEGER REFERENCES cliente(id),        -- NULL = consumidor final
    turno_id        INTEGER NOT NULL REFERENCES turno_caja(id),
    serie_id        INTEGER REFERENCES serie_facturacion(id),
    numero          TEXT,                                   -- Nº factura (se asigna al cobrar)
    tipo            TEXT    NOT NULL DEFAULT 'mesa'
                    CHECK (tipo IN ('mesa', 'barra', 'llevar')),
    estado          TEXT    NOT NULL DEFAULT 'abierta'
                    CHECK (estado IN ('abierta', 'cobrada', 'anulada')),
    comensales      INTEGER NOT NULL DEFAULT 1,
    subtotal        REAL    NOT NULL DEFAULT 0.0,
    total_descuento REAL    NOT NULL DEFAULT 0.0,
    total_iva       REAL    NOT NULL DEFAULT 0.0,
    total           REAL    NOT NULL DEFAULT 0.0,
    notas           TEXT,
    abierta_at      TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%S', 'now', 'localtime')),
    cerrada_at      TEXT,
    created_at      TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%S', 'now', 'localtime'))
);

CREATE INDEX idx_venta_mesa ON venta (mesa_id) WHERE mesa_id IS NOT NULL;
CREATE INDEX idx_venta_usuario ON venta (usuario_id);
CREATE INDEX idx_venta_turno ON venta (turno_id);
CREATE INDEX idx_venta_estado ON venta (estado);
CREATE INDEX idx_venta_numero ON venta (serie_id, numero) WHERE numero IS NOT NULL;
CREATE INDEX idx_venta_fecha ON venta (created_at);

-- ============================================================================
-- LÍNEAS DE VENTA
-- ============================================================================
CREATE TABLE IF NOT EXISTS linea_venta (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    venta_id        INTEGER NOT NULL REFERENCES venta(id) ON DELETE CASCADE,
    producto_id     INTEGER NOT NULL REFERENCES producto(id),
    -- Snapshot del producto al momento de la venta (inmutabilidad fiscal)
    producto_nombre TEXT    NOT NULL,
    producto_precio REAL    NOT NULL,
    tipo_iva        REAL    NOT NULL,
    cantidad        REAL    NOT NULL DEFAULT 1.0,
    descuento_pct   REAL    NOT NULL DEFAULT 0.0,
    subtotal        REAL    NOT NULL DEFAULT 0.0,  -- precio * cantidad
    importe_iva     REAL    NOT NULL DEFAULT 0.0,
    total           REAL    NOT NULL DEFAULT 0.0,   -- subtotal - descuento + iva
    notas           TEXT,
    created_at      TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%S', 'now', 'localtime'))
);

CREATE INDEX idx_linea_venta ON linea_venta (venta_id);

-- ============================================================================
-- MODIFICADORES APLICADOS A LÍNEAS
-- ============================================================================
CREATE TABLE IF NOT EXISTS linea_modificador (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    linea_venta_id  INTEGER NOT NULL REFERENCES linea_venta(id) ON DELETE CASCADE,
    modificador_id  INTEGER NOT NULL REFERENCES modificador(id),
    -- Snapshot del modificador
    nombre          TEXT    NOT NULL,
    precio_extra    REAL    NOT NULL DEFAULT 0.0,
    created_at      TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%S', 'now', 'localtime'))
);

CREATE INDEX idx_linea_mod_linea ON linea_modificador (linea_venta_id);

-- ============================================================================
-- PAGOS
-- ============================================================================
CREATE TABLE IF NOT EXISTS pago (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    venta_id        INTEGER NOT NULL REFERENCES venta(id) ON DELETE CASCADE,
    metodo          TEXT    NOT NULL CHECK (metodo IN ('efectivo', 'tarjeta', 'otro')),
    importe         REAL    NOT NULL,
    cambio          REAL    NOT NULL DEFAULT 0.0,
    referencia      TEXT,   -- Nº de transacción tarjeta, etc.
    created_at      TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%S', 'now', 'localtime'))
);

CREATE INDEX idx_pago_venta ON pago (venta_id);

-- ============================================================================
-- REGISTROS VERIFACTU
-- ============================================================================
CREATE TABLE IF NOT EXISTS registro_verifactu (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    venta_id            INTEGER NOT NULL REFERENCES venta(id),
    nif_emisor          TEXT    NOT NULL,
    numero_factura      TEXT    NOT NULL,
    serie               TEXT    NOT NULL,
    fecha_expedicion    TEXT    NOT NULL,
    tipo_factura        TEXT    NOT NULL,  -- 'F1' simplificada, 'F2' completa
    -- Desglose fiscal
    base_imponible_4    REAL    NOT NULL DEFAULT 0.0,
    cuota_iva_4         REAL    NOT NULL DEFAULT 0.0,
    base_imponible_10   REAL    NOT NULL DEFAULT 0.0,
    cuota_iva_10        REAL    NOT NULL DEFAULT 0.0,
    base_imponible_21   REAL    NOT NULL DEFAULT 0.0,
    cuota_iva_21        REAL    NOT NULL DEFAULT 0.0,
    total               REAL    NOT NULL,
    -- Hash chain
    hash_anterior       TEXT    NOT NULL DEFAULT '',
    hash_actual         TEXT    NOT NULL,
    -- QR
    qr_url              TEXT,
    -- Estado de envío a AEAT
    estado_envio        TEXT    NOT NULL DEFAULT 'pendiente'
                        CHECK (estado_envio IN ('pendiente', 'enviando', 'enviado', 'error')),
    xml_enviado         TEXT,
    respuesta_aeat      TEXT,
    intentos_envio      INTEGER NOT NULL DEFAULT 0,
    ultimo_intento_at   TEXT,
    enviado_at          TEXT,
    created_at          TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%S', 'now', 'localtime'))
);

CREATE INDEX idx_verifactu_venta ON registro_verifactu (venta_id);
CREATE INDEX idx_verifactu_estado ON registro_verifactu (estado_envio);
CREATE INDEX idx_verifactu_hash ON registro_verifactu (hash_actual);

-- ============================================================================
-- EVENTOS DEL SISTEMA (Auditoría inmutable)
-- ============================================================================
CREATE TABLE IF NOT EXISTS evento_sistema (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    usuario_id      INTEGER REFERENCES usuario(id),
    tipo            TEXT    NOT NULL,    -- 'venta.creada', 'caja.abierta', etc.
    entidad         TEXT    NOT NULL,    -- 'venta', 'mesa', 'producto', etc.
    entidad_id      INTEGER,
    detalle         TEXT,               -- JSON con estado anterior/nuevo
    created_at      TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%S', 'now', 'localtime'))
);

CREATE INDEX idx_evento_tipo ON evento_sistema (tipo);
CREATE INDEX idx_evento_entidad ON evento_sistema (entidad, entidad_id);
CREATE INDEX idx_evento_fecha ON evento_sistema (created_at);
CREATE INDEX idx_evento_usuario ON evento_sistema (usuario_id);

-- ============================================================================
-- TABLA DE MIGRACIONES (Control interno)
-- ============================================================================
CREATE TABLE IF NOT EXISTS _migrations (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    version         TEXT    NOT NULL UNIQUE,
    nombre          TEXT    NOT NULL,
    applied_at      TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%S', 'now', 'localtime'))
);

INSERT INTO _migrations (version, nombre) VALUES ('001', 'initial_schema');

-- ============================================================================
-- TRIGGERS: Actualizar updated_at automáticamente
-- ============================================================================
CREATE TRIGGER trg_negocio_updated AFTER UPDATE ON negocio
BEGIN
    UPDATE negocio SET updated_at = strftime('%Y-%m-%dT%H:%M:%S', 'now', 'localtime')
    WHERE id = NEW.id;
END;

CREATE TRIGGER trg_usuario_updated AFTER UPDATE ON usuario
BEGIN
    UPDATE usuario SET updated_at = strftime('%Y-%m-%dT%H:%M:%S', 'now', 'localtime')
    WHERE id = NEW.id;
END;

CREATE TRIGGER trg_mesa_updated AFTER UPDATE ON mesa
BEGIN
    UPDATE mesa SET updated_at = strftime('%Y-%m-%dT%H:%M:%S', 'now', 'localtime')
    WHERE id = NEW.id;
END;

CREATE TRIGGER trg_producto_updated AFTER UPDATE ON producto
BEGIN
    UPDATE producto SET updated_at = strftime('%Y-%m-%dT%H:%M:%S', 'now', 'localtime')
    WHERE id = NEW.id;
END;

CREATE TRIGGER trg_cliente_updated AFTER UPDATE ON cliente
BEGIN
    UPDATE cliente SET updated_at = strftime('%Y-%m-%dT%H:%M:%S', 'now', 'localtime')
    WHERE id = NEW.id;
END;
