import type {
  Chain,
  Store,
  Category,
  Product,
  TaxCategory,
  TaxRate,
  PriceRecord,
  ShoppingList,
  ShoppingListItem,
  FavoriteProduct,
  UserSettings,
} from '../types';
import { createEntityRepository } from './entityRepository';
import { readSingleton, writeSingleton } from './storage';

export const chainsRepo = createEntityRepository<Chain, 'chainId'>('chains', 'chainId');
export const storesRepo = createEntityRepository<Store, 'storeId'>('stores', 'storeId');
export const categoriesRepo = createEntityRepository<Category, 'categoryId'>('categories', 'categoryId');
export const productsRepo = createEntityRepository<Product, 'productId'>('products', 'productId');
export const taxCategoriesRepo = createEntityRepository<TaxCategory, 'taxCategoryId'>(
  'taxCategories',
  'taxCategoryId',
);
export const taxRatesRepo = createEntityRepository<TaxRate, 'taxRateId'>('taxRates', 'taxRateId');
export const priceRecordsRepo = createEntityRepository<PriceRecord, 'priceRecordId'>(
  'priceRecords',
  'priceRecordId',
);
export const shoppingListsRepo = createEntityRepository<ShoppingList, 'shoppingListId'>(
  'shoppingLists',
  'shoppingListId',
);
export const shoppingListItemsRepo = createEntityRepository<ShoppingListItem, 'shoppingListItemId'>(
  'shoppingListItems',
  'shoppingListItemId',
);
export const favoriteProductsRepo = createEntityRepository<FavoriteProduct, 'favoriteProductId'>(
  'favoriteProducts',
  'favoriteProductId',
);

const USER_SETTINGS_KEY = 'userSettings';

export const defaultUserSettings: UserSettings = {
  fuelEfficiencyKmPerL: null,
  fuelPricePerL: null,
  baseLocation: { name: '', address: '', lat: null, lng: null },
  maxStoresToVisit: 3,
  minSavingsPerExtraStore: 200,
  taxRoundingMethod: 'floor',
};

export const userSettingsRepo = {
  get(): UserSettings {
    const stored = readSingleton<UserSettings>(USER_SETTINGS_KEY);
    return stored ? { ...defaultUserSettings, ...stored } : defaultUserSettings;
  },
  save(settings: UserSettings): void {
    writeSingleton(USER_SETTINGS_KEY, settings);
  },
};
