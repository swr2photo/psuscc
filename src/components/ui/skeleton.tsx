import { useTheme } from '@/hooks/use-theme';
import React, { useEffect } from 'react';
import type { DimensionValue, StyleProp, ViewProps, ViewStyle } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

export type SkeletonTone = 'default' | 'muted';

export type SkeletonProps = ViewProps & {
  width?: DimensionValue;
  height?: number;
  borderRadius?: number;
  tone?: SkeletonTone;
  style?: StyleProp<ViewStyle>;
};

/**
 * Cross-platform loading placeholder (iOS / Android / web).
 * Pulse opacity — avoids native blur/driver issues across Hermes + web.
 */
export function Skeleton({
  width = '100%',
  height = 14,
  borderRadius = 8,
  tone = 'default',
  style,
  accessibilityLabel = 'กำลังโหลด',
  ...rest
}: SkeletonProps) {
  const { theme } = useTheme();
  const pulse = useSharedValue(0);

  useEffect(() => {
    pulse.value = withRepeat(
      withTiming(1, { duration: 880, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, [pulse]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(pulse.value, [0, 1], [0.42, 0.88]),
  }));

  const bg =
    tone === 'muted' ? theme.skeletonBone : theme.skeleton;

  return (
    <Animated.View
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      importantForAccessibility="yes"
      {...rest}
      style={[
        {
          width,
          height,
          borderRadius,
          backgroundColor: bg,
          overflow: 'hidden',
        },
        animatedStyle,
        style,
      ]}
    />
  );
}

export function SkeletonCircle({
  size,
  tone,
  style,
  ...rest
}: Omit<SkeletonProps, 'width' | 'height' | 'borderRadius'> & { size: number }) {
  return (
    <Skeleton
      width={size}
      height={size}
      borderRadius={size / 2}
      tone={tone}
      style={style}
      {...rest}
    />
  );
}

export function SkeletonLine({
  width = '100%',
  last = false,
}: {
  width?: DimensionValue;
  last?: boolean;
}) {
  return (
    <Skeleton
      height={last ? 12 : 14}
      borderRadius={7}
      width={width}
      tone={last ? 'muted' : 'default'}
    />
  );
}
