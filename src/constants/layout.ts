import { Platform, type ViewStyle } from 'react-native';

/** Centered mobile shell width on web (`_layout` webContainer). */
export const WEB_APP_MAX_WIDTH = 480;

export const Layout = {
  /** Height of the top navigation bar content (excluding safe-area inset). */
  topBarHeight: 56,
  /** Horizontal padding used by top bars across screens. */
  topBarHorizontalPadding: 22,
};

/** Flex child that can shrink inside navigators (fixes zero-height scroll areas on web). */
export const flexFill: ViewStyle = {
  flex: 1,
  minHeight: 0,
};

export const stackScreenContentStyle: ViewStyle = {
  flex: 1,
};

export const tabSceneContainerStyle: ViewStyle = {
  flex: 1,
  minHeight: 0,
};

/** Root wrapper for stack screens (pair with ScreenScroll). */
export const screenRoot: ViewStyle = {
  ...flexFill,
};
