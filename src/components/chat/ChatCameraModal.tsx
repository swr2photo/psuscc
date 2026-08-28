import React, { useRef, useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Text,
  Modal,
  Platform,
  Alert,
  useWindowDimensions,
} from 'react-native';
import { CameraView, CameraType, useCameraPermissions, FlashMode } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { X, RefreshCcw, Zap, ZapOff, Image as ImageIcon, Circle } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeIn, FadeOut, Layout } from 'react-native-reanimated';

interface ChatCameraModalProps {
  visible: boolean;
  onClose: () => void;
  onCapture: (asset: ImagePicker.ImagePickerAsset) => void;
}

type CameraMode = 'photo' | 'video';

export function ChatCameraModal({ visible, onClose, onCapture }: ChatCameraModalProps) {
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const [facing, setFacing] = useState<CameraType>('back');
  const [flash, setFlash] = useState<FlashMode>('off');
  const [mode, setMode] = useState<CameraMode>('photo');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const { top, bottom } = useSafeAreaInsets();
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (isRecording) {
      timerRef.current = setInterval(() => {
        setRecordingDuration((d) => d + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      setRecordingDuration(0);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRecording]);

  if (!permission) return null;

  if (!permission.granted && visible) {
    return (
      <Modal visible={visible} animationType="slide">
        <View style={styles.permissionContainer}>
          <Text style={styles.permissionText}>เราต้องการเข้าถึงกล้องเพื่อถ่ายรูปและวิดีโอ</Text>
          <TouchableOpacity style={styles.permissionBtn} onPress={requestPermission}>
            <Text style={styles.permissionBtnText}>อนุญาตสิทธิ์กล้อง</Text>
          </TouchableOpacity>
          <TouchableOpacity style={{ marginTop: 20 }} onPress={onClose}>
            <Text style={{ color: '#666' }}>ยกเลิก</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    );
  }

  const toggleFacing = () => {
    setFacing((f) => (f === 'back' ? 'front' : 'back'));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const toggleFlash = () => {
    setFlash((f) => (f === 'off' ? 'on' : 'off'));
  };

  const pickFromLibrary = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: mode === 'photo' ? ['images'] : ['videos'],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      onCapture(result.assets[0]);
      onClose();
    }
  };

  const handleCapture = async () => {
    if (!cameraRef.current) return;
    Haptics.selectionAsync();

    if (mode === 'photo') {
      try {
        const photo = await cameraRef.current.takePictureAsync({
          quality: 0.8,
          base64: true,
        });
        if (photo) {
          onCapture({
            uri: photo.uri,
            width: photo.width,
            height: photo.height,
            type: 'image',
          } as any);
          onClose();
        }
      } catch (e) {
        Alert.alert('เกิดข้อผิดพลาด', 'ไม่สามารถถ่ายรูปได้');
      }
    } else {
      if (isRecording) {
        await cameraRef.current.stopRecording();
        setIsRecording(false);
      } else {
        try {
          setIsRecording(true);
          const video = await cameraRef.current.recordAsync();
          if (video) {
            onCapture({
              uri: video.uri,
              type: 'video',
            } as any);
            onClose();
          }
        } catch (e) {
          setIsRecording(false);
          Alert.alert('เกิดข้อผิดพลาด', 'ไม่สามารถบันทึกวิดีโอได้');
        }
      }
    }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <Modal visible={visible} animationType="slide" statusBarTranslucent>
      <View style={styles.container}>
        {visible && (
          <CameraView
            ref={cameraRef}
            style={StyleSheet.absoluteFill}
            facing={facing}
            flash={flash}
            mode={mode as any}
            enableTorch={flash === 'on'}
          />
        )}

        {/* Glossy Top Overlay */}
        <LinearGradient
          colors={['rgba(0,0,0,0.4)', 'transparent']}
          style={styles.topGradient}
        />

        {/* Top Controls */}
        <View style={[styles.topControls, { top: top + 10 }]}>
          <TouchableOpacity onPress={onClose} style={styles.glassBtn}>
            <X color="#FFF" size={24} />
          </TouchableOpacity>
          
          <View style={styles.topRight}>
            <TouchableOpacity onPress={toggleFlash} style={styles.glassBtn}>
              {flash === 'on' ? <Zap color="#FFD60A" size={22} fill="#FFD60A" /> : <ZapOff color="#FFF" size={22} />}
            </TouchableOpacity>
          </View>
        </View>

        {/* Recording Indicator */}
        {isRecording && (
          <Animated.View entering={FadeIn} exiting={FadeOut} style={[styles.recordingIndicator, { top: top + 60 }]}>
            <View style={styles.redDot} />
            <Text style={styles.durationText}>{formatTime(recordingDuration)}</Text>
          </Animated.View>
        )}

        {/* Bottom Overlay Gradient */}
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.6)']}
          style={styles.bottomGradient}
        />

        {/* Bottom UI */}
        <View style={[styles.bottomContainer, { paddingBottom: Math.max(bottom, 20) }]}>
          {/* Mode Selector */}
          {!isRecording && (
            <View style={styles.modeSelector}>
              <TouchableOpacity onPress={() => setMode('photo')} style={styles.modeBtn}>
                <Text style={[styles.modeText, mode === 'photo' && styles.modeTextActive]}>PHOTO</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setMode('video')} style={styles.modeBtn}>
                <Text style={[styles.modeText, mode === 'video' && styles.modeTextActive]}>VIDEO</Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.mainControls}>
            <TouchableOpacity 
              onPress={pickFromLibrary} 
              style={styles.glassBtnCircle}
              disabled={isRecording}
            >
              <ImageIcon color="#FFF" size={24} />
            </TouchableOpacity>

            <TouchableOpacity 
              onPress={handleCapture} 
              activeOpacity={0.8}
              style={styles.captureButtonContainer}
            >
              <View style={[
                styles.captureInner, 
                mode === 'video' && styles.captureInnerVideo,
                isRecording && styles.captureInnerRecording
              ]}>
                {mode === 'photo' && !isRecording && (
                   <View style={styles.photoInnerCircle} />
                )}
              </View>
            </TouchableOpacity>

            <TouchableOpacity onPress={toggleFacing} style={styles.glassBtnCircle}>
              <RefreshCcw color="#FFF" size={24} />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  topGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 140,
  },
  bottomGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 220,
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    backgroundColor: '#FFF',
  },
  permissionText: {
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 24,
    color: '#333',
  },
  permissionBtn: {
    backgroundColor: '#007AFF',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
  },
  permissionBtnText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 16,
  },
  topControls: {
    position: 'absolute',
    left: 20,
    right: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 10,
  },
  topRight: {
    flexDirection: 'row',
    gap: 12,
  },
  glassBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  glassBtnCircle: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  recordingIndicator: {
    position: 'absolute',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,0,0,0.8)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 8,
    shadowColor: '#FF0000',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
  },
  redDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FFF',
  },
  durationText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  bottomContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    gap: 32,
    paddingTop: 20,
  },
  modeSelector: {
    flexDirection: 'row',
    gap: 32,
  },
  modeBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  modeText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  modeTextActive: {
    color: '#FFF',
  },
  mainControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 40,
    marginBottom: 10,
  },
  captureButtonContainer: {
    width: 84,
    height: 84,
    borderRadius: 42,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  captureInner: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#FFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  photoInnerCircle: {
    width: 62,
    height: 62,
    borderRadius: 31,
    borderWidth: 2,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  captureInnerVideo: {
    backgroundColor: '#FF3B30',
  },
  captureInnerRecording: {
    width: 32,
    height: 32,
    borderRadius: 6,
    backgroundColor: '#FF3B30',
  },
});
