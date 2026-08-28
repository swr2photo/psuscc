import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import {
  Dimensions,
  FlatList,
  Image,
  LayoutChangeEvent,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type ListRenderItemInfo,
  type ViewToken,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors } from '@/constants/theme';
import { nestedHorizontalScrollProps } from '@/constants/scroll-insets';
import type { StorePromoSlide } from '@/constants/store-promo-slides';
import type { AppTheme } from '@/hooks/use-theme';

type Router = ReturnType<typeof useRouter>;

const HORIZONTAL_INSET = 24;
const PROMO_RATIO = 9 / 16;

type Props = {
  slides: StorePromoSlide[];
  router: Router;
  /** Apple Store — hero แบบเต็มความกว้าง ข้อความทับบนภาพ */
  variant?: 'default' | 'apple';
};

const CarouselVideoSlide = memo(function CarouselVideoSlide({
  uri,
  isFocused,
  width,
  height,
}: {
  uri: string;
  isFocused: boolean;
  width: number;
  height: number;
}) {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = true;
    p.muted = true;
  });

  useEffect(() => {
    try {
      if (isFocused) {
        player.play();
      } else {
        player.pause();
      }
    } catch {
      /* ignore */
    }
  }, [isFocused, player]);

  return (
    <View style={{ width, height, backgroundColor: '#0f172a', overflow: 'hidden' }}>
      <VideoView
        player={player}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        nativeControls={false}
      />
    </View>
  );
});

const CarouselImageSlide = memo(function CarouselImageSlide({
  uri,
  width,
  height,
}: {
  uri: string;
  width: number;
  height: number;
}) {
  return (
    <Image
      source={{ uri }}
      accessibilityIgnoresInvertColors
      resizeMode="cover"
      style={{ width, height, backgroundColor: '#0f172a' }}
    />
  );
});

export function StorePromoCarousel({ slides, router, variant = 'default' }: Props) {
  const apple = variant === 'apple';
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];

  const displaySlides = React.useMemo(
    () => (Platform.OS === 'web' ? slides.filter((s) => s.kind === 'image') : slides),
    [slides],
  );

  const [listW, setListW] = useState(() => Math.max(280, Dimensions.get('window').width - HORIZONTAL_INSET * 2));
  const slideHeight = apple ?
    Math.max(Math.round(listW * 0.52), 200)
  : Math.max(Math.round(listW * PROMO_RATIO), 160);

  const [activeIndex, setActiveIndex] = useState(0);

  const onContainerLayout = useCallback((e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w > 0) {
      setListW((prev) => (Math.abs(prev - w) > 0.5 ? w : prev));
    }
  }, []);

  const onViewableItemsChanged = useRef(
    ({
      viewableItems,
    }: {
      viewableItems: ViewToken[];
    }) => {
      const ix = viewableItems[0]?.index;
      if (typeof ix === 'number') {
        setActiveIndex(ix);
      }
    },
  ).current;

  const effectiveIndex = Math.min(Math.max(activeIndex, 0), Math.max(displaySlides.length - 1, 0));
  const activeSlide = displaySlides[effectiveIndex];

  const renderItem = useCallback(
    ({ item, index }: ListRenderItemInfo<StorePromoSlide>) => {
      return (
        <View style={{ width: listW, height: slideHeight }}>
          <View style={styles.mediaClip}>
            {item.kind === 'video' ? (
              <CarouselVideoSlide
                uri={item.uri}
                isFocused={index === effectiveIndex}
                width={listW}
                height={slideHeight}
              />
            ) : (
              <CarouselImageSlide uri={item.uri} width={listW} height={slideHeight} />
            )}
          </View>

          <LinearGradient
            pointerEvents="none"
            colors={
              apple ?
                ['transparent', 'rgba(0,0,0,0.15)', 'rgba(0,0,0,0.55)']
              : ['transparent', 'rgba(0,0,0,0.45)', 'rgba(0,0,0,0.82)']
            }
            locations={apple ? [0.35, 0.65, 1] : [0.2, 0.55, 1]}
            style={StyleSheet.absoluteFill}
          />
          {apple ?
            <View style={styles.appleHeroCopy} pointerEvents="none">
              <Text style={styles.appleHeroTitle} numberOfLines={2}>
                {item.title ?? 'PSU SCC Store'}
              </Text>
              {item.subtitle ?
                <Text style={styles.appleHeroSub} numberOfLines={2}>
                  {item.subtitle}
                </Text>
              : null}
            </View>
          : null}
        </View>
      );
    },
    [apple, effectiveIndex, listW, slideHeight],
  );

  if (!displaySlides.length) return null;

  return (
    <View
      style={[styles.outer, apple ? styles.outerApple : { marginHorizontal: HORIZONTAL_INSET }]}
      onLayout={onContainerLayout}
    >
      <View
        style={[
          styles.card,
          apple && styles.cardApple,
          { width: listW, height: slideHeight, borderColor: apple ? 'transparent' : theme.border },
        ]}
      >
        <FlatList
          data={displaySlides}
          horizontal
          keyExtractor={(s) => s.id}
          style={{ width: listW }}
          showsHorizontalScrollIndicator={false}
          pagingEnabled={Platform.OS === 'ios'}
          snapToAlignment="center"
          decelerationRate="fast"
          snapToInterval={Platform.OS === 'android' ? listW : undefined}
          {...nestedHorizontalScrollProps}
          getItemLayout={(_, ix) => ({
            length: listW,
            offset: listW * ix,
            index: ix,
          })}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={{ itemVisiblePercentThreshold: 55 }}
          renderItem={renderItem}
        />

        {slides.length > 1 ?
          <View style={[styles.dotRow, apple && styles.dotRowApple]}>
            {displaySlides.map((s, i) => (
              <View
                key={s.id}
                style={[styles.dot, i === effectiveIndex ? styles.dotActive : styles.dotMuted]}
              />
            ))}
          </View>
        : null}
      </View>

      {apple ?
        <CtaButtons router={router} theme={theme} apple />
      : Platform.OS === 'ios' ?
        <BlurView intensity={48} tint={colorScheme === 'dark' ? 'dark' : 'light'} style={styles.ctaPanel}>
          <Text style={[styles.bannerTitle, { color: theme.text }]} numberOfLines={2}>
            {activeSlide?.title ?? 'PSU SCC Store'}
          </Text>
          {activeSlide?.subtitle ?
            <Text style={[styles.bannerSub, { color: theme.mutedForeground }]} numberOfLines={2}>
              {activeSlide.subtitle}
            </Text>
          : null}
          <CtaButtons router={router} theme={theme} />
        </BlurView>
      : <View style={[styles.ctaPanelAndroid, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.bannerTitle, { color: theme.text }]} numberOfLines={2}>
            {activeSlide?.title ?? 'PSU SCC Store'}
          </Text>
          {activeSlide?.subtitle ?
            <Text style={[styles.bannerSub, { color: theme.mutedForeground }]} numberOfLines={2}>
              {activeSlide.subtitle}
            </Text>
          : null}
          <CtaButtons router={router} theme={theme} />
        </View>
      }
    </View>
  );
}

function CtaButtons({
  router,
  theme,
  apple = false,
}: {
  router: Router;
  theme: AppTheme;
  apple?: boolean;
}) {
  if (apple) {
    return (
      <View style={styles.appleCtaRow}>
        <TouchableOpacity onPress={() => router.push('/(tabs)/store/orders')} activeOpacity={0.7}>
          <Text style={[styles.appleLink, { color: theme.primary }]}>ดูคำสั่งซื้อ</Text>
        </TouchableOpacity>
        <Text style={{ color: theme.mutedForeground }}>·</Text>
        <TouchableOpacity onPress={() => router.push('/(tabs)/store/cart')} activeOpacity={0.7}>
          <Text style={[styles.appleLink, { color: theme.primary }]}>ตะกร้า</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.ctaRow}>
      <TouchableOpacity
        style={[styles.bannerBtnPrimary, { backgroundColor: theme.text }]}
        onPress={() => router.push('/(tabs)/store/orders')}
        activeOpacity={0.85}
      >
        <Text style={[styles.bannerBtnText, { color: theme.background }]}>คำสั่งซื้อของฉัน</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[
          styles.bannerBtnSecondary,
          { backgroundColor: theme.secondary, borderColor: theme.border },
        ]}
        onPress={() => router.push('/(tabs)/store/cart')}
        activeOpacity={0.85}
      >
        <Text style={[styles.bannerBtnText, { color: theme.text }]}>ตะกร้า</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    marginBottom: 22,
    alignSelf: 'stretch',
  },
  outerApple: {
    marginHorizontal: 20,
    marginBottom: 18,
  },
  card: {
    alignSelf: 'center',
    borderRadius: 28,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.12,
        shadowRadius: 12,
      },
      default: { elevation: 3 },
    }),
  },
  cardApple: {
    borderRadius: 18,
    borderWidth: 0,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 16,
      },
      default: { elevation: 4 },
    }),
  },
  appleHeroCopy: {
    position: 'absolute',
    left: 20,
    right: 20,
    bottom: 20,
  },
  appleHeroTitle: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.6,
    lineHeight: 32,
  },
  appleHeroSub: {
    color: 'rgba(255,255,255,0.88)',
    marginTop: 6,
    fontSize: 15,
    fontWeight: '500',
    lineHeight: 20,
  },
  appleCtaRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    marginTop: 12,
    marginBottom: 4,
  },
  appleLink: {
    fontSize: 15,
    fontWeight: '600',
  },
  dotRowApple: {
    bottom: 14,
  },
  mediaClip: {
    flex: 1,
    overflow: 'hidden',
  },
  dotRow: {
    position: 'absolute',
    bottom: 10,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 7,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  dotActive: {
    backgroundColor: '#FFF',
    transform: [{ scaleX: 1.2 }],
  },
  dotMuted: {
    backgroundColor: 'rgba(255,255,255,0.45)',
  },
  ctaPanel: {
    marginTop: 12,
    paddingHorizontal: 18,
    paddingVertical: 16,
    borderRadius: 22,
    overflow: 'hidden',
  },
  ctaPanelAndroid: {
    marginTop: 12,
    paddingHorizontal: 18,
    paddingVertical: 16,
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
  },
  bannerTitle: {
    fontSize: 21,
    fontWeight: '900',
    letterSpacing: -0.4,
  },
  bannerSub: {
    marginTop: 5,
    fontWeight: '600',
    fontSize: 14,
    lineHeight: 20,
  },
  ctaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 14,
  },
  bannerBtnPrimary: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
  },
  bannerBtnSecondary: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
  },
  bannerBtnText: {
    fontWeight: '800',
    fontSize: 14,
  },
});
