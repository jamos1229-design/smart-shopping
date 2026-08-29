import type { TaxCategory, TaxRate } from '../types';
import { taxCategoriesRepo, taxRatesRepo } from './repos';
import { generateId } from '../lib/id';

export function ensureSeedData(): void {
  if (taxCategoriesRepo.list().length === 0) {
    const categories: TaxCategory[] = [
      { taxCategoryId: 'tc-standard', code: 'standard', name: '標準税率対象', memo: '' },
      { taxCategoryId: 'tc-reduced', code: 'reduced', name: '軽減税率対象', memo: '飲食料品など' },
      { taxCategoryId: 'tc-exempt', code: 'exempt', name: '非課税', memo: '' },
      { taxCategoryId: 'tc-other', code: 'other', name: 'その他', memo: '' },
    ];
    categories.forEach((c) => taxCategoriesRepo.upsert(c));
  }

  if (taxRatesRepo.list().length === 0) {
    const rates: TaxRate[] = [
      {
        taxRateId: generateId(),
        taxCategoryId: 'tc-standard',
        name: '標準税率',
        rate: 0.1,
        validFrom: '2019-10-01',
        validTo: null,
        isActive: true,
        memo: '',
      },
      {
        taxRateId: generateId(),
        taxCategoryId: 'tc-reduced',
        name: '軽減税率',
        rate: 0.08,
        validFrom: '2019-10-01',
        validTo: null,
        isActive: true,
        memo: '',
      },
      {
        taxRateId: generateId(),
        taxCategoryId: 'tc-exempt',
        name: '非課税',
        rate: 0,
        validFrom: '2019-10-01',
        validTo: null,
        isActive: true,
        memo: '',
      },
      {
        taxRateId: generateId(),
        taxCategoryId: 'tc-other',
        name: 'その他',
        rate: 0,
        validFrom: '2019-10-01',
        validTo: null,
        isActive: true,
        memo: '',
      },
    ];
    rates.forEach((r) => taxRatesRepo.upsert(r));
  }
}
