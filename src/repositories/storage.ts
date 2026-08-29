const PREFIX = 'smart-shopping:';

function readRaw(key: string): string | null {
  try {
    return window.localStorage.getItem(PREFIX + key);
  } catch {
    return null;
  }
}

function writeRaw(key: string, value: string): void {
  try {
    window.localStorage.setItem(PREFIX + key, value);
  } catch {
    // localStorage unavailable (private mode, quota) — fail silently, data stays in-memory only
  }
}

export interface StorageAdapter<T> {
  getAll(): T[];
  saveAll(items: T[]): void;
}

export function createLocalStorageAdapter<T>(key: string): StorageAdapter<T> {
  return {
    getAll(): T[] {
      const raw = readRaw(key);
      if (!raw) return [];
      try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? (parsed as T[]) : [];
      } catch {
        return [];
      }
    },
    saveAll(items: T[]): void {
      writeRaw(key, JSON.stringify(items));
    },
  };
}

export function readSingleton<T>(key: string): T | null {
  const raw = readRaw(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function writeSingleton<T>(key: string, value: T): void {
  writeRaw(key, JSON.stringify(value));
}
