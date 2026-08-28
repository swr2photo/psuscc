import { useMemo } from 'react';
import { getAppleStorePalette } from '@/constants/apple-store-ui';
import { useTheme } from '@/hooks/use-theme';

export function useAppleStorePalette() {
  const { theme, isDark } = useTheme();
  return useMemo(() => getAppleStorePalette(theme, isDark), [theme, isDark]);
}
