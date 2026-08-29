import type { InputPriceType, PriceKind, PriceRecord, TaxRate, TaxRoundingMethod } from '../types';

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
