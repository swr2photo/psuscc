import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  ActivityIndicator,
  Animated,
  Easing,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  Camera as CameraIcon,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  MapPin,
  Clock,
  ScanLine,
} from 'lucide-react-native';

import { useTheme } from '@/hooks/use-theme';
import {
  PerformCheckinResult,
  usePerformCheckin,
} from '@/features/checkin/api/useCheckin';

export default function CheckinScannerScreen() {
  const router = useRouter();
  const { theme, isDark } = useTheme();
  const performCheckin = usePerformCheckin();

  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [result, setResult] = useState<PerformCheckinResult | null>(null);
  const [locating, setLocating] = useState(false);

  const scanLineAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(scanLineAnim, {
          toValue: 1,
          duration: 1800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(scanLineAnim, {
          toValue: 0,
          duration: 1800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    ).start();
  }, [scanLineAnim]);

  const handleScanned = async ({ data }: { data: string }) => {
    if (scanned || performCheckin.isPending) return;
    setScanned(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});

    let userLat: number | null = null;
    let userLng: number | null = null;
    try {
      setLocating(true);
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        userLat = loc.coords.latitude;
        userLng = loc.coords.longitude;
      }
    } catch (e) {
      // ignore: server-side will return out_of_range if needed
    } finally {
      setLocating(false);
    }

    try {
      const res = await performCheckin.mutateAsync({
        qrToken: data.trim(),
        userLat,
        userLng,
      });
      setResult(res);
      if (res.status === 'success') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
      }
    } catch (e: any) {
      setResult({
        status: 'inactive',
        message: e?.message || 'เช็กอินไม่สำเร็จ ลองใหม่อีกครั้ง',
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
    }
  };

  const reset = () => {
    setScanned(false);
    setResult(null);
  };

  // ---------- Permissions UI ----------
  if (!permission) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={[styles.permissionWrap, { backgroundColor: theme.background }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <SafeAreaView style={{ flex: 1 }}>
          <View style={styles.headerRow}>
            <TouchableOpacity
              onPress={() => router.back()}
              style={[styles.iconBtn, { backgroundColor: theme.secondary }]}
            >
              <ArrowLeft size={20} color={theme.text} />
            </TouchableOpacity>
          </View>
          <View style={styles.permissionContent}>
            <View style={[styles.permIcon, { backgroundColor: theme.primary + '15' }]}>
              <CameraIcon size={36} color={theme.primary} />
            </View>
            <Text style={[styles.permTitle, { color: theme.text }]}>
              ขอสิทธิ์ใช้กล้อง
            </Text>
            <Text style={[styles.permSub, { color: theme.mutedForeground }]}>
              แอปต้องการกล้องเพื่อสแกน QR Code สำหรับเช็กอินเข้างาน
              และตำแหน่ง GPS เพื่อยืนยันว่าคุณอยู่ในพื้นที่ที่กำหนด
            </Text>
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={requestPermission}
              style={[styles.permBtn, { backgroundColor: theme.primary }]}
            >
              <Text style={styles.permBtnText}>อนุญาตและเริ่มสแกน</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  // ---------- Scanner UI ----------
  const scanLineTranslate = scanLineAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 220],
  });

  return (
    <View style={styles.fullBlack}>
      <Stack.Screen options={{ headerShown: false }} />
      {Platform.OS !== 'web' && (
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          onBarcodeScanned={scanned ? undefined : handleScanned}
        />
      )}

      <View style={styles.overlay}>
        <View style={styles.overlayMask} />
        <View style={styles.overlayMiddle}>
          <View style={styles.overlayMask} />
          <View style={styles.scanFrame}>
            <View style={[styles.corner, styles.cornerTL]} />
            <View style={[styles.corner, styles.cornerTR]} />
            <View style={[styles.corner, styles.cornerBL]} />
            <View style={[styles.corner, styles.cornerBR]} />
            {!scanned && (
              <Animated.View
                style={[
                  styles.scanLine,
                  { transform: [{ translateY: scanLineTranslate }] },
                ]}
              />
            )}
          </View>
          <View style={styles.overlayMask} />
        </View>
        <View style={[styles.overlayMask, { flex: 1.5 }]} />
      </View>

      <SafeAreaView style={styles.safeAreaTop}>
        <View style={styles.headerRow}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.headerIconBtn}
          >
            <ArrowLeft size={22} color="#FFF" />
          </TouchableOpacity>
          <View style={styles.headerTitleWrap}>
            <Text style={styles.headerTitle}>สแกน QR เช็กอิน</Text>
            <Text style={styles.headerSubtitle}>
              ให้ QR อยู่ในกรอบเพื่อเริ่มสแกน
            </Text>
          </View>
        </View>
      </SafeAreaView>

      <SafeAreaView style={styles.safeAreaBottom}>
        <View style={styles.helperBar}>
          <ScanLine size={16} color="#FFF" />
          <Text style={styles.helperText}>
            หากแอดมินบังคับพื้นที่ จะใช้ GPS ตรวจสอบอัตโนมัติ
          </Text>
        </View>
      </SafeAreaView>

      {/* Result overlay */}
      {(performCheckin.isPending || locating || result) && (
        <View style={styles.resultBackdrop}>
          <View
            style={[
              styles.resultCard,
              { backgroundColor: theme.surface, borderColor: theme.border },
            ]}
          >
            {(performCheckin.isPending || locating) && !result ? (
              <View style={styles.resultLoading}>
                <ActivityIndicator size="large" color={theme.primary} />
                <Text style={[styles.resultLoadingText, { color: theme.text }]}>
                  {locating ? 'กำลังอ่านตำแหน่ง...' : 'กำลังบันทึกการเช็กอิน...'}
                </Text>
              </View>
            ) : result ? (
              <>
                {result.campName ? (
                  <View
                    style={[
                      styles.campBanner,
                      {
                        backgroundColor: theme.primary + '14',
                        borderColor: theme.primary + '35',
                      },
                    ]}
                  >
                    <Text style={[styles.campBannerLabel, { color: theme.mutedForeground }]}>
                      ค่าย
                    </Text>
                    <Text
                      style={[styles.campBannerTitle, { color: theme.text }]}
                      numberOfLines={2}
                    >
                      {result.campName}
                    </Text>
                    {result.eventCheckinMax != null &&
                    result.eventCheckinMax >= 1 &&
                    result.eventCheckinCount != null ? (
                      <Text style={[styles.campQuota, { color: theme.primary }]}>
                        เช็กอิน {result.eventCheckinCount}/{result.eventCheckinMax} ครั้ง (ต่อคนในค่ายนี้)
                      </Text>
                    ) : result.eventCheckinCount != null && result.campName ? (
                      <Text style={[styles.campQuotaMuted, { color: theme.mutedForeground }]}>
                        เช็กอินแล้ว {result.eventCheckinCount} ครั้ง · ไม่จำกัดจำนวนครั้ง
                      </Text>
                    ) : null}
                  </View>
                ) : null}
                <View
                  style={[
                    styles.resultIcon,
                    {
                      backgroundColor:
                        result.status === 'success'
                          ? 'rgba(16,185,129,0.15)'
                          : result.status === 'out_of_range'
                            ? 'rgba(245,158,11,0.15)'
                            : result.status === 'limit_reached'
                              ? 'rgba(245,158,11,0.15)'
                              : 'rgba(239,68,68,0.15)',
                    },
                  ]}
                >
                  {result.status === 'success' ? (
                    <CheckCircle2 size={42} color="#10B981" />
                  ) : result.status === 'out_of_range' ? (
                    <AlertTriangle size={42} color="#F59E0B" />
                  ) : result.status === 'limit_reached' ? (
                    <AlertTriangle size={42} color="#F59E0B" />
                  ) : (
                    <XCircle size={42} color="#EF4444" />
                  )}
                </View>
                <Text style={[styles.resultTitle, { color: theme.text }]}>
                  {result.status === 'success'
                    ? 'เช็กอินสำเร็จ!'
                    : result.status === 'duplicate'
                      ? 'เช็กอินซ้ำ'
                      : result.status === 'expired'
                        ? 'หมดเวลาเช็กอิน'
                        : result.status === 'out_of_range'
                          ? 'อยู่นอกพื้นที่'
                          : result.status === 'limit_reached'
                            ? 'ครบจำนวนครั้งเช็กอิน'
                            : 'เช็กอินไม่สำเร็จ'}
                </Text>
                <Text style={[styles.resultMessage, { color: theme.mutedForeground }]}>
                  {result.message}
                </Text>

                {result.session && (
                  <View
                    style={[
                      styles.metaBox,
                      { backgroundColor: theme.background, borderColor: theme.border },
                    ]}
                  >
                    <Text
                      style={[styles.metaTitle, { color: theme.text }]}
                      numberOfLines={1}
                    >
                      {result.session.title}
                    </Text>
                    <View style={styles.metaItem}>
                      <Clock size={12} color={theme.mutedForeground} />
                      <Text
                        style={[styles.metaText, { color: theme.mutedForeground }]}
                      >
                        {new Date(result.session.start_time).toLocaleTimeString('th-TH', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}{' '}
                        -{' '}
                        {new Date(result.session.end_time).toLocaleTimeString('th-TH', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </Text>
                    </View>
                    {result.session.location_name ? (
                      <View style={styles.metaItem}>
                        <MapPin size={12} color={theme.mutedForeground} />
                        <Text
                          style={[styles.metaText, { color: theme.mutedForeground }]}
                          numberOfLines={1}
                        >
                          {result.session.location_name}
                        </Text>
                      </View>
                    ) : null}
                    {result.distanceMeters != null ? (
                      <View style={styles.metaItem}>
                        <MapPin size={12} color={theme.mutedForeground} />
                        <Text
                          style={[styles.metaText, { color: theme.mutedForeground }]}
                        >
                          ห่างจากจุด {result.distanceMeters} ม.
                        </Text>
                      </View>
                    ) : null}
                  </View>
                )}

                <View style={styles.resultActions}>
                  <TouchableOpacity
                    onPress={reset}
                    style={[
                      styles.resultBtn,
                      { backgroundColor: theme.secondary, borderColor: theme.border },
                    ]}
                    activeOpacity={0.85}
                  >
                    <RefreshCw size={16} color={theme.text} />
                    <Text style={{ color: theme.text, fontWeight: '900' }}>
                      สแกนใหม่
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => router.back()}
                    style={[
                      styles.resultBtn,
                      { backgroundColor: theme.text },
                    ]}
                    activeOpacity={0.85}
                  >
                    <Text style={{ color: theme.background, fontWeight: '900' }}>
                      เสร็จสิ้น
                    </Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : null}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  fullBlack: { flex: 1, backgroundColor: '#000' },

  // Permission state
  permissionWrap: { flex: 1 },
  permissionContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    gap: 14,
  },
  permIcon: {
    width: 96,
    height: 96,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  permTitle: { fontSize: 24, fontWeight: '900' },
  permSub: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  permBtn: {
    height: 54,
    paddingHorizontal: 32,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
  },
  permBtnText: { color: '#FFF', fontSize: 15, fontWeight: '900' },

  // Header
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 12,
  },
  iconBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerIconBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  headerTitleWrap: { flex: 1 },
  headerTitle: { color: '#FFF', fontSize: 18, fontWeight: '900' },
  headerSubtitle: { color: 'rgba(255,255,255,0.75)', fontSize: 12, fontWeight: '700' },

  // Scanner overlay
  overlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'flex-start' },
  overlayMask: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' },
  overlayMiddle: { flexDirection: 'row', height: 240 },
  scanFrame: {
    width: 240,
    height: 240,
    borderRadius: 24,
    overflow: 'hidden',
  },
  corner: {
    position: 'absolute',
    width: 36,
    height: 36,
    borderColor: '#FFF',
  },
  cornerTL: {
    top: 0,
    left: 0,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderTopLeftRadius: 18,
  },
  cornerTR: {
    top: 0,
    right: 0,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderTopRightRadius: 18,
  },
  cornerBL: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderBottomLeftRadius: 18,
  },
  cornerBR: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderBottomRightRadius: 18,
  },
  scanLine: {
    position: 'absolute',
    left: 12,
    right: 12,
    height: 3,
    borderRadius: 2,
    backgroundColor: '#10B981',
    top: 12,
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7,
    shadowRadius: 8,
  },

  safeAreaTop: { position: 'absolute', top: 0, left: 0, right: 0 },
  safeAreaBottom: { position: 'absolute', bottom: 0, left: 0, right: 0 },
  helperBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
    paddingVertical: 14,
    backgroundColor: 'rgba(0,0,0,0.6)',
    marginHorizontal: 24,
    marginBottom: 24,
    borderRadius: 22,
    gap: 8,
  },
  helperText: { color: '#FFF', fontSize: 12, fontWeight: '700' },

  // Result
  resultBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  resultCard: {
    width: '100%',
    maxWidth: 380,
    borderRadius: 28,
    padding: 24,
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
  },
  campBanner: {
    width: '100%',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 4,
  },
  campBannerLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 1.2, marginBottom: 4 },
  campBannerTitle: { fontSize: 17, fontWeight: '900', textAlign: 'center', lineHeight: 22 },
  campQuota: { fontSize: 13, fontWeight: '800', marginTop: 8, textAlign: 'center' },
  campQuotaMuted: { fontSize: 12, fontWeight: '700', marginTop: 8, textAlign: 'center' },
  resultLoading: { alignItems: 'center', gap: 12 },
  resultLoadingText: { fontSize: 15, fontWeight: '800' },
  resultIcon: {
    width: 84,
    height: 84,
    borderRadius: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultTitle: { fontSize: 22, fontWeight: '900', textAlign: 'center' },
  resultMessage: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 20,
  },
  metaBox: {
    width: '100%',
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
    gap: 8,
  },
  metaTitle: { fontSize: 15, fontWeight: '900' },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaText: { fontSize: 12, fontWeight: '700' },
  resultActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
    width: '100%',
  },
  resultBtn: {
    flex: 1,
    height: 50,
    borderRadius: 25,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: 'transparent',
  },
});
