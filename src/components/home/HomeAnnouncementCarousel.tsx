import { useCallback, useRef, useState } from 'react';
import {
  FlatList,
  Linking,
  NativeScrollEvent,
  NativeSyntheticEvent,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type ListRenderItemInfo,
} from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import type { HomeAnnouncementSlide, HomeAnnouncementLink } from '@/constants/home-announcement-slides';
import type { AppTheme } from '@/hooks/use-theme';
import { nestedHorizontalScrollProps } from '@/constants/scroll-insets';

type Props = {
  slides: HomeAnnouncementSlide[];
  width: number;
  theme: AppTheme;
};

export function HomeAnnouncementCarousel({ slides, width, theme }: Props) {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const listRef = useRef<FlatList<HomeAnnouncementSlide>>(null);
  const height = Math.round(width * 0.52);

  const onScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const x = e.nativeEvent.contentOffset.x;
      const i = Math.round(x / width);
      if (i >= 0 && i < slides.length) setIndex(i);
    },
    [width, slides.length],
  );

  const openLink = (link?: HomeAnnouncementLink) => {
    if (!link) return;
    if (link.type === 'event') {
      router.push({ pathname: '/event-detail', params: { id: link.id } });
    } else if (link.type === 'route') {
      router.push(link.path as never);
    } else if (link.type === 'url') {
      void Linking.openURL(link.url);
    }
  };

  if (!slides.length) return null;

  const renderItem = ({ item }: ListRenderItemInfo<HomeAnnouncementSlide>) => (
    <TouchableOpacity
      activeOpacity={0.95}
      onPress={() => openLink(item.link)}
      style={{ width, height }}
    >
      <Image source={item.imageUrl} style={styles.image} contentFit="cover" transition={200} />
      {(item.title || item.subtitle) && (
        <View style={styles.caption}>
          {item.title ?
            <Text style={styles.captionTitle} numberOfLines={1}>
              {item.title}
            </Text>
          : null}
          {item.subtitle ?
            <Text style={styles.captionSub} numberOfLines={1}>
              {item.subtitle}
            </Text>
          : null}
        </View>
      )}
    </TouchableOpacity>
  );

  return (
    <View style={[styles.wrap, { width }]}>
      <View style={[styles.card, { height, backgroundColor: theme.secondary }]}>
        <FlatList
          ref={listRef}
          data={slides}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          {...nestedHorizontalScrollProps}
          keyExtractor={(s) => s.id}
          onScroll={onScroll}
          scrollEventThrottle={16}
          getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
          renderItem={renderItem}
        />
        {slides.length > 1 ?
          <View style={styles.counter}>
            <Text style={styles.counterText}>
              {index + 1}/{slides.length}
            </Text>
          </View>
        : null}
      </View>
      {slides.length > 1 ?
        <View style={styles.dots}>
          {slides.map((s, i) => (
            <View
              key={s.id}
              style={[
                styles.dot,
                {
                  backgroundColor: i === index ? theme.primary : theme.border,
                  width: i === index ? 8 : 6,
                },
              ]}
            />
          ))}
        </View>
      : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignSelf: 'center',
    marginBottom: 8,
  },
  card: {
    borderRadius: 4,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  caption: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  captionTitle: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  captionSub: {
    color: 'rgba(255,255,255,0.88)',
    fontSize: 13,
    fontWeight: '500',
    marginTop: 2,
  },
  counter: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  counterText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 5,
    marginTop: 10,
  },
  dot: {
    height: 6,
    borderRadius: 3,
  },
});
