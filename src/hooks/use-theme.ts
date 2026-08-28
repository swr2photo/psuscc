import { Colors, type AppTheme } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export { type AppTheme };

export function useTheme(): { theme: AppTheme; isDark: boolean; scheme: 'light' | 'dark' } {
  const scheme = (useColorScheme() ?? 'light') as 'light' | 'dark';
  return {
    theme: Colors[scheme],
    isDark: scheme === 'dark',
    scheme,
  };
}
