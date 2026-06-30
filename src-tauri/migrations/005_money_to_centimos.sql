-- ============================================================================
-- Migración 005: Dinero a céntimos enteros
-- ============================================================================
-- Convierte todas las columnas monetarias de REAL (euros en coma flotante) a
-- INTEGER (céntimos), eliminando los errores de redondeo del f64.
--
-- SQLite no permite cambiar la afinidad de una columna con ALTER TABLE, así que
-- se sigue el procedimiento recomendado: crear tabla nueva con la afinedad
-- correcta (afinidad), copiar los datos convertidos (ROUND(x*100)), borrar la antigua y
-- renombrar. El migrador ejecuta esto con `foreign_keys = OFF`.
--
-- Columnas que NO son dinero y se mantienen: tipo_iva (porcentaje),
-- descuento_pct (porcentaje), cantidad (unidades), total_ventas (contador),
-- pos_x/pos_y/ancho/alto (coordenadas).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- producto.precio
-- ---------------------------------------------------------------------------
CREATE TABLE producto_new (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    familia_id      INTEGER NOT NULL REFERENCES familia(id),
    nombre          TEXT    NOT NULL,
    codigo          TEXT,
    precio          INTEGER NOT NULL DEFAULT 0,
    tipo_iva        REAL    NOT NULL DEFAULT 10.0
                    CHECK (tipo_iva IN (0.0, 4.0, 10.0, 21.0)),
    imagen_path     TEXT,
    activo          INTEGER NOT NULL DEFAULT 1,
    orden           INTEGER NOT NULL DEFAULT 0,
    created_at      TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%S', 'now', 'localtime')),
    updated_at      TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%S', 'now', 'localtime'))
);
INSERT INTO producto_new (id, familia_id, nombre, codigo, precio, tipo_iva, imagen_path, activo, orden, created_at, updated_at)
    SELECT id, familia_id, nombre, codigo, CAST(ROUND(precio * 100) AS INTEGER), tipo_iva, imagen_path, activo, orden, created_at, updated_at
    FROM producto;
DROP TABLE producto;
ALTER TABLE producto_new RENAME TO producto;
CREATE INDEX idx_producto_familia ON producto (familia_id);
CREATE INDEX idx_producto_activo ON producto (activo);
CREATE INDEX idx_producto_codigo ON producto (codigo) WHERE codigo IS NOT NULL;
CREATE TRIGGER trg_producto_updated AFTER UPDATE ON producto
BEGIN
    UPDATE producto SET updated_at = strftime('%Y-%m-%dT%H:%M:%S', 'now', 'localtime')
    WHERE id = NEW.id;
END;

-- ---------------------------------------------------------------------------
-- modificador.precio_extra
-- ---------------------------------------------------------------------------
CREATE TABLE modificador_new (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    grupo_id        INTEGER NOT NULL REFERENCES modificador_grupo(id) ON DELETE CASCADE,
    nombre          TEXT    NOT NULL,
    precio_extra    INTEGER NOT NULL DEFAULT 0,
    orden           INTEGER NOT NULL DEFAULT 0,
    activo          INTEGER NOT NULL DEFAULT 1,
    created_at      TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%S', 'now', 'localtime'))
);
INSERT INTO modificador_new (id, grupo_id, nombre, precio_extra, orden, activo, created_at)
    SELECT id, grupo_id, nombre, CAST(ROUND(precio_extra * 100) AS INTEGER), orden, activo, created_at
    FROM modificador;
DROP TABLE modificador;
ALTER TABLE modificador_new RENAME TO modificador;
CREATE INDEX idx_modificador_grupo ON modificador (grupo_id);

-- ---------------------------------------------------------------------------
-- turno_caja: fondo_inicial, fondo_final, total_efectivo, total_tarjeta,
--             total_otros, diferencia
-- ---------------------------------------------------------------------------
CREATE TABLE turno_caja_new (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    usuario_id      INTEGER NOT NULL REFERENCES usuario(id),
    fondo_inicial   INTEGER NOT NULL DEFAULT 0,
    fondo_final     INTEGER,
    total_efectivo  INTEGER NOT NULL DEFAULT 0,
    total_tarjeta   INTEGER NOT NULL DEFAULT 0,
    total_otros     INTEGER NOT NULL DEFAULT 0,
    total_ventas    INTEGER NOT NULL DEFAULT 0,
    diferencia      INTEGER,
    estado          TEXT    NOT NULL DEFAULT 'abierto'
                    CHECK (estado IN ('abierto', 'cerrado')),
    notas           TEXT,
    abierto_at      TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%S', 'now', 'localtime')),
    cerrado_at      TEXT
);
INSERT INTO turno_caja_new (id, usuario_id, fondo_inicial, fondo_final, total_efectivo, total_tarjeta, total_otros, total_ventas, diferencia, estado, notas, abierto_at, cerrado_at)
    SELECT id, usuario_id,
           CAST(ROUND(fondo_inicial * 100) AS INTEGER),
           CAST(ROUND(fondo_final * 100) AS INTEGER),
           CAST(ROUND(total_efectivo * 100) AS INTEGER),
           CAST(ROUND(total_tarjeta * 100) AS INTEGER),
           CAST(ROUND(total_otros * 100) AS INTEGER),
           total_ventas,
           CAST(ROUND(diferencia * 100) AS INTEGER),
           estado, notas, abierto_at, cerrado_at
    FROM turno_caja;
DROP TABLE turno_caja;
ALTER TABLE turno_caja_new RENAME TO turno_caja;
CREATE INDEX idx_turno_usuario ON turno_caja (usuario_id);
CREATE INDEX idx_turno_estado ON turno_caja (estado);

-- ---------------------------------------------------------------------------
-- movimiento_caja.importe
-- ---------------------------------------------------------------------------
CREATE TABLE movimiento_caja_new (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    turno_id        INTEGER NOT NULL REFERENCES turno_caja(id),
    usuario_id      INTEGER NOT NULL REFERENCES usuario(id),
    tipo            TEXT    NOT NULL CHECK (tipo IN ('entrada', 'salida')),
    importe         INTEGER NOT NULL,
    concepto        TEXT    NOT NULL DEFAULT '',
    created_at      TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%S', 'now', 'localtime'))
);
INSERT INTO movimiento_caja_new (id, turno_id, usuario_id, tipo, importe, concepto, created_at)
    SELECT id, turno_id, usuario_id, tipo, CAST(ROUND(importe * 100) AS INTEGER), concepto, created_at
    FROM movimiento_caja;
DROP TABLE movimiento_caja;
ALTER TABLE movimiento_caja_new RENAME TO movimiento_caja;
CREATE INDEX idx_movimiento_turno ON movimiento_caja (turno_id);

-- ---------------------------------------------------------------------------
-- venta: subtotal, total_descuento, total_iva, total
-- (incluye columnas añadidas por la migración 003)
-- ---------------------------------------------------------------------------
CREATE TABLE venta_new (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    mesa_id         INTEGER REFERENCES mesa(id),
    usuario_id      INTEGER NOT NULL REFERENCES usuario(id),
    cliente_id      INTEGER REFERENCES cliente(id),
    turno_id        INTEGER NOT NULL REFERENCES turno_caja(id),
    serie_id        INTEGER REFERENCES serie_facturacion(id),
    numero          TEXT,
    tipo            TEXT    NOT NULL DEFAULT 'mesa'
                    CHECK (tipo IN ('mesa', 'barra', 'llevar')),
    estado          TEXT    NOT NULL DEFAULT 'abierta'
                    CHECK (estado IN ('abierta', 'cobrada', 'anulada')),
    comensales      INTEGER NOT NULL DEFAULT 1,
    subtotal        INTEGER NOT NULL DEFAULT 0,
    total_descuento INTEGER NOT NULL DEFAULT 0,
    total_iva       INTEGER NOT NULL DEFAULT 0,
    total           INTEGER NOT NULL DEFAULT 0,
    notas           TEXT,
    abierta_at      TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%S', 'now', 'localtime')),
    cerrada_at      TEXT,
    created_at      TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%S', 'now', 'localtime')),
    hash_registro       TEXT,
    hash_anterior       TEXT,
    huella_verifactu    TEXT,
    estado_verifactu    TEXT DEFAULT 'pendiente',
    fecha_hora_huso     TEXT,
    qr_data             TEXT
);
INSERT INTO venta_new (id, mesa_id, usuario_id, cliente_id, turno_id, serie_id, numero, tipo, estado, comensales, subtotal, total_descuento, total_iva, total, notas, abierta_at, cerrada_at, created_at, hash_registro, hash_anterior, huella_verifactu, estado_verifactu, fecha_hora_huso, qr_data)
    SELECT id, mesa_id, usuario_id, cliente_id, turno_id, serie_id, numero, tipo, estado, comensales,
           CAST(ROUND(subtotal * 100) AS INTEGER),
           CAST(ROUND(total_descuento * 100) AS INTEGER),
           CAST(ROUND(total_iva * 100) AS INTEGER),
           CAST(ROUND(total * 100) AS INTEGER),
           notas, abierta_at, cerrada_at, created_at,
           hash_registro, hash_anterior, huella_verifactu, estado_verifactu, fecha_hora_huso, qr_data
    FROM venta;
DROP TABLE venta;
ALTER TABLE venta_new RENAME TO venta;
CREATE INDEX idx_venta_mesa ON venta (mesa_id) WHERE mesa_id IS NOT NULL;
CREATE INDEX idx_venta_usuario ON venta (usuario_id);
CREATE INDEX idx_venta_turno ON venta (turno_id);
CREATE INDEX idx_venta_estado ON venta (estado);
CREATE INDEX idx_venta_numero ON venta (serie_id, numero) WHERE numero IS NOT NULL;
CREATE INDEX idx_venta_fecha ON venta (created_at);

-- ---------------------------------------------------------------------------
-- linea_venta: producto_precio, subtotal, importe_iva, total
-- ---------------------------------------------------------------------------
CREATE TABLE linea_venta_new (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    venta_id        INTEGER NOT NULL REFERENCES venta(id) ON DELETE CASCADE,
    producto_id     INTEGER NOT NULL REFERENCES producto(id),
    producto_nombre TEXT    NOT NULL,
    producto_precio INTEGER NOT NULL,
    tipo_iva        REAL    NOT NULL,
    cantidad        REAL    NOT NULL DEFAULT 1.0,
    descuento_pct   REAL    NOT NULL DEFAULT 0.0,
    subtotal        INTEGER NOT NULL DEFAULT 0,
    importe_iva     INTEGER NOT NULL DEFAULT 0,
    total           INTEGER NOT NULL DEFAULT 0,
    notas           TEXT,
    created_at      TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%S', 'now', 'localtime'))
);
-- producto_precio pasa de "base imponible unitaria (euros)" a "PVP bruto
-- unitario (céntimos)": gross_cents = round(base_euros * (100 + tipo_iva)).
INSERT INTO linea_venta_new (id, venta_id, producto_id, producto_nombre, producto_precio, tipo_iva, cantidad, descuento_pct, subtotal, importe_iva, total, notas, created_at)
    SELECT id, venta_id, producto_id, producto_nombre,
           CAST(ROUND(producto_precio * (100 + tipo_iva)) AS INTEGER),
           tipo_iva, cantidad, descuento_pct,
           CAST(ROUND(subtotal * 100) AS INTEGER),
           CAST(ROUND(importe_iva * 100) AS INTEGER),
           CAST(ROUND(total * 100) AS INTEGER),
           notas, created_at
    FROM linea_venta;
DROP TABLE linea_venta;
ALTER TABLE linea_venta_new RENAME TO linea_venta;
CREATE INDEX idx_linea_venta ON linea_venta (venta_id);

-- ---------------------------------------------------------------------------
-- linea_modificador.precio_extra
-- ---------------------------------------------------------------------------
CREATE TABLE linea_modificador_new (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    linea_venta_id  INTEGER NOT NULL REFERENCES linea_venta(id) ON DELETE CASCADE,
    modificador_id  INTEGER NOT NULL REFERENCES modificador(id),
    nombre          TEXT    NOT NULL,
    precio_extra    INTEGER NOT NULL DEFAULT 0,
    created_at      TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%S', 'now', 'localtime'))
);
INSERT INTO linea_modificador_new (id, linea_venta_id, modificador_id, nombre, precio_extra, created_at)
    SELECT id, linea_venta_id, modificador_id, nombre, CAST(ROUND(precio_extra * 100) AS INTEGER), created_at
    FROM linea_modificador;
DROP TABLE linea_modificador;
ALTER TABLE linea_modificador_new RENAME TO linea_modificador;
CREATE INDEX idx_linea_mod_linea ON linea_modificador (linea_venta_id);

-- ---------------------------------------------------------------------------
-- pago: importe, cambio
-- ---------------------------------------------------------------------------
CREATE TABLE pago_new (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    venta_id        INTEGER NOT NULL REFERENCES venta(id) ON DELETE CASCADE,
    metodo          TEXT    NOT NULL CHECK (metodo IN ('efectivo', 'tarjeta', 'otro')),
    importe         INTEGER NOT NULL,
    cambio          INTEGER NOT NULL DEFAULT 0,
    referencia      TEXT,
    created_at      TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%S', 'now', 'localtime'))
);
INSERT INTO pago_new (id, venta_id, metodo, importe, cambio, referencia, created_at)
    SELECT id, venta_id, metodo,
           CAST(ROUND(importe * 100) AS INTEGER),
           CAST(ROUND(cambio * 100) AS INTEGER),
           referencia, created_at
    FROM pago;
DROP TABLE pago;
ALTER TABLE pago_new RENAME TO pago;
CREATE INDEX idx_pago_venta ON pago (venta_id);

-- ---------------------------------------------------------------------------
-- registro_verifactu: bases imponibles, cuotas y total
-- ---------------------------------------------------------------------------
CREATE TABLE registro_verifactu_new (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    venta_id            INTEGER NOT NULL REFERENCES venta(id),
    nif_emisor          TEXT    NOT NULL,
    numero_factura      TEXT    NOT NULL,
    serie               TEXT    NOT NULL,
    fecha_expedicion    TEXT    NOT NULL,
    tipo_factura        TEXT    NOT NULL,
    base_imponible_4    INTEGER NOT NULL DEFAULT 0,
    cuota_iva_4         INTEGER NOT NULL DEFAULT 0,
    base_imponible_10   INTEGER NOT NULL DEFAULT 0,
    cuota_iva_10        INTEGER NOT NULL DEFAULT 0,
    base_imponible_21   INTEGER NOT NULL DEFAULT 0,
    cuota_iva_21        INTEGER NOT NULL DEFAULT 0,
    total               INTEGER NOT NULL,
    hash_anterior       TEXT    NOT NULL DEFAULT '',
    hash_actual         TEXT    NOT NULL,
    qr_url              TEXT,
    estado_envio        TEXT    NOT NULL DEFAULT 'pendiente'
                        CHECK (estado_envio IN ('pendiente', 'enviando', 'enviado', 'error')),
    xml_enviado         TEXT,
    respuesta_aeat      TEXT,
    intentos_envio      INTEGER NOT NULL DEFAULT 0,
    ultimo_intento_at   TEXT,
    enviado_at          TEXT,
    created_at          TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%S', 'now', 'localtime'))
);
INSERT INTO registro_verifactu_new (id, venta_id, nif_emisor, numero_factura, serie, fecha_expedicion, tipo_factura, base_imponible_4, cuota_iva_4, base_imponible_10, cuota_iva_10, base_imponible_21, cuota_iva_21, total, hash_anterior, hash_actual, qr_url, estado_envio, xml_enviado, respuesta_aeat, intentos_envio, ultimo_intento_at, enviado_at, created_at)
    SELECT id, venta_id, nif_emisor, numero_factura, serie, fecha_expedicion, tipo_factura,
           CAST(ROUND(base_imponible_4 * 100) AS INTEGER),
           CAST(ROUND(cuota_iva_4 * 100) AS INTEGER),
           CAST(ROUND(base_imponible_10 * 100) AS INTEGER),
           CAST(ROUND(cuota_iva_10 * 100) AS INTEGER),
           CAST(ROUND(base_imponible_21 * 100) AS INTEGER),
           CAST(ROUND(cuota_iva_21 * 100) AS INTEGER),
           CAST(ROUND(total * 100) AS INTEGER),
           hash_anterior, hash_actual, qr_url, estado_envio, xml_enviado, respuesta_aeat, intentos_envio, ultimo_intento_at, enviado_at, created_at
    FROM registro_verifactu;
DROP TABLE registro_verifactu;
ALTER TABLE registro_verifactu_new RENAME TO registro_verifactu;
CREATE INDEX idx_verifactu_venta ON registro_verifactu (venta_id);
CREATE INDEX idx_verifactu_estado ON registro_verifactu (estado_envio);
CREATE INDEX idx_verifactu_hash ON registro_verifactu (hash_actual);

-- ---------------------------------------------------------------------------
-- ticket: subtotal, total_iva, total
-- (contenido_json de tickets antiguos queda en euros; los nuevos se generan en
--  céntimos. Es solo una instantánea histórica de visualización.)
-- ---------------------------------------------------------------------------
CREATE TABLE ticket_new (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    venta_id        INTEGER,
    tipo            TEXT    NOT NULL DEFAULT 'fiscal',
    numero          TEXT,
    mesa_nombre     TEXT,
    usuario_nombre  TEXT,
    metodo_pago     TEXT,
    comensales      INTEGER NOT NULL DEFAULT 1,
    subtotal        INTEGER NOT NULL DEFAULT 0,
    total_iva       INTEGER NOT NULL DEFAULT 0,
    total           INTEGER NOT NULL DEFAULT 0,
    qr_data         TEXT,
    contenido_json  TEXT    NOT NULL DEFAULT '[]',
    created_at      TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%S', 'now', 'localtime'))
);
INSERT INTO ticket_new (id, venta_id, tipo, numero, mesa_nombre, usuario_nombre, metodo_pago, comensales, subtotal, total_iva, total, qr_data, contenido_json, created_at)
    SELECT id, venta_id, tipo, numero, mesa_nombre, usuario_nombre, metodo_pago, comensales,
           CAST(ROUND(subtotal * 100) AS INTEGER),
           CAST(ROUND(total_iva * 100) AS INTEGER),
           CAST(ROUND(total * 100) AS INTEGER),
           qr_data, contenido_json, created_at
    FROM ticket;
DROP TABLE ticket;
ALTER TABLE ticket_new RENAME TO ticket;
CREATE INDEX idx_ticket_created ON ticket(created_at DESC);
CREATE INDEX idx_ticket_tipo ON ticket(tipo);
CREATE INDEX idx_ticket_venta ON ticket(venta_id);
