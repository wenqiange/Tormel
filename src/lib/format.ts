export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('es-ES', { 
    style: 'currency', 
    currency: 'EUR' 
  }).format(amount);
}

// ============================================================================
// Dinero en céntimos enteros (i64 en backend)
// El backend almacena y devuelve todo el dinero en céntimos (enteros).
// Estas utilidades convierten entre céntimos y euros para mostrar/introducir.
// ============================================================================

/// Convierte céntimos enteros a euros (número con decimales) para cálculos puntuales.
export function centimosAEuros(centimos: number): number {
  return centimos / 100;
}

/// Convierte un importe en euros a céntimos enteros, redondeando al céntimo.
export function eurosACentimos(euros: number): number {
  return Math.round(euros * 100);
}

/// Formatea un importe en céntimos como moneda local (p. ej. 1250 -> "12,50 €").
export function formatCentimos(centimos: number): string {
  return formatCurrency(centimos / 100);
}

/// Formatea un importe en céntimos como número con 2 decimales y punto (p. ej. 1250 -> "12.50").
/// Útil para campos de entrada (`defaultValue`) que se reeditan.
export function centimosADecimalInput(centimos: number): string {
  return (centimos / 100).toFixed(2);
}

/// Parsea la entrada del usuario en euros (admite coma o punto) y la convierte a
/// céntimos enteros. Devuelve `null` si la entrada no es un número válido.
export function parseEurosACentimos(input: string): number | null {
  if (input == null) return null;
  const normalizado = input.trim().replace(/\s/g, "").replace(",", ".");
  if (normalizado === "") return null;
  const valor = Number(normalizado);
  if (!Number.isFinite(valor)) return null;
  return Math.round(valor * 100);
}

export function formatDateTime(isoString: string): string {
  if (!isoString) return "";
  const date = new Date(isoString);
  return new Intl.DateTimeFormat('es-ES', { 
    dateStyle: 'short', 
    timeStyle: 'short' 
  }).format(date);
}
