import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Image,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  runOnJS,
  interpolate,
  Extrapolation,
  cancelAnimation,
  useAnimatedReaction,
  type SharedValue,
} from 'react-native-reanimated';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useVideoPlayer, VideoView } from 'expo-video';
import { X } from 'lucide-react-native';
import { useHomeStories } from '@/features/home/api/useHomeFeed';
import { groupStoriesByUser } from '@/features/home/api/useHomeFeed';
import { useRecordStoryView } from '@/features/home/api/useStoryEngagement';
import type { HomeStory } from '@/features/home/types';
import { HomeStoryViewerChrome } from '@/components/home/HomeStoryViewerChrome';
import { normalizeRouteParam } from '@/lib/utils';
import { goBackOrReplace } from '@/lib/goBack';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/hooks/use-theme';

function StoryVideoSlide({
  uri,
  width,
  height,
  onFinish,
  isActive,
  isPausedShared,
}: {
  uri: string;
  width: number;
  height: number;
  onFinish: () => void;
  isActive: boolean;
  isPausedShared: SharedValue<boolean>;
}) {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = false;
  });

  useAnimatedReaction(
    () => isPausedShared.value,
    (paused) => {
      if (isActive) {
        if (paused) runOnJS(player.pause)();
        else runOnJS(player.play)();
      }
    },
    [isActive, player]
  );

  useEffect(() => {
    if (isActive) {
      player.play();
    } else {
      player.pause();
      player.seekBy(0 - player.currentTime);
    }
  }, [isActive, player]);

  useEffect(() => {
    const sub = player.addListener('playToEnd', () => {
      onFinish();
    });
    return () => sub.remove();
  }, [player, onFinish]);

  return (
    <View style={{ width, height }}>
      <VideoView player={player} style={styles.image} contentFit="contain" nativeControls={false} />
    </View>
  );
}

function StoryImageSlide({ uri, width, height }: { uri: string; width: number; height: number }) {
  return (
    <View style={{ width, height }}>
      <Image source={{ uri }} style={styles.image} resizeMode="contain" />
    </View>
  );
}

function formatStoryTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMin = Math.floor((now.getTime() - d.getTime()) / 60000);
  if (diffMin < 1) return 'เมื่อสักครู่';
  if (diffMin < 60) return `${diffMin} นาทีที่แล้ว`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH} ชม. ที่แล้ว`;
  return d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
}

export default function HomeStoryViewerScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { width, height } = useWindowDimensions();
  const userId = normalizeRouteParam(useLocalSearchParams<{ userId: string | string[] }>().userId);
  const { data: stories = [] } = useHomeStories();
  const [index, setIndex] = useState(0);
  const [myUserId, setMyUserId] = useState<string | null>(null);
  const listRef = useRef<Animated.ScrollView>(null);
  const recordedViews = useRef(new Set<string>());
  const recordView = useRecordStoryView();
  
  const isPaused = useSharedValue(false);
  const zoomScale = useSharedValue(1);

  useEffect(() => {
    void supabase.auth.getUser().then(({ data }) => setMyUserId(data.user?.id ?? null));
  }, []);

  const allGroups = useMemo(() => groupStoriesByUser(stories), [stories]);

  const group = useMemo(() => {
    if (!userId) return null;
    return allGroups.find((g) => g.userId === userId) ?? null;
  }, [allGroups, userId]);

  const currentStory = group?.stories[index] ?? null;
  const isOwner = !!myUserId && group?.userId === myUserId;

  const goNext = useCallback(() => {
    if (!group) return;
    if (index < group.stories.length - 1) {
      const nextIdx = index + 1;
      setIndex(nextIdx);
      listRef.current?.scrollTo({ x: nextIdx * width, animated: true });
    } else {
      const currentGIdx = allGroups.findIndex((g) => g.userId === userId);
      if (currentGIdx !== -1 && currentGIdx < allGroups.length - 1) {
        const nextUser = allGroups[currentGIdx + 1];
        router.replace(`/(tabs)/home/story/${nextUser.userId}`);
      } else {
        goBackOrReplace(router);
      }
    }
  }, [group, index, allGroups, userId, router, width]);

  const goPrev = useCallback(() => {
    if (!group) return;
    if (index > 0) {
      const nextIdx = index - 1;
      setIndex(nextIdx);
      listRef.current?.scrollTo({ x: nextIdx * width, animated: true });
    } else {
      const currentGIdx = allGroups.findIndex((g) => g.userId === userId);
      if (currentGIdx !== -1 && currentGIdx > 0) {
        const prevUser = allGroups[currentGIdx - 1];
        router.replace(`/(tabs)/home/story/${prevUser.userId}`);
      } else {
        setIndex(0);
        listRef.current?.scrollTo({ x: 0, animated: true });
      }
    }
  }, [group, index, allGroups, userId, router, width]);

  const trackView = useCallback(
    (story: HomeStory | null) => {
      if (!story || !myUserId || story.user_id === myUserId) return;
      if (recordedViews.current.has(story.id)) return;
      recordedViews.current.add(story.id);
      void recordView.mutateAsync(story.id).catch(() => {
        recordedViews.current.delete(story.id);
      });
    },
    [myUserId, recordView],
  );

  useEffect(() => {
    trackView(currentStory);
  }, [currentStory?.id, trackView]);

  const scrollX = useSharedValue(0);
  const translateY = useSharedValue(0);

  const onScroll = useAnimatedScrollHandler((e) => {
    scrollX.value = e.contentOffset.x;
    runOnJS(setIndex)(Math.round(e.contentOffset.x / width));
  });

  const panGesture = Gesture.Pan()
    .onUpdate((e) => {
      if (e.translationY > 0) {
        translateY.value = e.translationY;
      }
    })
    .onEnd((e) => {
      if (e.translationY > 150 || e.velocityY > 800) {
        runOnJS(goBackOrReplace)(router);
      } else {
        translateY.value = withTiming(0);
      }
    });

  const pinchGesture = Gesture.Pinch()
    .onUpdate((e) => {
      zoomScale.value = e.scale;
    })
    .onEnd(() => {
      zoomScale.value = withTiming(1);
    });

  const pauseGesture = Gesture.Pan()
    .minDistance(0)
    .onBegin(() => {
      isPaused.value = true;
    })
    .onFinalize(() => {
      isPaused.value = false;
    });

  const tapGesture = Gesture.Tap()
    .onEnd((e) => {
      if (e.x < width * 0.3) {
        runOnJS(goPrev)();
      } else {
        runOnJS(goNext)();
      }
    });

  const combinedGesture = Gesture.Simultaneous(
    pinchGesture,
    pauseGesture,
    Gesture.Race(panGesture, tapGesture)
  );

  const rootAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: translateY.value },
    ],
    opacity: interpolate(translateY.value, [0, 300], [1, 0.5], Extrapolation.CLAMP),
    borderRadius: interpolate(translateY.value, [0, 100], [0, 20], Extrapolation.CLAMP),
    overflow: 'hidden',
  }));

  const contentZoomStyle = useAnimatedStyle(() => ({
    transform: [{ scale: zoomScale.value }],
  }));

  const uiAnimatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(zoomScale.value, [1, 1.1], [1, 0], Extrapolation.CLAMP),
    pointerEvents: zoomScale.value > 1.05 ? 'none' : 'auto',
  }));

  const renderSlide = (item: HomeStory, itemIdx: number) => {
    return (
      <StoryCubeSlide
        key={item.id}
        index={itemIdx}
        scrollX={scrollX}
        width={width}
      >
        <View style={{ width, height }}>
          <Animated.View style={[StyleSheet.absoluteFill, contentZoomStyle]}>
            {item.media_type === 'video' ?
              <StoryVideoSlide
                uri={item.image_url}
                width={width}
                height={height}
                onFinish={goNext}
                isActive={index === itemIdx}
                isPausedShared={isPaused}
              />
            : <StoryImageSlide uri={item.image_url} width={width} height={height} />}
          </Animated.View>
          {item.caption?.trim() ?
            <View style={[styles.caption, { bottom: insets.bottom + (isOwner ? 72 : 88) }]}>
              <Text style={styles.captionUser}>{group?.displayName}</Text>
              <Text style={styles.captionText}>{item.caption}</Text>
            </View>
          : null}
        </View>
      </StoryCubeSlide>
    );
  };

  if (!group) {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <Stack.Screen
          options={{
            headerShown: false,
            presentation: 'fullScreenModal',
            animation: Platform.OS === 'ios' ? 'fade' : 'default',
          }}
        />
        <TouchableOpacity style={styles.close} onPress={() => goBackOrReplace(router)}>
          <X size={28} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.empty}>ไม่พบสตอรี</Text>
      </View>
    );
  }

  return (
    <GestureDetector gesture={combinedGesture}>
      <Animated.View style={[styles.root, rootAnimatedStyle]}>
        <Stack.Screen
          options={{
            headerShown: false,
            presentation: 'fullScreenModal',
            animation: Platform.OS === 'ios' ? 'fade' : 'default',
          }}
        />

        <Animated.View style={[styles.progressRow, { paddingTop: insets.top + 10 }, uiAnimatedStyle]}>
          {group.stories.map((s, i) => (
            <StoryProgressSeg
              key={s.id}
              active={i === index}
              finished={i < index}
              duration={s.media_type === 'video' ? (s.duration_ms || 15000) : 10000}
              onFinish={goNext}
              isPausedShared={isPaused}
            />
          ))}
        </Animated.View>

        <Animated.View style={[styles.topBar, { paddingTop: insets.top + 24 }, uiAnimatedStyle]}>
          <View style={styles.topInfo}>
            {group.avatarUrl ?
              <Image source={{ uri: group.avatarUrl }} style={styles.topAvatar} />
            : <View style={[styles.topAvatar, { backgroundColor: theme.primary, alignItems: 'center', justifyContent: 'center' }]}>
                <Text style={{ color: '#fff', fontWeight: '800', fontSize: 12 }}>{group.displayName[0]}</Text>
              </View>
            }
            <View>
              <Text style={styles.topName}>{group.displayName}</Text>
              <Text style={styles.topTime}>{currentStory ? formatStoryTime(currentStory.created_at) : ''}</Text>
            </View>
          </View>
          <TouchableOpacity style={styles.close} onPress={() => goBackOrReplace(router)} hitSlop={12}>
            <X size={26} color="#fff" />
          </TouchableOpacity>
        </Animated.View>

        <Animated.ScrollView
          ref={listRef as any}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onScroll={onScroll}
          scrollEventThrottle={16}
          decelerationRate="fast"
          scrollEnabled={true}
        >
          {group.stories.map((item, i) => renderSlide(item, i))}
        </Animated.ScrollView>

        <Animated.View style={uiAnimatedStyle}>
          {currentStory ?
            <HomeStoryViewerChrome
              story={currentStory}
              ownerDisplayName={group.displayName}
              isOwner={isOwner}
              theme={theme}
              bottomInset={insets.bottom}
              formatTime={formatStoryTime}
            />
          : null}
        </Animated.View>
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  progressRow: {
    position: 'absolute',
    top: 0,
    left: 8,
    right: 8,
    zIndex: 12,
    flexDirection: 'row',
    gap: 4,
  },
  progressSeg: { flex: 1, height: 2, borderRadius: 1, backgroundColor: 'rgba(255,255,255,0.35)', overflow: 'hidden' },
  progressActive: { backgroundColor: '#fff' },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  topInfo: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  topAvatar: { width: 34, height: 34, borderRadius: 17, borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)' },
  topName: { color: '#fff', fontWeight: '700', fontSize: 14 },
  topTime: { color: 'rgba(255,255,255,0.6)', fontSize: 11, fontWeight: '500', marginTop: 1 },
  close: { padding: 4 },
  image: { width: '100%', height: '100%' },
  caption: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 8,
  },
  captionUser: { color: '#fff', fontWeight: '800', marginBottom: 6 },
  captionText: { color: '#fff', fontSize: 15, lineHeight: 20 },
  empty: { color: '#fff', textAlign: 'center', marginTop: 80 },
});

function StoryProgressSeg({
  active,
  finished,
  duration,
  onFinish,
  isPausedShared,
}: {
  active: boolean;
  finished: boolean;
  duration: number;
  onFinish: () => void;
  isPausedShared: SharedValue<boolean>;
}) {
  const progress = useSharedValue(finished ? 1 : 0);

  const startAnimation = (rem: number) => {
    'worklet';
    progress.value = withTiming(1, { duration: rem, easing: Easing.linear }, (isFinished) => {
      if (isFinished) runOnJS(onFinish)();
    });
  };

  useAnimatedReaction(
    () => isPausedShared.value,
    (paused) => {
      if (!active || finished) return;
      if (paused) {
        cancelAnimation(progress);
      } else {
        const remaining = duration * (1 - progress.value);
        startAnimation(remaining);
      }
    },
    [active, finished, duration]
  );

  useEffect(() => {
    if (finished) {
      progress.value = 1;
    } else if (active) {
      if (!isPausedShared.value) {
        progress.value = 0;
        startAnimation(duration);
      }
    } else {
      progress.value = 0;
      cancelAnimation(progress);
    }
  }, [active, finished, duration]);

  const animatedStyle = useAnimatedStyle(() => ({
    width: `${progress.value * 100}%`,
  }));

  return (
    <View style={styles.progressSeg}>
      <Animated.View style={[styles.progressActive, animatedStyle, { height: '100%' }]} />
    </View>
  );
}

function StoryCubeSlide({
  children,
  index,
  scrollX,
  width,
}: {
  children: React.ReactNode;
  index: number;
  scrollX: SharedValue<number>;
  width: number;
}) {
  const animatedStyle = useAnimatedStyle(() => {
    const offset = index * width;
    const distance = scrollX.value - offset;
    const progress = distance / width;

    const rotateY = interpolate(
      progress,
      [-1, 0, 1],
      [90, 0, -90],
      Extrapolation.CLAMP
    );

    const translateX = interpolate(
      progress,
      [-1, 0, 1],
      [width / 2, 0, -width / 2],
      Extrapolation.CLAMP
    );

    const opacity = interpolate(
      progress,
      [-0.75, 0, 0.75],
      [0, 1, 0],
      Extrapolation.CLAMP
    );

    return {
      transform: [
        { perspective: width * 2 },
        { translateX },
        { rotateY: `${rotateY}deg` },
        { translateX: -translateX },
      ],
      opacity,
    };
  });

  return (
    <Animated.View style={[{ width }, animatedStyle]}>
      {children}
    </Animated.View>
  );
}
