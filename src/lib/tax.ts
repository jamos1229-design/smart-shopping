import type { InputPriceType, PriceKind, PriceRecord, TaxCategory, TaxRate, TaxRoundingMethod } from '../types';

export function applyRounding(value: number, method: TaxRoundingMethod): number {
  switch (method) {
    case 'round':
      return Math.round(value);
    case 'ceil':
      return Math.ceil(value);
    case 'floor':
    default:
      return Math.floor(value);
  }
}

export function findApplicableTaxRate(
  taxRates: TaxRate[],
  taxCategoryId: string,
  onDate: string,
): TaxRate | undefined {
  const candidates = taxRates.filter(
    (rate) =>
      rate.taxCategoryId === taxCategoryId &&
      rate.isActive &&
      rate.validFrom <= onDate &&
      (rate.validTo === null || rate.validTo >= onDate),
  );
  if (candidates.length === 0) return undefined;
  return candidates.sort((a, b) => (a.validFrom < b.validFrom ? 1 : -1))[0];
}

export interface PriceCalculationInput {
  inputPrice: number;
  inputPriceType: InputPriceType;
  taxCategoryId: string;
  confirmedDate: string;
  actualTaxIncludedPrice: number | null;
  taxRates: TaxRate[];
  roundingMethod: TaxRoundingMethod;
}

export interface PriceCalculationResult {
  taxExcludedPrice: number;
  taxIncludedPrice: number;
  taxAmount: number;
  appliedTaxRate: number;
  priceKind: PriceKind;
}

export function calculatePriceBreakdown(input: PriceCalculationInput): PriceCalculationResult {
  const rate = findApplicableTaxRate(input.taxRates, input.taxCategoryId, input.confirmedDate);
  const appliedTaxRate = rate ? rate.rate : 0;

  let taxExcludedPrice: number;
  let taxIncludedPrice: number;

  if (input.inputPriceType === 'tax_excluded') {
    taxExcludedPrice = input.inputPrice;
    taxIncludedPrice = applyRounding(input.inputPrice * (1 + appliedTaxRate), input.roundingMethod);
  } else {
    taxIncludedPrice = input.inputPrice;
    taxExcludedPrice = applyRounding(input.inputPrice / (1 + appliedTaxRate), input.roundingMethod);
  }

  const priceKind: PriceKind = input.actualTaxIncludedPrice !== null ? 'actual' : 'calculated';

  return {
    taxExcludedPrice,
    taxIncludedPrice,
    taxAmount: taxIncludedPrice - taxExcludedPrice,
    appliedTaxRate,
    priceKind,
  };
}

export function effectiveTaxIncludedPrice(record: PriceRecord): number {
  return record.actualTaxIncludedPrice ?? record.taxIncludedPrice;
}

export function isSaleActiveOn(record: PriceRecord, onDate: string): boolean {
  if (record.priceType !== 'sale') return false;
  if (record.saleStartDate && record.saleStartDate > onDate) return false;
  if (record.saleEndDate && record.saleEndDate < onDate) return false;
  return true;
}

// カテゴリー名からの初期税区分の推測（あくまで初期値の提案。常に手動で変更可能）。
// 軽減税率の対象は「飲食料品（酒類・外食を除く）」のみ。酒類・日用品・医薬品などは標準税率。
const ALCOHOL_KEYWORDS = [
  '酒', 'ビール', '発泡酒', 'チューハイ', '酎ハイ', 'サワー', 'ハイボール', 'ワイン', '日本酒',
  '焼酎', 'ウイスキー', 'ウィスキー', 'ウオッカ', 'ウォッカ', 'ジン', 'ラム', 'ブランデー',
  'リキュール', 'スピリッツ', 'カクテル', '梅酒', 'どぶろく', '清酒', 'みりん',
];
const NON_FOOD_KEYWORDS = [
  '洗剤', '柔軟剤', '漂白剤', '日用品', '雑貨', 'トイレタリー', '文具', '文房具', '衣料', '衣類',
  '家電', '電化製品', '医薬品', '薬', '化粧品', 'コスメ', 'タバコ', 'たばこ', '煙草', '雑誌',
  '書籍', 'おもちゃ', '玩具', 'ペット', 'キッチン用品', '台所用品', '掃除', '清掃', 'ティッシュ',
  'トイレットペーパー', 'シャンプー', 'リンス', '歯磨き', '歯ブラシ', '芳香剤', '文具',
];

/** カテゴリー名から軽減税率('reduced')/標準税率('standard')の初期提案を返す（酒類・日用品は標準） */
export function suggestTaxCategoryCode(categoryName: string): 'standard' | 'reduced' {
  const name = categoryName.trim();
  if (ALCOHOL_KEYWORDS.some((k) => name.includes(k))) return 'standard';
  if (NON_FOOD_KEYWORDS.some((k) => name.includes(k))) return 'standard';
  return 'reduced';
}

/** カテゴリー名から、現在の税区分マスターの中で対応するtaxCategoryIdを提案する */
export function suggestTaxCategoryId(categoryName: string, taxCategories: TaxCategory[]): string {
  const code = suggestTaxCategoryCode(categoryName);
  return (
    taxCategories.find((t) => t.code === code)?.taxCategoryId ??
    taxCategories.find((t) => t.code === 'standard')?.taxCategoryId ??
    taxCategories[0]?.taxCategoryId ??
    ''
  );
}

export interface ActiveRateOption {
  taxCategoryId: string;
  taxCategoryCode: TaxCategory['code'];
  rate: number;
}

/**
 * 指定日時点で有効な税率を、税区分ごとに一覧にする（価格登録画面の「8%／10%」選択ボタン用）。
 * 同じ税率のタブ区分が複数ある場合は、standard/reducedを優先して代表させる。
 */
export function listActiveRateOptions(
  taxCategories: TaxCategory[],
  taxRates: TaxRate[],
  onDate: string,
): ActiveRateOption[] {
  const byRate = new Map<number, ActiveRateOption>();
  const priority: Record<TaxCategory['code'], number> = { reduced: 0, standard: 1, exempt: 2, other: 3 };
  for (const category of taxCategories) {
    const rate = findApplicableTaxRate(taxRates, category.taxCategoryId, onDate);
    if (!rate) continue;
    const existing = byRate.get(rate.rate);
    if (!existing || priority[category.code] < priority[existing.taxCategoryCode]) {
      byRate.set(rate.rate, { taxCategoryId: category.taxCategoryId, taxCategoryCode: category.code, rate: rate.rate });
    }
  }
  return [...byRate.values()].sort((a, b) => a.rate - b.rate);
}
