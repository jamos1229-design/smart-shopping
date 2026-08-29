import type { ComparisonUnit, Product } from '../types';

const VOLUME_UNIT_TO_ML: Record<string, number> = {
  ml: 1,
  mL: 1,
  l: 1000,
  L: 1000,
};

const WEIGHT_UNIT_TO_G: Record<string, number> = {
  g: 1,
  kg: 1000,
};

export const COMPARISON_UNIT_LABELS: Record<ComparisonUnit, string> = {
  per100ml: '100mlあたり',
  per100g: '100gあたり',
  per1kg: '1kgあたり',
  per1piece: '1個あたり',
  per1sheet: '1枚あたり',
  per1box: '1箱あたり',
  per1roll: '1ロールあたり',
};

function totalBaseAmount(product: Product): number | null {
  const { comparisonUnit, volume, volumeUnit, quantity } = product;
  const packCount = quantity && quantity > 0 ? quantity : 1;

  if (comparisonUnit === 'per100ml') {
    if (volume === null) return null;
    const factor = VOLUME_UNIT_TO_ML[volumeUnit] ?? 1;
    return volume * factor * packCount;
  }
  if (comparisonUnit === 'per100g' || comparisonUnit === 'per1kg') {
    if (volume === null) return null;
    const factor = WEIGHT_UNIT_TO_G[volumeUnit] ?? 1;
    return volume * factor * packCount;
  }
  // piece / sheet / box / roll — count-based
  return packCount;
}

export function computeUnitPrice(product: Product, effectivePrice: number): number | null {
  const base = totalBaseAmount(product);
  if (base === null || base <= 0) return null;

  switch (product.comparisonUnit) {
    case 'per100ml':
    case 'per100g':
      return (effectivePrice / base) * 100;
    case 'per1kg':
      return (effectivePrice / base) * 1000;
    case 'per1piece':
    case 'per1sheet':
    case 'per1box':
    case 'per1roll':
    default:
      return effectivePrice / base;
  }
}
