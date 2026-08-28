import { useMemo, useRef } from 'react';
import { Animated, Easing } from 'react-native';

/**
 * Collapsible header helper:
 * - While user is actively scrolling (dragging / momentum), header hides.
 * - When scrolling stops, header animates back to visible.
 *
 * Works with Animated.ScrollView / Animated.FlatList via:
 * onScroll, onScrollBeginDrag, onScrollEndDrag, onMomentumScrollBegin, onMomentumScrollEnd.
 */
export function useCollapsibleHeader(headerHeight: number) {
  // 0 = shown, 1 = hidden
  const hidden = useRef(new Animated.Value(0)).current;
  const isMomentum = useRef(false);

  const animateTo = (toValue: 0 | 1) => {
    Animated.timing(hidden, {
      toValue,
      duration: toValue === 1 ? 160 : 220,
      easing: toValue === 1 ? Easing.out(Easing.cubic) : Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  };

  const translateY = useMemo(
    () =>
      hidden.interpolate({
        inputRange: [0, 1],
        outputRange: [0, -Math.max(0, headerHeight)],
        extrapolate: 'clamp',
      }),
    [headerHeight, hidden]
  );

  const opacity = useMemo(
    () =>
      hidden.interpolate({
        inputRange: [0, 1],
        outputRange: [1, 0],
        extrapolate: 'clamp',
      }),
    [hidden]
  );

  const onScroll = useMemo(() => () => {}, []);

  return {
    onScroll,
    onScrollBeginDrag: () => {
      animateTo(1);
    },
    onScrollEndDrag: () => {
      // If momentum continues, wait for momentum end
      if (!isMomentum.current) animateTo(0);
    },
    onMomentumScrollBegin: () => {
      isMomentum.current = true;
      animateTo(1);
    },
    onMomentumScrollEnd: () => {
      isMomentum.current = false;
      animateTo(0);
    },
    headerAnimatedStyle: {
      transform: [{ translateY }],
      opacity,
    } as const,
  };
}

