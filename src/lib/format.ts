export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('es-ES', { 
    style: 'currency', 
    currency: 'EUR' 
  }).format(amount);
}

export function formatDateTime(isoString: string): string {
  if (!isoString) return "";
  const date = new Date(isoString);
  return new Intl.DateTimeFormat('es-ES', { 
    dateStyle: 'short', 
    timeStyle: 'short' 
  }).format(date);
}
