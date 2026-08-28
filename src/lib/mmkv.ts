import { Platform } from 'react-native';

const isBrowser = typeof window !== 'undefined';

class MMKVStorage {
  private storage: any = null;
  private fallbackMap = new Map<string, string>();
  private useFallback = false;

  constructor() {
    if (Platform.OS !== 'web') {
      try {
        // Dynamically import react-native-mmkv to prevent crashes if native module is absent
        const { createMMKV } = require('react-native-mmkv');
        this.storage = createMMKV({
          id: 'psuscc-app-storage',
        });
      } catch (e) {
        console.warn('MMKV native module not found, falling back to AsyncStorage/In-memory. Error:', e);
        this.useFallback = true;
        // Asynchronously pre-populate the fallback map from AsyncStorage
        try {
          const AsyncStorage = require('@react-native-async-storage/async-storage').default;
          AsyncStorage.getAllKeys()
            .then((keys: string[]) => {
              return AsyncStorage.multiGet(keys);
            })
            .then((stores: [string, string | null][]) => {
              stores.forEach(([key, val]) => {
                if (val !== null) {
                  this.fallbackMap.set(key, val);
                }
              });
            })
            .catch((err: any) => console.warn('Failed to pre-populate MMKV fallback map:', err));
        } catch (err) {
          console.warn('Failed to load AsyncStorage:', err);
        }
      }
    } else {
      this.useFallback = true;
    }
  }

  getString(key: string): string | undefined {
    if (Platform.OS === 'web') {
      if (isBrowser) {
        return localStorage.getItem(key) ?? undefined;
      }
      return undefined;
    }
    if (this.useFallback) {
      return this.fallbackMap.get(key);
    }
    return this.storage?.getString(key);
  }

  set(key: string, value: string | number | boolean): void {
    if (Platform.OS === 'web') {
      if (isBrowser) {
        localStorage.setItem(key, String(value));
      }
      return;
    }
    if (this.useFallback) {
      const strVal = String(value);
      this.fallbackMap.set(key, strVal);
      try {
        const AsyncStorage = require('@react-native-async-storage/async-storage').default;
        void AsyncStorage.setItem(key, strVal);
      } catch (err) {
        console.warn('Failed to set item in AsyncStorage fallback:', err);
      }
      return;
    }
    this.storage?.set(key, value);
  }

  delete(key: string): void {
    if (Platform.OS === 'web') {
      if (isBrowser) {
        localStorage.removeItem(key);
      }
      return;
    }
    if (this.useFallback) {
      this.fallbackMap.delete(key);
      try {
        const AsyncStorage = require('@react-native-async-storage/async-storage').default;
        void AsyncStorage.removeItem(key);
      } catch (err) {
        console.warn('Failed to delete item in AsyncStorage fallback:', err);
      }
      return;
    }
    this.storage?.remove(key);
  }

  clearAll(): void {
    if (Platform.OS === 'web') {
      if (isBrowser) {
        localStorage.clear();
      }
      return;
    }
    if (this.useFallback) {
      this.fallbackMap.clear();
      try {
        const AsyncStorage = require('@react-native-async-storage/async-storage').default;
        void AsyncStorage.clear();
      } catch (err) {
        console.warn('Failed to clear AsyncStorage fallback:', err);
      }
      return;
    }
    this.storage?.clearAll();
  }

  // AsyncStorage compatibility Layer (Async)
  async getItem(key: string): Promise<string | null> {
    if (this.useFallback && Platform.OS !== 'web') {
      try {
        const AsyncStorage = require('@react-native-async-storage/async-storage').default;
        return await AsyncStorage.getItem(key);
      } catch (err) {
        console.warn('Failed to getItem from AsyncStorage fallback:', err);
      }
    }
    const val = this.getString(key);
    return val !== undefined ? val : null;
  }

  async setItem(key: string, value: string): Promise<void> {
    if (this.useFallback && Platform.OS !== 'web') {
      this.fallbackMap.set(key, value);
      try {
        const AsyncStorage = require('@react-native-async-storage/async-storage').default;
        await AsyncStorage.setItem(key, value);
        return;
      } catch (err) {
        console.warn('Failed to setItem in AsyncStorage fallback:', err);
      }
    }
    this.set(key, value);
  }

  async removeItem(key: string): Promise<void> {
    if (this.useFallback && Platform.OS !== 'web') {
      this.fallbackMap.delete(key);
      try {
        const AsyncStorage = require('@react-native-async-storage/async-storage').default;
        await AsyncStorage.removeItem(key);
        return;
      } catch (err) {
        console.warn('Failed to removeItem in AsyncStorage fallback:', err);
      }
    }
    this.delete(key);
  }

  async multiRemove(keys: string[]): Promise<void> {
    if (this.useFallback && Platform.OS !== 'web') {
      keys.forEach((key) => this.fallbackMap.delete(key));
      try {
        const AsyncStorage = require('@react-native-async-storage/async-storage').default;
        await AsyncStorage.multiRemove(keys);
        return;
      } catch (err) {
        console.warn('Failed to multiRemove in AsyncStorage fallback:', err);
      }
    }
    keys.forEach((key) => this.delete(key));
  }
}

export const mmkvStorage = new MMKVStorage();
