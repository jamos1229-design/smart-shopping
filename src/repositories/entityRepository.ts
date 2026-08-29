import { createLocalStorageAdapter, type StorageAdapter } from './storage';

export interface EntityRepository<T, K extends keyof T> {
  list(): T[];
  get(id: T[K]): T | undefined;
  upsert(item: T): T;
  remove(id: T[K]): void;
  replaceAll(items: T[]): void;
}

export function createEntityRepository<T, K extends keyof T>(
  storageKey: string,
  idField: K,
  adapter: StorageAdapter<T> = createLocalStorageAdapter<T>(storageKey),
): EntityRepository<T, K> {
  return {
    list(): T[] {
      return adapter.getAll();
    },
    get(id: T[K]): T | undefined {
      return adapter.getAll().find((item) => item[idField] === id);
    },
    upsert(item: T): T {
      const items = adapter.getAll();
      const index = items.findIndex((existing) => existing[idField] === item[idField]);
      if (index >= 0) {
        items[index] = item;
      } else {
        items.push(item);
      }
      adapter.saveAll(items);
      return item;
    },
    remove(id: T[K]): void {
      const items = adapter.getAll().filter((item) => item[idField] !== id);
      adapter.saveAll(items);
    },
    replaceAll(items: T[]): void {
      adapter.saveAll(items);
    },
  };
}
