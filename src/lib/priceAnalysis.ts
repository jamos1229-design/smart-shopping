import type { PriceRecord } from '../types';
import { effectiveTaxIncludedPrice } from './tax';

export interface PriceAnalysis {
  currentPrice: number | null;
  currentPriceDate: string | null;
  lowestPrice: number | null;
  averagePrice: number | null;
  highestPrice: number | null;
  lastConfirmedDate: string | null;
  recordCount: number;
}

export function analyzeProductPrices(records: PriceRecord[]): PriceAnalysis {
  if (records.length === 0) {
    return {
      currentPrice: null,
      currentPriceDate: null,
      lowestPrice: null,
      averagePrice: null,
      highestPrice: null,
      lastConfirmedDate: null,
      recordCount: 0,
    };
  }

  const sorted = [...records].sort((a, b) => (a.confirmedDate < b.confirmedDate ? 1 : -1));
  const prices = records.map(effectiveTaxIncludedPrice);
  const latest = sorted[0];

  return {
    currentPrice: effectiveTaxIncludedPrice(latest),
    currentPriceDate: latest.confirmedDate,
    lowestPrice: Math.min(...prices),
    averagePrice: prices.reduce((sum, p) => sum + p, 0) / prices.length,
    highestPrice: Math.max(...prices),
    lastConfirmedDate: latest.confirmedDate,
    recordCount: records.length,
  };
}

export function latestPriceByStore(records: PriceRecord[]): Map<string, PriceRecord> {
  const map = new Map<string, PriceRecord>();
  const sorted = [...records].sort((a, b) => (a.confirmedDate < b.confirmedDate ? 1 : -1));
  for (const record of sorted) {
    if (!map.has(record.storeId)) {
      map.set(record.storeId, record);
    }
  }
  return map;
}
