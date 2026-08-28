import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { CameraView, useCameraPermissions, useMicrophonePermissions, type CameraType, type FlashMode } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import * as FileSystem from 'expo-file-system';
import { Check, ChevronLeft, Image as ImageIcon, RefreshCcw, Undo2, X, Zap, ZapOff, Settings2, Video as VideoIcon, Camera as CameraIcon } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, runOnJS } from 'react-native-reanimated';
import {
  HOME_VIDEO_MAX_MS,
  assetToHomeMedia,
  assertVideoWithinLimit,
  formatDurationLabel,
  type HomeCapturedMedia,
  type HomeMediaPickMode,
} from '@/features/home/homeMedia';
import { fixFrontCameraPhoto } from '@/features/home/fixFrontCameraPhoto';
import { BlurView } from 'expo-blur';
import { useIsFocused } from '@react-navigation/native';

type CaptureKind = 'photo' | 'video';

type Props = {
  mode: HomeMediaPickMode;
  onModeChange: (mode: HomeMediaPickMode) => void;
  onClose: () => void;
  onCaptured: (media: HomeCapturedMedia | HomeCapturedMedia[], flowMode: HomeMediaPickMode) => void;
  initialGallery?: boolean;
  multiple?: boolean;
};

export function HomeCreateCamera({ mode, onModeChange, onClose, onCaptured, initialGallery, multiple }: Props) {
  const [permission, requestPermission] = useCameraPermissions();
  const [micPermission, requestMicPermission] = useMicrophonePermissions();
  const galleryTriggeredRef = useRef(false);
  const cameraRef = useRef<CameraView>(null);
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();
  const { width: screenW, height: screenH } = useWindowDimensions();
  const [facing, setFacing] = useState<CameraType>('back');
  const [flash, setFlash] = useState<FlashMode>('off');
  const [captureKind, setCaptureKind] = useState<CaptureKind>('photo');
  const [isRecording, setIsRecording] = useState(false);
  const [recordMs, setRecordMs] = useState(0);
  const recordMsRef = useRef(0);
  const isRecordingRef = useRef(false);
  const isCapturingRef = useRef(false);
  const [zoom, setZoomState] = useState(0);
  const zoomRef = useRef(0);
  const setZoom = (val: number) => {
    setZoomState(val);
    zoomRef.current = val;
  };
  const startZoomRef = useRef(0);
  const [clips, setClips] = useState<{ uri: string; durationMs: number }[]>([]);
  const pendingResumeRef = useRef(false);
  const isCameraReadyRef = useRef(false);

  const pressStartRef = useRef(0);
  const startedByThisPressRef = useRef(false);

  const isStory = mode === 'story';
  const cameraMode = !isStory || captureKind === 'photo' ? 'picture' : 'video';
  const frameAspect = isStory ? 9 / 16 : 1;

  const guideW = Math.min(screenW * 0.88, (screenH * 0.55) * frameAspect);
  const guideH = guideW / frameAspect;

  useEffect(() => {
    isRecordingRef.current = isRecording;
  }, [isRecording]);

  useEffect(() => {
    if (!isStory) setCaptureKind('photo');
  }, [isStory]);

  useEffect(() => {
    if (!isRecording) {
      recordMsRef.current = 0;
      setRecordMs(0);
      return;
    }
    const id = setInterval(() => {
      const totalPast = clips.reduce((acc, c) => acc + c.durationMs, 0);
      const current = Math.min(recordMsRef.current + 200, HOME_VIDEO_MAX_MS - totalPast);
      recordMsRef.current = current;
      setRecordMs(current);
      if (totalPast + current >= HOME_VIDEO_MAX_MS) {
        cameraRef.current?.stopRecording();
      }
    }, 200);
    return () => clearInterval(id);
  }, [isRecording]);

  // Clean up cache on unmount
  useEffect(() => {
    return () => {
      // Delete any leftover clips that weren't finalized
      clips.forEach((c) => {
        void FileSystem.deleteAsync(c.uri, { idempotent: true });
      });
    };
  }, [clips]);

  useEffect(() => {
    if (initialGallery && !galleryTriggeredRef.current) {
      galleryTriggeredRef.current = true;
      setTimeout(() => {
        void pickLibrary();
      }, 500);
    }
  }, [initialGallery]);

  const finishCapture = useCallback(
    (media: HomeCapturedMedia) => {
      try {
        assertVideoWithinLimit(media);
        onCaptured(media, mode);
      } catch (e) {
        Alert.alert('วิดีโอไม่ถูกต้อง', e instanceof Error ? e.message : 'ลองใหม่');
      }
    },
    [mode, onCaptured],
  );

  const pickLibrary = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('ต้องการการเข้าถึง', 'กรุณาอนุญาตการเข้าถึงรูปภาพเพื่อเลือกรูปจากคลัง');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: isStory ? ['images', 'videos'] : ['images'],
      allowsEditing: !isStory && !multiple,
      allowsMultipleSelection: multiple,
      selectionLimit: multiple ? 10 : 1,
      aspect: isStory ? [9, 16] : [1, 1],
      quality: 0.88,
      base64: !isStory,
      videoMaxDuration: 60,
      exif: false,
    });
    if (result.canceled || !result.assets.length) return;
    if (multiple && result.assets.length > 1) {
      onCaptured(result.assets.map(assetToHomeMedia), mode);
    } else {
      finishCapture(assetToHomeMedia(result.assets[0]));
    }
  };

  const takePhoto = async () => {
    if (!cameraRef.current || isCapturingRef.current) return;
    isCapturingRef.current = true;
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const needBase64 = !isStory;
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.88,
        base64: needBase64,
      });
      if (!photo?.uri) return;
      const fixed = await fixFrontCameraPhoto(photo.uri, facing, needBase64);
      finishCapture({
        uri: fixed.uri,
        mediaType: 'image',
        width: photo.width,
        height: photo.height,
        base64: fixed.base64 ?? photo.base64 ?? undefined,
      });
    } catch {
      Alert.alert('ถ่ายรูปไม่สำเร็จ', 'ลองอีกครั้ง');
    } finally {
      isCapturingRef.current = false;
    }
  };

  const toggleRecord = async () => {
    if (!cameraRef.current) return;
    if (isRecording) {
      try {
        cameraRef.current.stopRecording();
      } catch {
        setIsRecording(false);
      }
      return;
    }
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      setIsRecording(true);
      recordMsRef.current = 0;
      setRecordMs(0);
      const video = await cameraRef.current.recordAsync({ maxDuration: 60 });
      setIsRecording(false);
      if (video?.uri) {
        const durationMs = Math.max(recordMsRef.current, 500);
        setClips((prev) => [...prev, { uri: video.uri, durationMs }]);
      }
    } catch {
      setIsRecording(false);
      Alert.alert('บันทึกวิดีโอไม่สำเร็จ', 'ลองอีกครั้ง');
    }
  };

  const finalizeClips = () => {
    if (clips.length === 0) return;
    const totalDuration = clips.reduce((acc, c) => acc + c.durationMs, 0);
    finishCapture({
      uri: clips[0].uri,
      mediaType: 'video',
      durationMs: totalDuration,
      mimeType: 'video/mp4',
      clips: clips.map((c) => c.uri),
    });
  };

  const removeLastClip = () => {
    const last = clips[clips.length - 1];
    if (last) {
      void FileSystem.deleteAsync(last.uri, { idempotent: true });
    }
    setClips((prev) => prev.slice(0, -1));
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  };

  const onShutter = () => {
    if (isStory && captureKind === 'video') {
      void toggleRecord();
    } else {
      void takePhoto();
    }
  };

  const switchMode = (m: HomeMediaPickMode) => {
    if (isRecording) return;
    onModeChange(m);
  };

  const pinchGesture = Gesture.Pinch()
    .onStart(() => {
      startZoomRef.current = zoomRef.current;
    })
    .onUpdate((e) => {
      // ปรับให้การซูมด้วยนิ้วมีความละเอียดและสอดคล้องกับฮาร์ดแวร์
      const target = startZoomRef.current + (e.scale - 1) * 0.4;
      const nextZoom = Math.min(1, Math.max(0, target));
      runOnJS(setZoom)(nextZoom);
    });

  const handleDoubleTap = () => {
    if (isRecording) {
      pendingResumeRef.current = true;
      cameraRef.current?.stopRecording();
    }
    setFacing((f) => (f === 'back' ? 'front' : 'back'));
    Haptics.selectionAsync();
  };

  const doubleTapGesture = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      runOnJS(handleDoubleTap)();
    });

  const onCameraReady = () => {
    isCameraReadyRef.current = true;
    if (pendingResumeRef.current) {
      pendingResumeRef.current = false;
      setTimeout(() => {
        void toggleRecord();
      }, 500);
    }
  };

  const cameraGestures = Gesture.Simultaneous(pinchGesture, doubleTapGesture);

  const shutterGesture = Gesture.Pan()
    .onBegin(() => {
      runOnJS(() => {
        pressStartRef.current = Date.now();
        if (!isRecording && isStory && captureKind === 'video') {
          void toggleRecord();
          startedByThisPressRef.current = true;
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        } else {
          startedByThisPressRef.current = false;
        }
      })();
    })
    .onUpdate((e) => {
      if (isRecording) {
        const delta = -e.translationY / 250;
        const nextZoom = Math.min(1, Math.max(0, zoomRef.current + delta));
        runOnJS(setZoom)(nextZoom);
      }
    })
    .onEnd(() => {
      runOnJS(() => {
        const duration = Date.now() - pressStartRef.current;
        if (isRecording) {
          if (duration > 400) {
            void toggleRecord();
          } else if (!startedByThisPressRef.current) {
            void toggleRecord();
          }
        } else {
          if (duration < 400) {
            void takePhoto();
          }
        }
      })();
    });

  const shutterGestures = shutterGesture;

  const [activeZoomLevel, setActiveZoomLevel] = useState(0.1);

  const setZoomLevel = (val: number) => {
    setZoom(val);
    setActiveZoomLevel(val);
    Haptics.selectionAsync();
  };

  const zoomLevels = [
    { label: '.5', value: 0 },
    { label: '1', value: 0.1 },
    { label: '2', value: 0.3 },
    { label: '5', value: 0.7 }
  ];

  const requestAllPermissions = async () => {
    const cam = await requestPermission();
    if (cam.granted) {
      await requestMicPermission();
    }
  };

  if (!permission?.granted || !micPermission?.granted) {
    return (
      <View style={[styles.root, styles.permission]}>
        <Text style={styles.permissionText}>อนุญาตกล้องและไมโครโฟนเพื่อถ่ายรูปและวิดีโอ</Text>
        <TouchableOpacity style={styles.permissionBtn} onPress={requestAllPermissions}>
          <Text style={styles.permissionBtnText}>อนุญาตทั้งหมด</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onClose} style={{ marginTop: 16 }}>
          <Text style={{ color: '#aaa' }}>ยกเลิก</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <GestureDetector gesture={cameraGestures}>
      <View style={styles.root}>
        {isFocused ? (
          <CameraView
            ref={cameraRef}
            style={StyleSheet.absoluteFill}
            facing={facing}
            flash={flash}
            mode={cameraMode}
            mirror={facing === 'front'}
            zoom={zoom}
            enableTorch={flash === 'on'}
            onCameraReady={onCameraReady}
          />
        ) : (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: '#000' }]} />
        )}

        {!isRecording && (
          <View style={[styles.sideToolbarLeft, { top: insets.top + 100 }]}>
            <BlurView intensity={45} tint="dark" style={styles.toolCircle}>
              <TouchableOpacity onPress={() => setFlash((f) => (f === 'off' ? 'on' : 'off'))} style={styles.toolBtn}>
                {flash === 'on' ? <Zap color="#FFD60A" size={24} fill="#FFD60A" /> : <ZapOff color="#fff" size={24} />}
              </TouchableOpacity>
            </BlurView>
          </View>
        )}

      <LinearGradient
        colors={['rgba(0,0,0,0.45)', 'transparent']}
        style={[styles.topGradient, { paddingTop: insets.top }]}
        pointerEvents="none"
      />
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.75)']}
        style={styles.bottomGradient}
        pointerEvents="none"
      />

      {!isRecording && (
        <View style={[styles.topBar, { paddingTop: insets.top + 12 }]} pointerEvents="box-none">
          <BlurView intensity={30} tint="dark" style={styles.topBlur}>
            <TouchableOpacity onPress={onClose} style={styles.topIconBtn}>
              <X color="#fff" size={24} />
            </TouchableOpacity>
          </BlurView>
        </View>
      )}

      {captureKind === 'video' && (
        <View style={[styles.segmentContainer, { top: insets.top + 50 }]}>
          {clips.map((c, i) => (
            <View key={i} style={[styles.segment, { flex: c.durationMs / HOME_VIDEO_MAX_MS }]} />
          ))}
          {isRecording && (
            <View style={[styles.segment, styles.segmentActive, { flex: recordMs / HOME_VIDEO_MAX_MS }]} />
          )}
        </View>
      )}

        {isStory && captureKind === 'video' ?
          <View style={[styles.recBadge, { top: insets.top + 64 }]} pointerEvents="none">
            <BlurView intensity={40} tint="dark" style={styles.recBlur}>
              <View style={styles.recDot} />
              <Text style={styles.recText}>{formatDurationLabel(recordMs)}</Text>
            </BlurView>
          </View>
        : null}

        <View style={[styles.bottom, { paddingBottom: insets.bottom + 16 }]} pointerEvents="box-none">
          <View style={styles.zoomContainer}>
            {zoomLevels.map((lvl) => {
              const isSelected = activeZoomLevel === lvl.value;
              return (
                <TouchableOpacity
                  key={lvl.label}
                  onPress={() => setZoomLevel(lvl.value)}
                  style={[styles.zoomPill, isSelected && styles.zoomPillOn]}
                >
                  <Text style={[styles.zoomLabel, isSelected && styles.zoomLabelOn]}>{lvl.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <BlurView intensity={25} tint="dark" style={[styles.bottomControlsWrap, isRecording && { backgroundColor: 'transparent', borderWidth: 0 }]}>
          {!isRecording && (
            <View style={styles.modeRow}>
              {(['post', 'story'] as const).map((m) => (
                <TouchableOpacity key={m} onPress={() => switchMode(m)} style={styles.modeTap} disabled={isRecording}>
                  <Text style={[styles.modeLabel, mode === m && styles.modeLabelOn]}>
                    {m === 'post' ? 'POST' : 'STORY'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {!isRecording && (
            isStory ?
              <View style={styles.kindRow}>
                {(['photo', 'video'] as const).map((k) => (
                  <TouchableOpacity
                    key={k}
                    onPress={() => {
                      if (isRecording) return;
                      setCaptureKind(k);
                    }}
                    style={[styles.kindPill, captureKind === k && styles.kindPillOn]}
                    disabled={isRecording}
                  >
                    <Text style={[styles.kindText, captureKind === k && styles.kindTextOn]}>
                      {k === 'photo' ? 'PHOTO' : 'VIDEO'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            : <View style={styles.kindSpacer} />
          )}

          <View style={styles.controls}>
            {!isRecording && (
              <TouchableOpacity onPress={pickLibrary} style={styles.sideBtn}>
                <View style={styles.sideBtnInner}>
                  <ImageIcon color="#fff" size={24} />
                </View>
              </TouchableOpacity>
            )}
            {isRecording && <View style={styles.sideBtn} />}

            <View style={styles.sideBtn}>
              {clips.length > 0 && !isRecording && (
                <TouchableOpacity onPress={removeLastClip} style={styles.undoBtn}>
                  <Undo2 color="#fff" size={20} />
                </TouchableOpacity>
              )}
            </View>

            <GestureDetector gesture={shutterGestures}>
              <TouchableOpacity style={styles.shutterOuter} activeOpacity={0.9}>
                <View style={[
                  styles.shutterRing,
                  (isRecording || (isStory && captureKind === 'video')) && { borderColor: '#ff3040' },
                  isRecording && { transform: [{ scale: 1.1 }] }
                ]}>
                  <View
                    style={[
                      styles.shutterInner,
                      (isRecording || (isStory && captureKind === 'video')) && styles.shutterVideo,
                      isRecording && styles.shutterRec,
                    ]}
                  />
                </View>
              </TouchableOpacity>
            </GestureDetector>

            <View style={styles.sideBtn}>
              {!isRecording && clips.length > 0 && (
                <TouchableOpacity onPress={finalizeClips} style={styles.doneBtn}>
                  <Check color="#fff" size={22} />
                </TouchableOpacity>
              )}
            </View>

            {!isRecording && (
              <TouchableOpacity
                onPress={() => {
                  setFacing((f) => (f === 'back' ? 'front' : 'back'));
                  Haptics.selectionAsync();
                }}
                style={styles.sideBtn}
              >
                <View style={styles.sideBtnInner}>
                  <RefreshCcw color="#fff" size={24} />
                </View>
              </TouchableOpacity>
            )}
            {isRecording && <View style={styles.sideBtn} />}
          </View>
        </BlurView>
        <Text style={styles.hint}>
          {isStory && captureKind === 'video' ?
            isRecording ? 'TAP TO STOP'
            : 'TAP TO RECORD'
          : 'TAP TO TAKE PHOTO'}
        </Text>
      </View>
    </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  permission: { justifyContent: 'center', alignItems: 'center', padding: 32 },
  permissionText: { color: '#fff', fontSize: 16, textAlign: 'center', marginBottom: 20 },
  permissionBtn: {
    backgroundColor: '#3897f0',
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 12,
  },
  permissionBtnText: { color: '#fff', fontWeight: '800' },
  topGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 120,
    zIndex: 4,
  },
  bottomGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 280,
    zIndex: 4,
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    alignItems: 'center',
  },
  topBlur: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius: 24,
    paddingHorizontal: 8,
    paddingVertical: 6,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  topIconBtn: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topDivider: {
    width: 1,
    height: 16,
    backgroundColor: 'rgba(255,255,255,0.2)',
    marginHorizontal: 4,
  },
  recBadge: {
    position: 'absolute',
    alignSelf: 'center',
    zIndex: 100,
  },
  recBlur: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,0,0,0.3)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,50,60,0.4)',
  },
  recDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#ff3040' },
  recText: { color: '#fff', fontWeight: '800', fontSize: 13, fontVariant: ['tabular-nums'] },
  bottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 100,
    alignItems: 'center',
  },
  bottomControlsWrap: {
    width: '92%',
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 32,
    paddingVertical: 20,
    paddingHorizontal: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
  },
  modeRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 16,
    padding: 3,
    marginBottom: 16,
  },
  modeTap: {
    paddingHorizontal: 20,
    paddingVertical: 6,
    borderRadius: 13,
  },
  modeLabel: {
    color: 'rgba(255,255,255,0.5)',
    fontWeight: '800',
    fontSize: 11,
    letterSpacing: 1,
  },
  modeLabelOn: {
    color: '#fff',
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  kindRow: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  kindSpacer: { height: 10 },
  kindPill: {
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  kindPillOn: {
    backgroundColor: '#fff',
    borderColor: '#fff',
  },
  kindText: { color: 'rgba(255,255,255,0.6)', fontWeight: '800', fontSize: 11 },
  kindTextOn: { color: '#000' },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  sideBtn: {
    width: 54,
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sideBtnInner: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  undoBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#34C759',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  shutterOuter: {
    width: 84,
    height: 84,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterRing: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 4,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterInner: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: '#fff',
  },
  shutterVideo: {
    backgroundColor: '#ff3040',
  },
  shutterRec: {
    borderRadius: 10,
    width: 32,
    height: 32,
    backgroundColor: '#ff3040',
  },
  hint: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 11,
    marginTop: 14,
    fontWeight: '700',
    letterSpacing: 0.5,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },

  sideToolbarLeft: {
    position: 'absolute',
    left: 16,
    zIndex: 100,
  },
  sideToolbarRight: {
    position: 'absolute',
    right: 16,
    zIndex: 100,
  },
  toolCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  toolBtn: {
    width: 50,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qualityText: { color: '#fff', fontSize: 12, fontWeight: '900' },

  zoomContainer: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: 'rgba(0,0,0,0.4)',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    marginBottom: 20,
  },
  zoomPill: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  zoomPillOn: { backgroundColor: '#fff' },
  zoomLabel: { color: '#fff', fontSize: 10, fontWeight: '800' },
  zoomLabelOn: { color: '#000' },
  segmentContainer: {
    flexDirection: 'row',
    position: 'absolute',
    left: 8,
    right: 8,
    height: 4,
    gap: 4,
    zIndex: 100,
  },
  segment: {
    height: '100%',
    backgroundColor: 'rgba(255,255,255,0.4)',
    borderRadius: 2,
  },
  segmentActive: {
    backgroundColor: '#ff3040',
  },
});
