export function formatYen(value: number): string {
  return `¥${Math.round(value).toLocaleString('ja-JP')}`;
}

export function formatYenSigned(value: number): string {
  const rounded = Math.round(value);
  if (rounded > 0) return `+${formatYen(rounded)}`;
  if (rounded < 0) return `-${formatYen(Math.abs(rounded))}`;
  return formatYen(0);
}

export function formatPercent(rate: number): string {
  return `${Math.round(rate * 1000) / 10}%`;
}

export function formatDate(iso: string): string {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${y}/${m}/${d}`;
}
