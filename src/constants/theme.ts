import { Platform } from 'react-native';
import { F7 } from '@/constants/f7';

/** Framework7 iOS theme color — primary actions, links, switches */
const tintColorLight = F7.colors.iosBlue;
const tintColorDark = '#0A84FF';

export interface AppTheme {
  text: string;
  background: string;
  surface: string;
  border: string;
  muted: string;
  mutedForeground: string;
  tint: string;
  icon: string;
  tabIconDefault: string;
  tabIconSelected: string;
  primary: string;
  secondary: string;
  success: string;
  error: string;
  warning: string;
  card: string;
  notification: string;
  skeleton: string;
  skeletonBone: string;
  statusBar: 'light' | 'dark';
}

export const Colors: {
  light: AppTheme;
  dark: AppTheme;
} = {
  light: {
    text: '#000000',
    background: F7.colors.pageBgLight,
    surface: '#FFFFFF',
    border: F7.colors.separatorLight,
    muted: '#C7C7CC',
    mutedForeground: '#8E8E93',
    tint: tintColorLight,
    icon: '#8E8E93',
    tabIconDefault: '#8E8E93',
    tabIconSelected: tintColorLight,
    primary: tintColorLight,
    secondary: '#F2F2F7',
    success: F7.colors.iosGreen,
    error: F7.colors.iosRed,
    warning: '#FF9500',
    card: '#FFFFFF',
    notification: F7.colors.iosRed,
    skeleton: '#E5E5EA',
    skeletonBone: '#D1D1D6',
    statusBar: 'dark',
  },
  dark: {
    text: '#FFFFFF',
    background: '#000000',
    surface: '#121212',
    border: '#2A2A2C',
    muted: '#3A3A3C',
    mutedForeground: '#A1A1AA',
    tint: tintColorDark,
    icon: '#A1A1AA',
    tabIconDefault: '#8E8E93',
    tabIconSelected: tintColorDark,
    primary: tintColorDark,
    secondary: '#1C1C1E',
    success: '#30D158',
    error: '#FF453A',
    warning: '#FFD60A',
    card: '#121212',
    notification: '#FF453A',
    skeleton: '#1C1C1E',
    skeletonBone: '#2C2C2E',
    statusBar: 'light',
  },
};

export const Fonts = Platform.select({
  ios: {
    sans: 'System',
    serif: 'Times New Roman',
    rounded: 'System',
    mono: 'Courier',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
});

export const Typography = {
  /** iOS / F7 navbar title */
  navTitle: {
    fontSize: F7.navbar.titleSize,
    lineHeight: 22,
    fontWeight: '600' as const,
    letterSpacing: -0.41,
  },
  /** Large title (collapsible headers) */
  pageTitle: {
    fontSize: F7.navbar.largeTitleSize,
    lineHeight: 41,
    fontWeight: '700' as const,
    letterSpacing: 0.37,
  },
  /** F7 block-title */
  blockTitle: {
    fontSize: F7.list.blockTitleSize,
    fontWeight: '400' as const,
    letterSpacing: -0.08,
    textTransform: 'uppercase' as const,
  },
  /** List item title */
  listTitle: {
    fontSize: F7.list.titleSize,
    fontWeight: '400' as const,
    letterSpacing: -0.41,
  },
};
