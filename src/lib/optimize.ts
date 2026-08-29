import type { PriceRecord, Product, ShoppingListItem, Store, UserSettings } from '../types';
import { effectiveTaxIncludedPrice } from './tax';
import { computeUnitPrice } from './unitPrice';
import { latestPriceByStore } from './priceAnalysis';

export interface ItemStoreOption {
  storeId: string;
  productId: string;
  unitEffectivePrice: number;
  lineTotal: number;
}

export type ItemOptionsMap = Map<string, Map<string, ItemStoreOption>>;

interface ResolveContext {
  products: Product[];
  priceRecordsByProduct: Map<string, PriceRecord[]>;
}

function candidateProductsForItem(item: ShoppingListItem, ctx: ResolveContext): Product[] {
  if (item.selectionType === 'product') {
    const product = ctx.products.find((p) => p.productId === item.productId);
    return product ? [product] : [];
  }
  return ctx.products.filter((p) => {
    if (p.categoryId !== item.categoryId) return false;
    if (item.minVolume !== null && (p.volume === null || p.volume < item.minVolume)) return false;
    if (item.desiredSpec.trim() !== '') {
      const needle = item.desiredSpec.trim().toLowerCase();
      const haystack = `${p.spec} ${p.name}`.toLowerCase();
      if (!haystack.includes(needle)) return false;
    }
    return true;
  });
}

export function resolveItemOptions(
  items: ShoppingListItem[],
  products: Product[],
  priceRecords: PriceRecord[],
  stores: Store[],
): ItemOptionsMap {
  const priceRecordsByProduct = new Map<string, PriceRecord[]>();
  for (const record of priceRecords) {
    const list = priceRecordsByProduct.get(record.productId) ?? [];
    list.push(record);
    priceRecordsByProduct.set(record.productId, list);
  }
  const ctx: ResolveContext = { products, priceRecordsByProduct };
  const result: ItemOptionsMap = new Map();

  for (const item of items) {
    const candidates = candidateProductsForItem(item, ctx);
    const perStore = new Map<string, ItemStoreOption>();

    for (const store of stores) {
      let best: { product: Product; price: number; unitPrice: number | null } | null = null;

      for (const product of candidates) {
        const records = priceRecordsByProduct.get(product.productId) ?? [];
        const latestByStore = latestPriceByStore(records);
        const record = latestByStore.get(store.storeId);
        if (!record) continue;
        const price = effectiveTaxIncludedPrice(record);
        const unitPrice = computeUnitPrice(product, price);

        if (!best) {
          best = { product, price, unitPrice };
          continue;
        }
        const bestComparable = best.unitPrice !== null && unitPrice !== null;
        if (bestComparable) {
          if ((unitPrice as number) < (best.unitPrice as number)) best = { product, price, unitPrice };
        } else if (price < best.price) {
          best = { product, price, unitPrice };
        }
      }

      if (best) {
        perStore.set(store.storeId, {
          storeId: store.storeId,
          productId: best.product.productId,
          unitEffectivePrice: best.price,
          lineTotal: best.price * item.quantity,
        });
      }
    }

    result.set(item.shoppingListItemId, perStore);
  }

  return result;
}

export interface SingleStoreResult {
  storeId: string;
  total: number;
}

export interface PairStoreResult {
  storeIds: [string, string];
  total: number;
}

export interface UnlimitedResult {
  total: number;
  storeIds: Set<string>;
  assignment: Map<string, string>;
  uncoveredItemIds: string[];
}

export function computeSingleStoreOptions(
  items: ShoppingListItem[],
  itemOptions: ItemOptionsMap,
  stores: Store[],
): SingleStoreResult[] {
  const results: SingleStoreResult[] = [];
  for (const store of stores) {
    let total = 0;
    let coversAll = true;
    for (const item of items) {
      const option = itemOptions.get(item.shoppingListItemId)?.get(store.storeId);
      if (!option) {
        coversAll = false;
        break;
      }
      total += option.lineTotal;
    }
    if (coversAll) results.push({ storeId: store.storeId, total });
  }
  return results.sort((a, b) => a.total - b.total);
}

export function computeBestStorePairs(
  items: ShoppingListItem[],
  itemOptions: ItemOptionsMap,
  stores: Store[],
): PairStoreResult[] {
  const results: PairStoreResult[] = [];
  for (let i = 0; i < stores.length; i++) {
    for (let j = i + 1; j < stores.length; j++) {
      const a = stores[i].storeId;
      const b = stores[j].storeId;
      let total = 0;
      let coversAll = true;
      for (const item of items) {
        const options = itemOptions.get(item.shoppingListItemId);
        const optA = options?.get(a);
        const optB = options?.get(b);
        if (!optA && !optB) {
          coversAll = false;
          break;
        }
        total += Math.min(optA?.lineTotal ?? Infinity, optB?.lineTotal ?? Infinity);
      }
      if (coversAll) results.push({ storeIds: [a, b], total });
    }
  }
  return results.sort((a, b) => a.total - b.total);
}

export function computeUnlimitedOption(items: ShoppingListItem[], itemOptions: ItemOptionsMap): UnlimitedResult {
  let total = 0;
  const storeIds = new Set<string>();
  const assignment = new Map<string, string>();
  const uncoveredItemIds: string[] = [];

  for (const item of items) {
    const options = itemOptions.get(item.shoppingListItemId);
    if (!options || options.size === 0) {
      uncoveredItemIds.push(item.shoppingListItemId);
      continue;
    }
    let bestStoreId = '';
    let bestTotal = Infinity;
    for (const [storeId, option] of options) {
      if (option.lineTotal < bestTotal) {
        bestTotal = option.lineTotal;
        bestStoreId = storeId;
      }
    }
    total += bestTotal;
    storeIds.add(bestStoreId);
    assignment.set(item.shoppingListItemId, bestStoreId);
  }

  return { total, storeIds, assignment, uncoveredItemIds };
}

export type RecommendationKind = 'single' | 'pair' | 'unlimited';

export interface RecommendationCandidate {
  kind: RecommendationKind;
  storeCount: number;
  total: number;
  storeIds: string[];
}

export interface OptimizationSummary {
  single: SingleStoreResult | null;
  bestPair: PairStoreResult | null;
  unlimited: UnlimitedResult;
  recommendation: RecommendationCandidate | null;
  allCandidates: RecommendationCandidate[];
}

export function summarizeOptimization(
  items: ShoppingListItem[],
  itemOptions: ItemOptionsMap,
  stores: Store[],
  settings: UserSettings,
): OptimizationSummary {
  const singleOptions = computeSingleStoreOptions(items, itemOptions, stores);
  const pairOptions = computeBestStorePairs(items, itemOptions, stores);
  const unlimited = computeUnlimitedOption(items, itemOptions);

  const single = singleOptions[0] ?? null;
  const bestPair = pairOptions[0] ?? null;

  const candidates: RecommendationCandidate[] = [];
  if (single) candidates.push({ kind: 'single', storeCount: 1, total: single.total, storeIds: [single.storeId] });
  if (bestPair)
    candidates.push({ kind: 'pair', storeCount: 2, total: bestPair.total, storeIds: [...bestPair.storeIds] });
  if (unlimited.uncoveredItemIds.length === 0 && unlimited.storeIds.size > 0) {
    candidates.push({
      kind: 'unlimited',
      storeCount: unlimited.storeIds.size,
      total: unlimited.total,
      storeIds: [...unlimited.storeIds],
    });
  }

  candidates.sort((a, b) => a.storeCount - b.storeCount);
  const deduped: RecommendationCandidate[] = [];
  for (const candidate of candidates) {
    const existing = deduped.find((c) => c.storeCount === candidate.storeCount);
    if (!existing) deduped.push(candidate);
    else if (candidate.total < existing.total) Object.assign(existing, candidate);
  }

  let recommendation: RecommendationCandidate | null = deduped[0] ?? null;
  for (let i = 1; i < deduped.length; i++) {
    const candidate = deduped[i];
    if (!recommendation) {
      recommendation = candidate;
      continue;
    }
    const savings = recommendation.total - candidate.total;
    if (savings >= settings.minSavingsPerExtraStore && candidate.storeCount <= settings.maxStoresToVisit) {
      recommendation = candidate;
    }
  }

  return { single, bestPair, unlimited, recommendation, allCandidates: deduped };
}

export interface StoreBreakdownLine {
  item: ShoppingListItem;
  productId: string;
  price: number;
}

export function buildStoreBreakdown(
  candidate: RecommendationCandidate,
  items: ShoppingListItem[],
  itemOptions: ItemOptionsMap,
): Map<string, StoreBreakdownLine[]> {
  const breakdown = new Map<string, StoreBreakdownLine[]>();
  for (const storeId of candidate.storeIds) breakdown.set(storeId, []);

  for (const item of items) {
    const options = itemOptions.get(item.shoppingListItemId);
    if (!options) continue;

    let chosenStoreId: string | null = null;
    let chosenOption: ItemStoreOption | undefined;

    if (candidate.kind === 'single') {
      chosenStoreId = candidate.storeIds[0];
      chosenOption = options.get(chosenStoreId);
    } else {
      let bestTotal = Infinity;
      for (const storeId of candidate.storeIds) {
        const option = options.get(storeId);
        if (option && option.lineTotal < bestTotal) {
          bestTotal = option.lineTotal;
          chosenStoreId = storeId;
          chosenOption = option;
        }
      }
    }

    if (chosenStoreId && chosenOption) {
      const list = breakdown.get(chosenStoreId) ?? [];
      list.push({ item, productId: chosenOption.productId, price: chosenOption.lineTotal });
      breakdown.set(chosenStoreId, list);
    }
  }

  return breakdown;
}
