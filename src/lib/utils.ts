import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Dimensions } from 'react-native';

const { width } = Dimensions.get('window');
export const isTablet = width >= 768;
export const isLargeScreen = width >= 1024;

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Expo Router may pass dynamic segments as `string | string[]` (common on web). */
export function normalizeRouteParam(param: string | string[] | undefined): string | undefined {
  if (param == null) return undefined;
  const value = Array.isArray(param) ? param[0] : param;
  const trimmed = value?.trim();
  return trimmed || undefined;
}
