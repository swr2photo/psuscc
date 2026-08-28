import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const isBrowser = typeof window !== 'undefined';

/**
 * Custom storage adapter for Supabase using expo-secure-store.
 * On iOS, this uses the Keychain with hardware-backed security.
 */
class SecureStorageAdapter {
  async getItem(key: string): Promise<string | null> {
    if (Platform.OS === 'web') {
      if (isBrowser) {
        return localStorage.getItem(key);
      }
      return null;
    }
    
    try {
      return await SecureStore.getItemAsync(key);
    } catch (error) {
      console.error('SecureStore getItem error:', error);
      return null;
    }
  }

  async setItem(key: string, value: string): Promise<void> {
    if (Platform.OS === 'web') {
      if (isBrowser) {
        localStorage.setItem(key, value);
      }
      return;
    }

    try {
      await SecureStore.setItemAsync(key, value, {
        keychainAccessible: SecureStore.WHEN_PASSCODE_SET_THIS_DEVICE_ONLY,
      });
    } catch (error) {
      console.error('SecureStore setItem error:', error);
    }
  }

  async removeItem(key: string): Promise<void> {
    if (Platform.OS === 'web') {
      if (isBrowser) {
        localStorage.removeItem(key);
      }
      return;
    }

    try {
      await SecureStore.deleteItemAsync(key);
    } catch (error) {
      console.error('SecureStore removeItem error:', error);
    }
  }
}

export const secureStorage = new SecureStorageAdapter();

/**
 * Enhanced secure read/write for sensitive data (e.g., encryption keys)
 * that REQUIRE a biometric scan before every access on iOS.
 */
export const highSecurityStore = {
  async setSensitiveItem(key: string, value: string, promptMessage: string) {
    if (Platform.OS !== 'ios') {
      return await secureStorage.setItem(key, value);
    }
    
    return await SecureStore.setItemAsync(key, value, {
      requireAuthentication: true,
      authenticationPrompt: promptMessage,
      keychainAccessible: SecureStore.WHEN_PASSCODE_SET_THIS_DEVICE_ONLY,
    });
  },

  async getSensitiveItem(key: string, promptMessage: string) {
    if (Platform.OS !== 'ios') {
      return await secureStorage.getItem(key);
    }

    return await SecureStore.getItemAsync(key, {
      requireAuthentication: true,
      authenticationPrompt: promptMessage,
    });
  }
};
