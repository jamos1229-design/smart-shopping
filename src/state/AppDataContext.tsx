import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
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
import {
  chainsRepo,
  storesRepo,
  categoriesRepo,
  productsRepo,
  taxCategoriesRepo,
  taxRatesRepo,
  priceRecordsRepo,
  shoppingListsRepo,
  shoppingListItemsRepo,
  favoriteProductsRepo,
  userSettingsRepo,
} from '../repositories/repos';
import { ensureSeedData } from '../repositories/seed';

ensureSeedData();

interface AppDataValue {
  chains: Chain[];
  stores: Store[];
  categories: Category[];
  products: Product[];
  taxCategories: TaxCategory[];
  taxRates: TaxRate[];
  priceRecords: PriceRecord[];
  shoppingLists: ShoppingList[];
  shoppingListItems: ShoppingListItem[];
  favoriteProducts: FavoriteProduct[];
  userSettings: UserSettings;

  saveChain: (chain: Chain) => void;
  removeChain: (chainId: string) => void;
  saveStore: (store: Store) => void;
  removeStore: (storeId: string) => void;
  saveCategory: (category: Category) => void;
  removeCategory: (categoryId: string) => void;
  saveProduct: (product: Product) => void;
  removeProduct: (productId: string) => void;
  saveTaxRate: (rate: TaxRate) => void;
  removeTaxRate: (taxRateId: string) => void;
  savePriceRecord: (record: PriceRecord) => void;
  removePriceRecord: (priceRecordId: string) => void;
  saveShoppingList: (list: ShoppingList) => void;
  removeShoppingList: (shoppingListId: string) => void;
  saveShoppingListItem: (item: ShoppingListItem) => void;
  removeShoppingListItem: (shoppingListItemId: string) => void;
  toggleItemPurchased: (shoppingListItemId: string) => void;
  saveFavoriteProduct: (favorite: FavoriteProduct) => void;
  removeFavoriteProduct: (favoriteProductId: string) => void;
  saveUserSettings: (settings: UserSettings) => void;
}

const AppDataContext = createContext<AppDataValue | null>(null);

export function AppDataProvider({ children }: { children: ReactNode }) {
  const [chains, setChains] = useState<Chain[]>(() => chainsRepo.list());
  const [stores, setStores] = useState<Store[]>(() => storesRepo.list());
  const [categories, setCategories] = useState<Category[]>(() => categoriesRepo.list());
  const [products, setProducts] = useState<Product[]>(() => productsRepo.list());
  const [taxCategories] = useState<TaxCategory[]>(() => taxCategoriesRepo.list());
  const [taxRates, setTaxRates] = useState<TaxRate[]>(() => taxRatesRepo.list());
  const [priceRecords, setPriceRecords] = useState<PriceRecord[]>(() => priceRecordsRepo.list());
  const [shoppingLists, setShoppingLists] = useState<ShoppingList[]>(() => shoppingListsRepo.list());
  const [shoppingListItems, setShoppingListItems] = useState<ShoppingListItem[]>(() =>
    shoppingListItemsRepo.list(),
  );
  const [favoriteProducts, setFavoriteProducts] = useState<FavoriteProduct[]>(() => favoriteProductsRepo.list());
  const [userSettings, setUserSettings] = useState<UserSettings>(() => userSettingsRepo.get());

  const saveChain = useCallback((chain: Chain) => {
    chainsRepo.upsert(chain);
    setChains(chainsRepo.list());
  }, []);
  const removeChain = useCallback((chainId: string) => {
    chainsRepo.remove(chainId);
    setChains(chainsRepo.list());
  }, []);

  const saveStore = useCallback((store: Store) => {
    storesRepo.upsert(store);
    setStores(storesRepo.list());
  }, []);
  const removeStore = useCallback((storeId: string) => {
    storesRepo.remove(storeId);
    setStores(storesRepo.list());
  }, []);

  const saveCategory = useCallback((category: Category) => {
    categoriesRepo.upsert(category);
    setCategories(categoriesRepo.list());
  }, []);
  const removeCategory = useCallback((categoryId: string) => {
    categoriesRepo.remove(categoryId);
    setCategories(categoriesRepo.list());
  }, []);

  const saveProduct = useCallback((product: Product) => {
    productsRepo.upsert(product);
    setProducts(productsRepo.list());
  }, []);
  const removeProduct = useCallback((productId: string) => {
    productsRepo.remove(productId);
    setProducts(productsRepo.list());
  }, []);

  const saveTaxRate = useCallback((rate: TaxRate) => {
    taxRatesRepo.upsert(rate);
    setTaxRates(taxRatesRepo.list());
  }, []);
  const removeTaxRate = useCallback((taxRateId: string) => {
    taxRatesRepo.remove(taxRateId);
    setTaxRates(taxRatesRepo.list());
  }, []);

  const savePriceRecord = useCallback((record: PriceRecord) => {
    priceRecordsRepo.upsert(record);
    setPriceRecords(priceRecordsRepo.list());
  }, []);
  const removePriceRecord = useCallback((priceRecordId: string) => {
    priceRecordsRepo.remove(priceRecordId);
    setPriceRecords(priceRecordsRepo.list());
  }, []);

  const saveShoppingList = useCallback((list: ShoppingList) => {
    shoppingListsRepo.upsert(list);
    setShoppingLists(shoppingListsRepo.list());
  }, []);
  const removeShoppingList = useCallback((shoppingListId: string) => {
    shoppingListsRepo.remove(shoppingListId);
    setShoppingLists(shoppingListsRepo.list());
    const remainingItems = shoppingListItemsRepo.list().filter((item) => item.shoppingListId !== shoppingListId);
    shoppingListItemsRepo.replaceAll(remainingItems);
    setShoppingListItems(remainingItems);
  }, []);

  const saveShoppingListItem = useCallback((item: ShoppingListItem) => {
    shoppingListItemsRepo.upsert(item);
    setShoppingListItems(shoppingListItemsRepo.list());
  }, []);
  const removeShoppingListItem = useCallback((shoppingListItemId: string) => {
    shoppingListItemsRepo.remove(shoppingListItemId);
    setShoppingListItems(shoppingListItemsRepo.list());
  }, []);
  const toggleItemPurchased = useCallback((shoppingListItemId: string) => {
    const item = shoppingListItemsRepo.get(shoppingListItemId);
    if (!item) return;
    shoppingListItemsRepo.upsert({ ...item, isPurchased: !item.isPurchased });
    setShoppingListItems(shoppingListItemsRepo.list());
  }, []);

  const saveFavoriteProduct = useCallback((favorite: FavoriteProduct) => {
    favoriteProductsRepo.upsert(favorite);
    setFavoriteProducts(favoriteProductsRepo.list());
  }, []);
  const removeFavoriteProduct = useCallback((favoriteProductId: string) => {
    favoriteProductsRepo.remove(favoriteProductId);
    setFavoriteProducts(favoriteProductsRepo.list());
  }, []);

  const saveUserSettings = useCallback((settings: UserSettings) => {
    userSettingsRepo.save(settings);
    setUserSettings(settings);
  }, []);

  const value = useMemo<AppDataValue>(
    () => ({
      chains,
      stores,
      categories,
      products,
      taxCategories,
      taxRates,
      priceRecords,
      shoppingLists,
      shoppingListItems,
      favoriteProducts,
      userSettings,
      saveChain,
      removeChain,
      saveStore,
      removeStore,
      saveCategory,
      removeCategory,
      saveProduct,
      removeProduct,
      saveTaxRate,
      removeTaxRate,
      savePriceRecord,
      removePriceRecord,
      saveShoppingList,
      removeShoppingList,
      saveShoppingListItem,
      removeShoppingListItem,
      toggleItemPurchased,
      saveFavoriteProduct,
      removeFavoriteProduct,
      saveUserSettings,
    }),
    [
      chains,
      stores,
      categories,
      products,
      taxCategories,
      taxRates,
      priceRecords,
      shoppingLists,
      shoppingListItems,
      favoriteProducts,
      userSettings,
      saveChain,
      removeChain,
      saveStore,
      removeStore,
      saveCategory,
      removeCategory,
      saveProduct,
      removeProduct,
      saveTaxRate,
      removeTaxRate,
      savePriceRecord,
      removePriceRecord,
      saveShoppingList,
      removeShoppingList,
      saveShoppingListItem,
      removeShoppingListItem,
      toggleItemPurchased,
      saveFavoriteProduct,
      removeFavoriteProduct,
      saveUserSettings,
    ],
  );

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}

export function useAppData(): AppDataValue {
  const ctx = useContext(AppDataContext);
  if (!ctx) throw new Error('useAppData must be used within AppDataProvider');
  return ctx;
}
