import { findApplicableTaxRate, calculatePriceBreakdown, applyRounding } from '../src/lib/tax';
import {
  resolveItemOptions,
  computeSingleStoreOptions,
  computeBestStorePairs,
  computeUnlimitedOption,
  summarizeOptimization,
} from '../src/lib/optimize';
import type { TaxRate, PriceRecord, Product, Store, ShoppingListItem, UserSettings } from '../src/types';

let failures = 0;
function check(name: string, condition: boolean, detail?: unknown) {
  if (condition) {
    console.log(`OK   ${name}`);
  } else {
    failures++;
    console.log(`FAIL ${name}`, detail ?? '');
  }
}

// --- Tax rate master: rate changeover across a date boundary ---
const taxRates: TaxRate[] = [
  {
    taxRateId: 'r10',
    taxCategoryId: 'tc-standard',
    name: '標準税率(旧)',
    rate: 0.1,
    validFrom: '2020-01-01',
    validTo: '2026-12-31',
    isActive: true,
    memo: '',
  },
  {
    taxRateId: 'r12',
    taxCategoryId: 'tc-standard',
    name: '標準税率(新)',
    rate: 0.12,
    validFrom: '2027-01-01',
    validTo: null,
    isActive: true,
    memo: '',
  },
];

const rateBefore = findApplicableTaxRate(taxRates, 'tc-standard', '2026-12-20');
check('rate lookup on 2026-12-20 resolves 10%', rateBefore?.rate === 0.1, rateBefore);

const rateAfter = findApplicableTaxRate(taxRates, 'tc-standard', '2027-01-05');
check('rate lookup on 2027-01-05 resolves 12%', rateAfter?.rate === 0.12, rateAfter);

// price recorded under the old rate, snapshotted — must not shift when master changes later
const oldRecordCalc = calculatePriceBreakdown({
  inputPrice: 300,
  inputPriceType: 'tax_excluded',
  taxCategoryId: 'tc-standard',
  confirmedDate: '2026-12-20',
  actualTaxIncludedPrice: null,
  taxRates,
  roundingMethod: 'floor',
});
check('2026 record uses 10% -> taxIncluded 330', oldRecordCalc.taxIncludedPrice === 330, oldRecordCalc);

// simulate adding a NEW tax rate row (e.g. 2028 15%) — must not retroactively change the stored 2026 record
const taxRatesAfterFutureChange: TaxRate[] = [
  ...taxRates,
  {
    taxRateId: 'r15',
    taxCategoryId: 'tc-standard',
    name: '標準税率(将来)',
    rate: 0.15,
    validFrom: '2028-01-01',
    validTo: null,
    isActive: true,
    memo: '',
  },
];
const recheck = calculatePriceBreakdown({
  inputPrice: 300,
  inputPriceType: 'tax_excluded',
  taxCategoryId: 'tc-standard',
  confirmedDate: '2026-12-20',
  actualTaxIncludedPrice: null,
  taxRates: taxRatesAfterFutureChange,
  roundingMethod: 'floor',
});
check(
  'past record (2026) stays at 330 even after tax master gains a future 2028 rate',
  recheck.taxIncludedPrice === 330,
  recheck,
);
check(
  'stored PriceRecord field values are immutable snapshots (simulated: oldRecordCalc unchanged)',
  oldRecordCalc.taxIncludedPrice === 330 && oldRecordCalc.appliedTaxRate === 0.1,
);

const newRecordCalc = calculatePriceBreakdown({
  inputPrice: 300,
  inputPriceType: 'tax_excluded',
  taxCategoryId: 'tc-standard',
  confirmedDate: '2027-01-05',
  actualTaxIncludedPrice: null,
  taxRates,
  roundingMethod: 'floor',
});
check('2027 record uses 12% -> taxIncluded 336', newRecordCalc.taxIncludedPrice === 336, newRecordCalc);

// --- tax-included vs tax-excluded input, both directions ---
const fromIncluded = calculatePriceBreakdown({
  inputPrice: 198,
  inputPriceType: 'tax_included',
  taxCategoryId: 'tc-reduced-test',
  confirmedDate: '2025-01-01',
  actualTaxIncludedPrice: null,
  taxRates: [
    {
      taxRateId: 'reduced',
      taxCategoryId: 'tc-reduced-test',
      name: '軽減税率',
      rate: 0.08,
      validFrom: '2019-10-01',
      validTo: null,
      isActive: true,
      memo: '',
    },
  ],
  roundingMethod: 'floor',
});
check(
  'tax-included input 198 @ 8% -> excluded 183 (floor)',
  fromIncluded.taxExcludedPrice === Math.floor(198 / 1.08),
  fromIncluded,
);

// --- rounding methods ---
check('applyRounding floor(10.9)=10', applyRounding(10.9, 'floor') === 10);
check('applyRounding round(10.5)=11', applyRounding(10.5, 'round') === 11);
check('applyRounding ceil(10.1)=11', applyRounding(10.1, 'ceil') === 11);

// --- Optimization engine: recreate the spec's worked example ---
const stores: Store[] = ['sunny', 'cosmos', 'lumiere'].map((id) => ({
  storeId: id,
  chainId: id,
  chainName: id,
  branchName: '店',
  displayName: `${id}店`,
  storeType: 'super',
  address: '',
  postalCode: '',
  lat: null,
  lng: null,
  phone: '',
  businessHours: '',
  hasParking: false,
  isFavorite: false,
  memo: '',
}));

const products: Product[] = [
  {
    productId: 'milk',
    categoryId: 'cat-milk',
    name: 'テスト牛乳',
    manufacturer: '',
    brand: '',
    volume: 1000,
    volumeUnit: 'ml',
    quantity: 1,
    spec: '',
    comparisonUnit: 'per100ml',
    janCode: '',
    taxCategoryId: 'tc-reduced',
    memo: '',
  },
  {
    productId: 'detergent',
    categoryId: 'cat-detergent',
    name: 'テスト洗剤',
    manufacturer: '',
    brand: '',
    volume: null,
    volumeUnit: '',
    quantity: 1,
    spec: '',
    comparisonUnit: 'per1piece',
    janCode: '',
    taxCategoryId: 'tc-standard',
    memo: '',
  },
];

function pr(id: string, productId: string, storeId: string, taxIncluded: number): PriceRecord {
  return {
    priceRecordId: id,
    productId,
    storeId,
    inputPrice: taxIncluded,
    inputPriceType: 'tax_included',
    taxExcludedPrice: 0,
    taxAmount: 0,
    taxIncludedPrice: taxIncluded,
    appliedTaxRate: 0.08,
    taxCategoryId: 'tc-reduced',
    actualTaxIncludedPrice: null,
    priceKind: 'calculated',
    confirmedDate: '2026-06-01',
    priceType: 'regular',
    saleStartDate: null,
    saleEndDate: null,
    memo: '',
    createdAt: '',
  };
}

const priceRecords: PriceRecord[] = [
  pr('p1', 'milk', 'sunny', 198),
  pr('p2', 'milk', 'cosmos', 178),
  pr('p3', 'milk', 'lumiere', 168),
  pr('p4', 'detergent', 'sunny', 498),
  pr('p5', 'detergent', 'cosmos', 448),
];

const items: ShoppingListItem[] = [
  {
    shoppingListItemId: 'i1',
    shoppingListId: 'l1',
    selectionType: 'product',
    productId: 'milk',
    categoryId: null,
    quantity: 1,
    minVolume: null,
    desiredSpec: '',
    memo: '',
    isPurchased: false,
  },
  {
    shoppingListItemId: 'i2',
    shoppingListId: 'l1',
    selectionType: 'product',
    productId: 'detergent',
    categoryId: null,
    quantity: 1,
    minVolume: null,
    desiredSpec: '',
    memo: '',
    isPurchased: false,
  },
];

const options = resolveItemOptions(items, products, priceRecords, stores);
check('item options resolved for both items', options.size === 2);

const singleResults = computeSingleStoreOptions(items, options, stores);
check(
  'single-store: only sunny and cosmos cover both items (lumiere has no detergent)',
  singleResults.every((r) => r.storeId !== 'lumiere'),
  singleResults,
);
check('single-store best is cosmos at 178+448=626', singleResults[0]?.total === 626, singleResults);

const pairResults = computeBestStorePairs(items, options, stores);
const bestPair = pairResults[0];
check(
  'best pair uses lumiere(milk 168) + cosmos(detergent 448) = 616',
  bestPair?.total === 616,
  bestPair,
);

const unlimited = computeUnlimitedOption(items, options);
check('unlimited total matches best pair (only 2 stores needed) = 616', unlimited.total === 616, unlimited);
check('unlimited fully covers both items', unlimited.uncoveredItemIds.length === 0);

const settings: UserSettings = {
  fuelEfficiencyKmPerL: null,
  fuelPricePerL: null,
  baseLocation: { name: '', address: '', lat: null, lng: null },
  maxStoresToVisit: 3,
  minSavingsPerExtraStore: 50,
  taxRoundingMethod: 'floor',
};
const summary = summarizeOptimization(items, options, stores, settings);
check(
  'recommendation picks the 2-store pair (626 -> 616 saves 10, below... wait threshold 50 means NOT worth it, single wins)',
  summary.recommendation?.kind === 'single',
  summary.recommendation,
);

const settingsLowThreshold: UserSettings = { ...settings, minSavingsPerExtraStore: 5 };
const summaryLowThreshold = summarizeOptimization(items, options, stores, settingsLowThreshold);
check(
  'with a low savings threshold (5円), recommendation switches to the 2-store pair',
  summaryLowThreshold.recommendation?.kind === 'pair',
  summaryLowThreshold.recommendation,
);

console.log(`\n${failures === 0 ? 'ALL TESTS PASSED' : `${failures} TEST(S) FAILED`}`);
process.exit(failures === 0 ? 0 : 1);
