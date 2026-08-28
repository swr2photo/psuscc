import { usePathname } from 'expo-router';
import { StatusBar, StatusBarStyle } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { useEffect, useMemo } from 'react';
import { Platform } from 'react-native';

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

interface AppStatusBarProps {
  backgroundColor?: string;
  style?: StatusBarStyle;
  translucent?: boolean;
}

const LIGHT_ROUTES = ['/', '/signup', '/complete-profile'];

export function AppStatusBar({ backgroundColor, style, translucent = true }: AppStatusBarProps) {
  const pathname = usePathname();
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];

  const statusBarStyle = useMemo<StatusBarStyle>(() => {
    if (style) return style;
    if (LIGHT_ROUTES.includes(pathname)) return 'dark';
    return colorScheme === 'dark' ? 'light' : 'dark';
  }, [colorScheme, pathname, style]);

  const resolvedBackground = backgroundColor || theme.background;

  useEffect(() => {
    if (Platform.OS !== 'web') {
      SystemUI.setBackgroundColorAsync(resolvedBackground).catch(() => {});
    }
  }, [resolvedBackground]);

  return (
    <StatusBar
      animated
      style={statusBarStyle}
      translucent={translucent}
      backgroundColor={resolvedBackground}
    />
  );
}
