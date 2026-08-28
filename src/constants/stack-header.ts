import { Platform } from 'react-native';

/** iOS blur header; solid header on web/Android so list content is visible. */
export function stackTransparentHeader(colorScheme: 'light' | 'dark') {
  const useTransparent = Platform.OS === 'ios';
  return {
    headerTransparent: useTransparent,
    ...(useTransparent
      ? {
          headerBlurEffect:
            colorScheme === 'dark' ? ('systemMaterialDark' as const) : ('systemMaterialLight' as const),
        }
      : {}),
  };
}
