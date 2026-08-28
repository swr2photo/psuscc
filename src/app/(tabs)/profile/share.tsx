import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Share,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  clamp,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { DeviceMotion } from 'expo-sensors';
import { LinearGradient as ExpoLinearGradient } from 'expo-linear-gradient';
import { Stack, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient as SvgGradient, Stop, Rect } from 'react-native-svg';
import QRCode from 'react-native-qrcode-svg';
import * as Clipboard from 'expo-clipboard';
import * as Sharing from 'expo-sharing';
import * as Linking from 'expo-linking';
import { captureRef } from 'react-native-view-shot';
import { X, ScanLine, Share as ShareIcon, Link2, Download, Palette } from 'lucide-react-native';
import Toast from 'react-native-toast-message';
import { supabase } from '@/lib/supabase';

const { width: WIN_W, height: WIN_H } = Dimensions.get('window');

const PALETTES = {
  warm: {
    stops: ['#FFE566', '#FF9F45', '#FF4488', '#E040A0'],
    qr: '#E11D74',
    handle: '#E11D74',
  },
  cool: {
    stops: ['#B4E9FF', '#6B8CFF', '#6366f1', '#7C3AED'],
    qr: '#4F46E5',
    handle: '#4F46E5',
  },
} as const;

type PaletteKey = keyof typeof PALETTES;

/** Damped spring back to rest (underdamped ≈ physical card on damped hinge). */
const CARD_SPRING = { stiffness: 220, damping: 18, mass: 0.72 } as const;
const MAX_TILT_DEG = 15;
/** translation (px) → tilt (deg), τ = r×F proxy for small angles */
const TILT_PER_PX = 0.055;

/** DeviceMotion.rotation (beta/gamma) → card tilt multiplier (deg/deg). */
const ORIENT_GAIN = 0.38;
/** Blends gyro rate (rotationRate °/s) into tilt for sharper twists. */
const RATE_GAIN = 0.045;
/** Expo interval smoothing 0–1; higher tracks device faster */
const SENSOR_SMOOTH = 0.22;
const WARMUP_SAMPLES = 14;

export default function ProfileShareScreen() {
  const router = useRouter();
  const isFocused = useIsFocused();
  const insets = useSafeAreaInsets();
  const cardRef = useRef<View>(null);
  const capturingRef = useRef(false);
  /** Low-pass smoothed tilt from device orientation + gyro rate */
  const sensorTiltX = useSharedValue(0);
  const sensorTiltY = useSharedValue(0);
  /** Finger drag offset; springs back to 0 — stacked on sensor tilt */
  const panTiltX = useSharedValue(0);
  const panTiltY = useSharedValue(0);
  const panStartX = useSharedValue(0);
  const panStartY = useSharedValue(0);

  const calibRef = useRef<{ beta0: number; gamma0: number } | null>(null);
  const warmSumRef = useRef({ b: 0, g: 0, n: 0 });
  const smoothJsRef = useRef({ x: 0, y: 0 });

  const [palette, setPalette] = useState<PaletteKey>('warm');
  const [userId, setUserId] = useState<string | null>(null);
  const [handle, setHandle] = useState('profile');
  const [loading, setLoading] = useState(true);
  const [capturing, setCapturing] = useState(false);

  const colors = PALETTES[palette];

  const shareUrl = userId
    ? Linking.createURL('/(tabs)/profile', { queryParams: { u: userId } })
    : Linking.createURL('/(tabs)/profile');

  const loadUser = useCallback(async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user?.id) {
        setUserId(user.id);
        const local = user.email?.split('@')[0];
        if (local) setHandle(local);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  useEffect(() => {
    if (!isFocused) return;
    calibRef.current = null;
    warmSumRef.current = { b: 0, g: 0, n: 0 };
    smoothJsRef.current = { x: 0, y: 0 };
    sensorTiltX.value = 0;
    sensorTiltY.value = 0;
  }, [isFocused, sensorTiltX, sensorTiltY]); // SharedValues stable; satisfies lint for `.value`

  useEffect(() => {
    if (!isFocused || Platform.OS === 'web') return;
    let cancelled = false;
    let subscription: ReturnType<(typeof DeviceMotion)['addListener']> | undefined;

    (async () => {
      try {
        const avail = await DeviceMotion.isAvailableAsync();
        if (!avail || cancelled) return;
        const perm = await DeviceMotion.requestPermissionsAsync();
        if (perm.status !== 'granted' || cancelled) return;
        DeviceMotion.setUpdateInterval(32);
        subscription = DeviceMotion.addListener((m) => {
          if (capturingRef.current || cancelled) return;
          const { beta, gamma } = m.rotation;
          if (!calibRef.current) {
            const w = warmSumRef.current;
            if (w.n < WARMUP_SAMPLES) {
              w.b += beta;
              w.g += gamma;
              w.n += 1;
              return;
            }
            calibRef.current = { beta0: w.b / WARMUP_SAMPLES, gamma0: w.g / WARMUP_SAMPLES };
          }
          const { beta0, gamma0 } = calibRef.current;
          const rB = m.rotationRate?.beta ?? 0;
          const rG = m.rotationRate?.gamma ?? 0;
          // beta ≈ pitch (front/back), gamma ≈ roll (twist left/right); match card rotateX/Y
          const orientX = -(beta - beta0) * ORIENT_GAIN + rB * RATE_GAIN;
          const orientY = (gamma - gamma0) * ORIENT_GAIN + rG * RATE_GAIN;
          let targetX = Math.max(-MAX_TILT_DEG, Math.min(MAX_TILT_DEG, orientX));
          let targetY = Math.max(-MAX_TILT_DEG, Math.min(MAX_TILT_DEG, orientY));
          const α = SENSOR_SMOOTH;
          const sj = smoothJsRef.current;
          sj.x = α * targetX + (1 - α) * sj.x;
          sj.y = α * targetY + (1 - α) * sj.y;
          sensorTiltX.value = sj.x;
          sensorTiltY.value = sj.y;
        });
      } catch {
        /* sensor unavailable — pan-only tilt */
      }
    })();

    return () => {
      cancelled = true;
      subscription?.remove();
    };
  }, [isFocused]);

  const togglePalette = () => {
    setPalette((p) => (p === 'warm' ? 'cool' : 'warm'));
  };

  const onShare = async () => {
    try {
      await Share.share({
        message: `PSUSCC @${handle}\n${shareUrl}`,
        url: Platform.OS === 'ios' ? shareUrl : undefined,
        title: 'แชร์โปรไฟล์',
      });
    } catch {
      /* dismissed */
    }
  };

  const onCopyLink = async () => {
    await Clipboard.setStringAsync(shareUrl);
    Toast.show({ type: 'success', text1: 'คัดลอกลิงก์แล้ว' });
  };

  /** Flat PNG: zero pan & sensor tilt; returns previous sensor values to restore afterward. */
  const beginFlatCapture = useCallback(() => {
    capturingRef.current = true;
    cancelAnimation(panTiltX);
    cancelAnimation(panTiltY);
    panTiltX.value = 0;
    panTiltY.value = 0;
    const sx = sensorTiltX.value;
    const sy = sensorTiltY.value;
    sensorTiltX.value = 0;
    sensorTiltY.value = 0;
    return { sx, sy };
  }, [panTiltX, panTiltY, sensorTiltX, sensorTiltY]);

  const restoreSensorAfterCapture = useCallback(
    (sx: number, sy: number) => {
      sensorTiltX.value = sx;
      sensorTiltY.value = sy;
      smoothJsRef.current = { x: sx, y: sy };
      capturingRef.current = false;
    },
    [sensorTiltX, sensorTiltY],
  );

  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetX([-8, 8])
        .activeOffsetY([-8, 8])
        .onStart(() => {
          panStartX.value = panTiltX.value;
          panStartY.value = panTiltY.value;
        })
        .onUpdate((e) => {
          const nextX = panStartX.value - e.translationY * TILT_PER_PX;
          const nextY = panStartY.value + e.translationX * TILT_PER_PX;
          panTiltX.value = clamp(nextX, -MAX_TILT_DEG, MAX_TILT_DEG);
          panTiltY.value = clamp(nextY, -MAX_TILT_DEG, MAX_TILT_DEG);
        })
        .onEnd((e) => {
          const vx = e.velocityX * TILT_PER_PX * 0.08;
          const vy = -e.velocityY * TILT_PER_PX * 0.08;
          panTiltX.value = withSpring(0, { ...CARD_SPRING, velocity: vy });
          panTiltY.value = withSpring(0, { ...CARD_SPRING, velocity: vx });
        }),
    [panStartX, panStartY, panTiltX, panTiltY],
  );

  const cardAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      { perspective: 960 },
      {
        rotateX: `${clamp(sensorTiltX.value + panTiltX.value, -MAX_TILT_DEG, MAX_TILT_DEG)}deg`,
      },
      {
        rotateY: `${clamp(sensorTiltY.value + panTiltY.value, -MAX_TILT_DEG, MAX_TILT_DEG)}deg`,
      },
    ],
  }));

  const onDownloadCard = async () => {
    if (!cardRef.current) return;
    let snapSx = 0;
    let snapSy = 0;
    try {
      setCapturing(true);
      const s = beginFlatCapture();
      snapSx = s.sx;
      snapSy = s.sy;
      await new Promise<void>((r) => requestAnimationFrame(() => r()));
      const uri = await captureRef(cardRef, {
        format: 'png',
        quality: 1,
        result: 'tmpfile',
      });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: 'image/png',
          dialogTitle: 'บันทึก / แชร์ QR',
        });
      } else {
        Toast.show({ type: 'error', text1: 'ไม่สามารถเปิดแชร์บนอุปกรณ์นี้' });
      }
    } catch {
      Toast.show({ type: 'error', text1: 'บันทึกภาพไม่สำเร็จ' });
    } finally {
      restoreSensorAfterCapture(snapSx, snapSy);
      setCapturing(false);
    }
  };

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ headerShown: false }} />

      <Svg width={WIN_W} height={WIN_H} style={StyleSheet.absoluteFill}>
        <Defs>
          <SvgGradient id="shareBg" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={colors.stops[0]} stopOpacity={1} />
            <Stop offset="0.35" stopColor={colors.stops[1]} stopOpacity={1} />
            <Stop offset="0.65" stopColor={colors.stops[2]} stopOpacity={1} />
            <Stop offset="1" stopColor={colors.stops[3]} stopOpacity={1} />
          </SvgGradient>
        </Defs>
        <Rect x={0} y={0} width={WIN_W} height={WIN_H} fill="url(#shareBg)" />
      </Svg>

      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity style={styles.topBtn} onPress={() => router.back()} hitSlop={12}>
          <X size={26} color="#fff" strokeWidth={2.5} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.modePill} onPress={togglePalette} activeOpacity={0.85}>
          <Palette size={14} color="#333" />
          <Text style={styles.modePillText}>COLOR</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.topBtn} onPress={() => router.push('/checkin-scanner')} hitSlop={12}>
          <ScanLine size={24} color="#fff" strokeWidth={2.5} />
        </TouchableOpacity>
      </View>

      <View style={styles.center}>
        {loading ? (
          <ActivityIndicator color="#fff" size="large" />
        ) : (
          <GestureDetector gesture={panGesture}>
            <Animated.View ref={cardRef} collapsable={false} style={[styles.card, cardAnimatedStyle]}>
              <ExpoLinearGradient
                pointerEvents="none"
                colors={['rgba(255,255,255,0.55)', 'rgba(255,255,255,0)', 'rgba(0,0,0,0.07)']}
                locations={[0, 0.45, 1]}
                start={{ x: 0.1, y: 0 }}
                end={{ x: 0.85, y: 1 }}
                style={styles.cardSheen}
              />
              <View style={styles.qrWrap}>
                <QRCode
                  value={shareUrl}
                  size={220}
                  color={colors.qr}
                  backgroundColor="#FFFFFF"
                  quietZone={12}
                  logo={require('../../../../assets/images/icon.png')}
                  logoSize={48}
                  logoBackgroundColor="#fff"
                  logoBorderRadius={12}
                  logoMargin={4}
                />
              </View>
              <Text style={[styles.handle, { color: colors.handle }]}>@{handle}</Text>
              <Text style={styles.subLink} numberOfLines={1}>
                {shareUrl.replace(/^https?:\/\//, '')}
              </Text>
            </Animated.View>
          </GestureDetector>
        )}
      </View>

      <View style={[styles.bottomActions, { paddingBottom: insets.bottom + 20 }]}>
        <TouchableOpacity style={styles.actionBtn} onPress={onShare} activeOpacity={0.85}>
          <ShareIcon size={24} color="#111" strokeWidth={2.2} />
          <Text style={styles.actionLabel}>แชร์โปรไฟล์</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={onCopyLink} activeOpacity={0.85}>
          <Link2 size={24} color="#111" strokeWidth={2.2} />
          <Text style={styles.actionLabel}>คัดลอกลิงก์</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionBtn}
          onPress={onDownloadCard}
          activeOpacity={0.85}
          disabled={capturing || loading}
        >
          {capturing ? (
            <ActivityIndicator color="#111" />
          ) : (
            <Download size={24} color="#111" strokeWidth={2.2} />
          )}
          <Text style={styles.actionLabel}>ดาวน์โหลด</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FF9F45' },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingBottom: 8,
    zIndex: 2,
  },
  topBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.95)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
  },
  modePillText: {
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1,
    color: '#222',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    zIndex: 2,
  },
  card: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#fff',
    borderRadius: 28,
    paddingVertical: 28,
    paddingHorizontal: 20,
    alignItems: 'center',
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,0,0,0.08)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 14,
  },
  cardSheen: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 28,
  },
  qrWrap: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 8,
    overflow: 'hidden',
  },
  handle: {
    marginTop: 18,
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  subLink: {
    marginTop: 8,
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
    paddingHorizontal: 8,
  },
  bottomActions: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    alignItems: 'flex-start',
    paddingHorizontal: 12,
    zIndex: 2,
  },
  actionBtn: {
    width: 96,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 18,
    paddingVertical: 16,
    alignItems: 'center',
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 6,
  },
  actionLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#111',
    textAlign: 'center',
  },
});
