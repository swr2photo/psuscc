import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Dimensions, TouchableWithoutFeedback, Modal } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  runOnJS,
  interpolate,
  Extrapolate,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface ActionSheetProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  maxHeight?: number;
  showHandle?: boolean;
}

export const ActionSheet = ({
  visible,
  onClose,
  title,
  children,
  maxHeight = SCREEN_HEIGHT * 0.9,
  showHandle = true,
}: ActionSheetProps) => {
  const insets = useSafeAreaInsets();
  const translateY = useSharedValue(SCREEN_HEIGHT);
  const context = useSharedValue({ y: 0 });

  // Use React state to handle physical mounting/unmounting
  // This avoids reading shared value during render
  const [shouldRender, setShouldRender] = useState(visible);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const closeSheet = (notifyParent = true) => {
    'worklet';
    translateY.value = withTiming(SCREEN_HEIGHT, { duration: 220 }, (finished) => {
      // Reanimated callbacks can sometimes fail to fire (or report finished=false) on certain
      // devices / transitions. We still need to unmount so the transparent backdrop doesn't
      // swallow touches.
      if (notifyParent) runOnJS(onClose)();
      if (finished) runOnJS(setShouldRender)(false);
    });
  };

  const openSheet = () => {
    'worklet';
    translateY.value = withTiming(0, { duration: 260 });
  };

  useEffect(() => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }

    if (visible) {
      setShouldRender(true);
      translateY.value = SCREEN_HEIGHT;
      translateY.value = withTiming(0, { duration: 260 });
      return;
    }

    translateY.value = withTiming(SCREEN_HEIGHT, { duration: 220 }, (finished) => {
      if (finished) runOnJS(setShouldRender)(false);
    });

    // JS fallback: ensure we always unmount after the close animation duration.
    closeTimerRef.current = setTimeout(() => {
      setShouldRender(false);
    }, 260);

    return () => {
      if (closeTimerRef.current) {
        clearTimeout(closeTimerRef.current);
        closeTimerRef.current = null;
      }
    };
  }, [visible, translateY]);

  const gesture = Gesture.Pan()
    .onStart(() => {
      context.value = { y: translateY.value };
    })
    .onUpdate((event) => {
      translateY.value = Math.max(0, event.translationY + context.value.y);
    })
    .onEnd((event) => {
      if (event.translationY > 100 || event.velocityY > 500) {
        closeSheet();
      } else {
        openSheet();
      }
    });

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateY: translateY.value }],
    };
  });

  const backdropStyle = useAnimatedStyle(() => {
    return {
      opacity: interpolate(translateY.value, [0, SCREEN_HEIGHT], [1, 0], Extrapolate.CLAMP),
    };
  });

  const handleClose = () => {
    closeSheet(true);
  };

  if (!shouldRender) return null;

  return (
    <Modal visible={shouldRender} transparent animationType="none" onRequestClose={handleClose}>
      <View style={styles.container}>
        <TouchableWithoutFeedback onPress={handleClose}>
          <Animated.View style={[styles.backdrop, backdropStyle]} />
        </TouchableWithoutFeedback>
        <Animated.View
          style={[
            styles.sheet,
            animatedStyle,
            {
              height: maxHeight,
              maxHeight,
              paddingBottom: insets.bottom + 20,
            },
          ]}
        >
          <GestureDetector gesture={gesture}>
            <View>
              {showHandle && (
                <View style={styles.handleContainer}>
                  <View style={styles.handle} />
                </View>
              )}
              {title && (
                <View style={styles.header}>
                  <Text style={styles.title}>{title}</Text>
                </View>
              )}
            </View>
          </GestureDetector>
          <View style={styles.content}>{children}</View>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
  },
  sheet: {
    backgroundColor: 'white',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -4,
    },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 20,
  },
  handleContainer: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: '#E2E8F0',
    borderRadius: 2,
  },
  header: {
    paddingHorizontal: 24,
    paddingBottom: 16,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
  },
  content: {
    flex: 1,
    minHeight: 1,
  },
});
