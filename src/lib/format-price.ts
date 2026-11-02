const pesos = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 });

export function formatPrice(value: number | string) {
  return pesos.format(Number(value) || 0);
}
