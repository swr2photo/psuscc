import type { AppTheme } from '@/hooks/use-theme';

export const AppleStoreLayout = {
  radiusLg: 22,
  radiusMd: 16,
  radiusSm: 12,
  sectionTitleSize: 28,
  hPad: 20,
} as const;

export type AppleStorePalette = {
  background: string;
  card: string;
  cardHover: string;
  chip: string;
  chipActive: string;
  chipText: string;
  chipTextActive: string;
  chipBorderActive: string;
  text: string;
  textSecondary: string;
  link: string;
  statusBar: 'light' | 'dark';
  discoverGradient: readonly [string, string, string];
};

export function getAppleStorePalette(theme: AppTheme, isDark: boolean): AppleStorePalette {
  return {
    background: theme.background,
    card: theme.surface,
    cardHover: theme.secondary,
    chip: theme.secondary,
    chipActive: isDark ? '#3A3A3C' : theme.text,
    chipText: theme.text,
    chipTextActive: isDark ? '#FFFFFF' : theme.background,
    chipBorderActive: isDark ? 'rgba(255,255,255,0.22)' : 'rgba(0,0,0,0.08)',
    text: theme.text,
    textSecondary: theme.mutedForeground,
    link: theme.primary,
    statusBar: isDark ? 'light' : 'dark',
    discoverGradient: isDark ?
      ['transparent', 'rgba(0,0,0,0.35)', 'rgba(0,0,0,0.78)']
    : ['transparent', 'rgba(0,0,0,0.12)', 'rgba(0,0,0,0.55)'],
  };
}
