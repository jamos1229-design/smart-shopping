export type ID = string;

export interface Chain {
  chainId: ID;
  name: string;
  memo: string;
}

export type StoreType = 'super' | 'drugstore' | 'homecenter' | 'discount' | 'other';

export interface Store {
  storeId: ID;
  chainId: ID;
  chainName: string;
  branchName: string;
  displayName: string;
  storeType: StoreType;
  address: string;
  postalCode: string;
  lat: number | null;
  lng: number | null;
  phone: string;
  businessHours: string;
  hasParking: boolean;
  isFavorite: boolean;
  memo: string;
}

export interface Category {
  categoryId: ID;
  name: string;
  memo: string;
}

export type ComparisonUnit =
  | 'per100ml'
  | 'per100g'
  | 'per1kg'
  | 'per1piece'
  | 'per1sheet'
  | 'per1box'
  | 'per1roll';

export interface Product {
  productId: ID;
  categoryId: ID;
  name: string;
  manufacturer: string;
  brand: string;
  volume: number | null;
  volumeUnit: string;
  quantity: number | null;
  spec: string;
  comparisonUnit: ComparisonUnit;
  janCode: string;
  taxCategoryId: ID;
  memo: string;
}

export type TaxCategoryCode = 'standard' | 'reduced' | 'exempt' | 'other';

export interface TaxCategory {
  taxCategoryId: ID;
  code: TaxCategoryCode;
  name: string;
  memo: string;
}

export interface TaxRate {
  taxRateId: ID;
  taxCategoryId: ID;
  name: string;
  rate: number;
  validFrom: string;
  validTo: string | null;
  isActive: boolean;
  memo: string;
}

export type TaxRoundingMethod = 'floor' | 'round' | 'ceil';

export type InputPriceType = 'tax_included' | 'tax_excluded';
export type PriceKind = 'calculated' | 'actual';
export type PriceType = 'regular' | 'sale';

export interface PriceRecord {
  priceRecordId: ID;
  productId: ID;
  storeId: ID;
  inputPrice: number;
  inputPriceType: InputPriceType;
  taxExcludedPrice: number;
  taxAmount: number;
  taxIncludedPrice: number;
  appliedTaxRate: number;
  taxCategoryId: ID;
  actualTaxIncludedPrice: number | null;
  priceKind: PriceKind;
  confirmedDate: string;
  priceType: PriceType;
  saleStartDate: string | null;
  saleEndDate: string | null;
  memo: string;
  createdAt: string;
}

export type ItemSelectionType = 'product' | 'category';

export interface ShoppingList {
  shoppingListId: ID;
  name: string;
  date: string;
  memo: string;
  createdAt: string;
}

export interface ShoppingListItem {
  shoppingListItemId: ID;
  shoppingListId: ID;
  selectionType: ItemSelectionType;
  productId: ID | null;
  categoryId: ID | null;
  quantity: number;
  minVolume: number | null;
  desiredSpec: string;
  memo: string;
  isPurchased: boolean;
}

export interface BaseLocation {
  name: string;
  address: string;
  lat: number | null;
  lng: number | null;
}

export interface UserSettings {
  fuelEfficiencyKmPerL: number | null;
  fuelPricePerL: number | null;
  baseLocation: BaseLocation;
  maxStoresToVisit: number;
  minSavingsPerExtraStore: number;
  taxRoundingMethod: TaxRoundingMethod;
}

export interface FavoriteProduct {
  favoriteProductId: ID;
  productId: ID;
  memo: string;
  addedAt: string;
}
