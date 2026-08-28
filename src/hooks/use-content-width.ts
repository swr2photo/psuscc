import { Platform, useWindowDimensions } from 'react-native';
import { WEB_APP_MAX_WIDTH } from '@/constants/layout';

/** Usable content width inside the centered web shell (max 480px). */
export function useContentWidth() {
  const { width } = useWindowDimensions();
  if (Platform.OS === 'web') {
    return Math.min(width, WEB_APP_MAX_WIDTH);
  }
  return width;
}
