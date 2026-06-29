-- Migración 004: Historial de tickets (pre-cuentas y tickets fiscales)
-- Cada vez que se genera un ticket (al pulsar "Generar Ticket" o al cobrar)
-- se guarda aquí una instantánea inmutable para consultarlo posteriormente.

CREATE TABLE IF NOT EXISTS ticket (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    venta_id        INTEGER,                              -- venta de origen (puede quedar huérfana)
    tipo            TEXT    NOT NULL DEFAULT 'fiscal',    -- 'pre_cuenta' | 'fiscal'
    numero          TEXT,                                  -- nº de factura (solo tickets fiscales)
    mesa_nombre     TEXT,
    usuario_nombre  TEXT,
    metodo_pago     TEXT,                                  -- solo tickets fiscales
    comensales      INTEGER NOT NULL DEFAULT 1,
    subtotal        REAL    NOT NULL DEFAULT 0,
    total_iva       REAL    NOT NULL DEFAULT 0,
    total           REAL    NOT NULL DEFAULT 0,
    qr_data         TEXT,                                  -- URL QR VeriFactu (solo tickets fiscales)
    contenido_json  TEXT    NOT NULL DEFAULT '[]',         -- instantánea de las líneas (JSON)
    created_at      TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%S', 'now', 'localtime'))
);

CREATE INDEX IF NOT EXISTS idx_ticket_created ON ticket(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ticket_tipo ON ticket(tipo);
CREATE INDEX IF NOT EXISTS idx_ticket_venta ON ticket(venta_id);

-- Registrar esta migración en la tabla interna
INSERT INTO _migrations (version, nombre) VALUES ('004', 'tickets_historial');
