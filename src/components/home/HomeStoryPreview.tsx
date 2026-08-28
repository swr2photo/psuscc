import { StyleSheet, Text, TouchableOpacity, View, Image } from 'react-native';
import { useEffect, useState } from 'react';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronRight, X } from 'lucide-react-native';
import {
  formatDurationLabel,
  isHomeVideo,
  type HomeCapturedMedia,
} from '@/features/home/homeMedia';

type Props = {
  media: HomeCapturedMedia;
  onBack: () => void;
  onNext: () => void;
};

function StoryVideoPreview({ uri, clips }: { uri: string; clips?: string[] }) {
  const [idx, setIdx] = useState(0);
  const currentUri = clips && clips.length > 0 ? clips[idx] : uri;

  const player = useVideoPlayer(currentUri, (p) => {
    p.loop = false;
    p.play();
  });

  useEffect(() => {
    const sub = player.addListener('playToEnd', () => {
      if (clips && clips.length > 0) {
        setIdx((prev) => (prev + 1) % clips.length);
      } else {
        player.seekBy(0 - player.currentTime);
        player.play();
      }
    });
    return () => sub.remove();
  }, [player, clips]);

  return (
    <VideoView
      player={player}
      style={StyleSheet.absoluteFill}
      contentFit="cover"
      nativeControls={false}
    />
  );
}

export function HomeStoryPreview({ media, onBack, onNext }: Props) {
  const insets = useSafeAreaInsets();
  const isVideo = isHomeVideo(media);

  return (
    <View style={styles.root}>
      {isVideo ?
        <StoryVideoPreview uri={media.uri} clips={media.clips} />
      : <Image source={{ uri: media.uri }} style={StyleSheet.absoluteFill} resizeMode="cover" />}

      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={onBack} style={styles.iconBtn}>
          <X color="#fff" size={28} />
        </TouchableOpacity>
        {isVideo && media.durationMs ?
          <View style={styles.durationBadge}>
            <Text style={styles.durationText}>{formatDurationLabel(media.durationMs)}</Text>
          </View>
        : null}
      </View>

      <View style={[styles.bottom, { paddingBottom: insets.bottom + 16 }]}>
        <TouchableOpacity style={styles.nextBtn} onPress={onNext} activeOpacity={0.9}>
          <Text style={styles.nextLabel}>ถัดไป</Text>
          <View style={styles.nextCircle}>
            <ChevronRight color="#fff" size={22} />
          </View>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    gap: 12,
  },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  durationBadge: {
    backgroundColor: 'rgba(0,0,0,0.45)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  durationText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  bottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 10,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 20,
  },
  nextBtn: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  nextLabel: { color: '#fff', fontWeight: '700', fontSize: 15 },
  nextCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#3897f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
