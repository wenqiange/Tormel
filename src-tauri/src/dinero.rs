//! Utilidades para manejar dinero como enteros de céntimos (`i64`).
//!
//! Todo el dinero de la aplicación se representa en céntimos enteros para
//! eliminar los errores de redondeo de la coma flotante (`f64`). Este módulo
//! centraliza las conversiones y el modelo de redondeo por línea.
//!
//! Modelo de redondeo (confirmado): se calcula desde el PVP bruto (IVA incluido)
//! para que el total siempre cuadre con lo que ve el cliente:
//!   total = round(pvp_unitario × cantidad)
//!   base  = round(total × 100 / (100 + iva%))
//!   iva   = total − base

/// Convierte euros (coma flotante) a céntimos enteros redondeando al céntimo
/// más cercano. Úsese SOLO en los límites del sistema (migración de datos
/// antiguos, semillas, parseo de entrada del usuario), nunca en la aritmética
/// interna de negocio.
pub fn euros_a_centimos(euros: f64) -> i64 {
    (euros * 100.0).round() as i64
}

/// Divide `num / den` redondeando al entero más cercano (half-up), preservando
/// el signo. `den` debe ser distinto de cero.
fn dividir_redondeando(num: i64, den: i64) -> i64 {
    debug_assert!(den != 0, "denominador cero en dividir_redondeando");
    if (num >= 0) == (den > 0) {
        (num + den / 2) / den
    } else {
        (num - den / 2) / den
    }
}

/// Redondea un porcentaje de IVA (p. ej. 10.0) a entero (10).
pub fn iva_pct_entero(tipo_iva: f64) -> i64 {
    tipo_iva.round() as i64
}

/// Total bruto en céntimos de una línea: `round(pvp_unitario × cantidad)`.
pub fn total_linea(pvp_unitario_centimos: i64, cantidad: f64) -> i64 {
    (pvp_unitario_centimos as f64 * cantidad).round() as i64
}

/// Base imponible (céntimos) correspondiente a un importe bruto y un % de IVA.
pub fn base_desde_bruto(total_centimos: i64, iva_pct: i64) -> i64 {
    dividir_redondeando(total_centimos * 100, 100 + iva_pct)
}

/// Desglose `(base, iva, total)` en céntimos a partir del PVP bruto unitario,
/// la cantidad (posiblemente fraccionaria) y el porcentaje de IVA entero.
pub fn desglose_linea(pvp_unitario_centimos: i64, cantidad: f64, iva_pct: i64) -> (i64, i64, i64) {
    let total = total_linea(pvp_unitario_centimos, cantidad);
    let base = base_desde_bruto(total, iva_pct);
    let iva = total - base;
    (base, iva, total)
}

/// Base imponible unitaria (céntimos) a partir del PVP bruto unitario, para
/// mostrar/imprimir el "precio" neto de la línea.
pub fn base_unitaria(pvp_unitario_centimos: i64, iva_pct: i64) -> i64 {
    base_desde_bruto(pvp_unitario_centimos, iva_pct)
}

/// Formatea céntimos como una cadena de euros con 2 decimales y punto decimal
/// (p. ej. 12100 → "121.00"). Es el formato exigido por la huella y el QR de
/// VeriFactu, equivalente al antiguo `format!("{:.2}", euros)`.
pub fn formato_euros(centimos: i64) -> String {
    let signo = if centimos < 0 { "-" } else { "" };
    let abs = centimos.abs();
    format!("{}{}.{:02}", signo, abs / 100, abs % 100)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn conversion_euros_centimos() {
        assert_eq!(euros_a_centimos(2.50), 250);
        assert_eq!(euros_a_centimos(0.10), 10);
        assert_eq!(euros_a_centimos(150.0), 15000);
        assert_eq!(euros_a_centimos(0.005), 1); // redondeo al alza
    }

    #[test]
    fn desglose_cuadra_base_mas_iva_igual_total() {
        // 2,50 € al 10%
        let (base, iva, total) = desglose_linea(250, 1.0, 10);
        assert_eq!(total, 250);
        assert_eq!(base + iva, total, "base + iva debe igualar total");
        assert_eq!(base, 227);
        assert_eq!(iva, 23);
    }

    #[test]
    fn desglose_al_21_por_ciento() {
        let (base, iva, total) = desglose_linea(250, 1.0, 21);
        assert_eq!(total, 250);
        assert_eq!(base + iva, total);
        assert_eq!(base, 207);
        assert_eq!(iva, 43);
    }

    #[test]
    fn desglose_con_cantidad_fraccionaria() {
        // 2,50 € × 2,5 unidades = 6,25 € al 10%
        let (base, iva, total) = desglose_linea(250, 2.5, 10);
        assert_eq!(total, 625);
        assert_eq!(base + iva, total);
    }

    #[test]
    fn iva_exento_no_genera_cuota() {
        let (base, iva, total) = desglose_linea(250, 1.0, 0);
        assert_eq!(total, 250);
        assert_eq!(base, 250);
        assert_eq!(iva, 0);
    }

    #[test]
    fn formato_euros_correcto() {
        assert_eq!(formato_euros(12100), "121.00");
        assert_eq!(formato_euros(1210), "12.10");
        assert_eq!(formato_euros(10), "0.10");
        assert_eq!(formato_euros(5), "0.05");
        assert_eq!(formato_euros(0), "0.00");
        assert_eq!(formato_euros(-250), "-2.50");
    }
}
