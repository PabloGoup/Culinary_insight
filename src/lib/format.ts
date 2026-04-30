export const money = new Intl.NumberFormat('es-CL', {
  style: 'currency',
  currency: 'CLP',
  maximumFractionDigits: 0,
});

export const percent = new Intl.NumberFormat('es-CL', {
  style: 'percent',
  maximumFractionDigits: 1,
});

export const decimal = new Intl.NumberFormat('es-CL', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 3,
});

export function compactNumber(value: number) {
  return new Intl.NumberFormat('es-CL', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value);
}
