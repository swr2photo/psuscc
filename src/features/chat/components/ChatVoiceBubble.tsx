import { memo, useEffect, useState, useMemo } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View, Pressable } from 'react-native';
import { Pause, Play } from 'lucide-react-native';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import Animated, { useAnimatedStyle, withTiming, useDerivedValue, interpolate } from 'react-native-reanimated';
import {
  getReadableStorageUrl,
  STORAGE_BUCKET_CHAT_ATTACHMENTS,
} from '@/lib/supabase-storage';

function formatVoiceLabel(ms?: number | null): string {
  if (ms == null || ms <= 0) return '0:00';
  const s = Math.max(1, Math.ceil(ms / 1000));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, '0')}`;
}

const WaveformBar = memo(({ index, progress, isMe, accent }: { index: number; progress: number; isMe: boolean; accent: string }) => {
  // Generate random heights for waveform
  const height = useMemo(() => 4 + Math.random() * 16, []);
  
  const animatedStyle = useAnimatedStyle(() => {
    const isActive = progress >= (index / 30); // 30 bars
    return {
      height: withTiming(height, { duration: 100 }),
      backgroundColor: isActive 
        ? (isMe ? '#FFF' : accent)
        : (isMe ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.1)'),
    };
  });

  return (
    <Animated.View 
      style={[
        { width: 2, borderRadius: 1, marginHorizontal: 1 },
        animatedStyle
      ]} 
    />
  );
});

const VoicePlayer = memo(function VoicePlayer({
  uri,
  label,
  durationMs,
  isMe,
  bubbleMe,
  bubbleOther,
  bubbleOtherText,
  accent,
}: {
  uri: string;
  label: string;
  durationMs?: number | null;
  isMe: boolean;
  bubbleMe: string;
  bubbleOther: string;
  bubbleOtherText: string;
  accent: string;
}) {
  const player = useAudioPlayer(uri, { downloadFirst: true });
  const status = useAudioPlayerStatus(player);
  
  const progress = durationMs ? (status.currentTime / durationMs) : 0;

  const toggle = () => {
    if (status.playing) {
      player.pause();
    } else {
      player.play();
    }
  };

  const seekTo = (e: any) => {
    // Simple seek implementation could go here if layout is known
  };

  const iconColor = isMe ? '#FFF' : bubbleOtherText;

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: isMe ? bubbleMe : bubbleOther,
          alignSelf: isMe ? 'flex-end' : 'flex-start',
        },
      ]}
    >
      <View style={styles.content}>
        <TouchableOpacity
          onPress={toggle}
          style={[
            styles.playBtn,
            { backgroundColor: isMe ? 'rgba(255,255,255,0.2)' : accent + '20' },
          ]}
        >
          {status.playing ? (
            <Pause size={18} color={iconColor} fill={iconColor} />
          ) : (
            <Play size={18} color={iconColor} fill={iconColor} style={{ marginLeft: 2 }} />
          )}
        </TouchableOpacity>

        <View style={styles.waveformContainer}>
          {Array.from({ length: 24 }).map((_, i) => (
            <WaveformBar 
              key={i} 
              index={i} 
              progress={progress * (24/30)} // Scale progress to 24 bars
              isMe={isMe} 
              accent={accent} 
            />
          ))}
        </View>

        <Text style={[styles.dur, { color: isMe ? '#FFF' : bubbleOtherText }]}>
          {status.playing ? formatVoiceLabel(status.currentTime) : label}
        </Text>
      </View>
    </View>
  );
});

export const ChatVoiceBubble = memo(function ChatVoiceBubble({
  storedUrl,
  durationMs,
  isMe,
  bubbleMe,
  bubbleOther,
  bubbleOtherText,
  accent,
}: {
  storedUrl: string;
  durationMs?: number | null;
  isMe: boolean;
  bubbleMe: string;
  bubbleOther: string;
  bubbleOtherText: string;
  accent: string;
}) {
  const [uri, setUri] = useState<string | null>(() =>
    storedUrl.startsWith('http') ||
    storedUrl.startsWith('file') ||
    storedUrl.startsWith('content') ||
    storedUrl.startsWith('ph')
      ? storedUrl
      : null,
  );

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      const isImmediate =
        storedUrl.startsWith('http') ||
        storedUrl.startsWith('file') ||
        storedUrl.startsWith('content') ||
        storedUrl.startsWith('ph');
      if (isImmediate) {
        setUri(storedUrl);
        return;
      }
      const u = await getReadableStorageUrl(STORAGE_BUCKET_CHAT_ATTACHMENTS, storedUrl);
      if (!cancelled && u) setUri(u);
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [storedUrl]);

  const label = formatVoiceLabel(durationMs);

  if (!uri) {
    return (
      <View style={[styles.container, styles.loadingRow, { alignSelf: isMe ? 'flex-end' : 'flex-start' }]}>
        <ActivityIndicator color={accent} size="small" />
        <Text style={{ marginLeft: 10, fontWeight: '600', color: bubbleOtherText }}>{label}</Text>
      </View>
    );
  }

  return (
    <VoicePlayer
      uri={uri}
      label={label}
      durationMs={durationMs}
      isMe={isMe}
      bubbleMe={bubbleMe}
      bubbleOther={bubbleOther}
      bubbleOtherText={bubbleOtherText}
      accent={accent}
    />
  );
});

const styles = StyleSheet.create({
  container: {
    borderRadius: 24,
    paddingVertical: 8,
    paddingHorizontal: 12,
    minWidth: 200,
    maxWidth: '85%',
    borderCurve: 'continuous',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    backgroundColor: 'rgba(128,128,128,0.1)',
  },
  playBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  waveformContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    height: 30,
    justifyContent: 'center',
  },
  dur: { 
    fontSize: 12, 
    fontWeight: '700',
    minWidth: 32,
    textAlign: 'right',
  },
});
