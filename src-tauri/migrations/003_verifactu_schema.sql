-- Migración 003: Añadir esquemas de VeriFactu (AEAT)

-- Ampliar la tabla 'venta' para soportar facturación VeriFactu
ALTER TABLE venta ADD COLUMN hash_registro TEXT;
ALTER TABLE venta ADD COLUMN hash_anterior TEXT;
ALTER TABLE venta ADD COLUMN huella_verifactu TEXT;
ALTER TABLE venta ADD COLUMN estado_verifactu TEXT DEFAULT 'pendiente';
ALTER TABLE venta ADD COLUMN fecha_hora_huso TEXT;
ALTER TABLE venta ADD COLUMN qr_data TEXT;

-- Tabla de Registro de Eventos (Obligatorio SIF)
CREATE TABLE IF NOT EXISTS verifactu_eventos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tipo_evento TEXT NOT NULL, -- ej: 'ARRANQUE', 'PARADA', 'ERROR'
    descripcion TEXT,
    hash_evento TEXT,
    fecha_hora TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%S', 'now', 'localtime'))
);

-- Insertar esta migración en la tabla interna
INSERT INTO _migrations (version, nombre) VALUES ('003', 'verifactu_schema');
