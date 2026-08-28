import { Platform } from 'react-native';

/** Web is used as a public marketing / browse surface before sign-in. */
export function isWebPlatform() {
  return Platform.OS === 'web';
}
