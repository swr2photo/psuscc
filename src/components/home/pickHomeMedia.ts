import * as ImagePicker from 'expo-image-picker';
import { Alert, Platform } from 'react-native';

export type HomeMediaPickMode = 'post' | 'story';

const ASPECT: Record<HomeMediaPickMode, [number, number]> = {
  post: [1, 1],
  story: [9, 16],
};

async function requestLibraryPerm(): Promise<boolean> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (perm.granted) return true;
  Alert.alert('ต้องการสิทธิ์', 'อนุญาตเข้าถึงรูปภาพเพื่ออัปโหลด');
  return false;
}

async function requestCameraPerm(): Promise<boolean> {
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (perm.granted) return true;
  Alert.alert('ต้องการสิทธิ์', 'อนุญาตใช้กล้องเพื่อถ่ายรูป');
  return false;
}

export async function pickHomeMediaFromLibrary(
  mode: HomeMediaPickMode,
): Promise<ImagePicker.ImagePickerAsset | null> {
  if (!(await requestLibraryPerm())) return null;

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: ASPECT[mode],
    quality: 0.88,
    base64: true,
    exif: false,
  });

  if (result.canceled || !result.assets[0]) return null;
  return result.assets[0];
}

export async function captureHomeMedia(
  mode: HomeMediaPickMode,
): Promise<ImagePicker.ImagePickerAsset | null> {
  if (Platform.OS === 'web') {
    Alert.alert('ไม่รองรับบนเว็บ', 'ใช้เลือกรูปจากคลังแทน');
    return pickHomeMediaFromLibrary(mode);
  }
  if (!(await requestCameraPerm())) return null;

  const result = await ImagePicker.launchCameraAsync({
    allowsEditing: Platform.OS === 'ios',
    aspect: ASPECT[mode],
    quality: 0.88,
    base64: true,
    exif: false,
  });

  if (result.canceled || !result.assets[0]) return null;
  return result.assets[0];
}

/** @deprecated use pickHomeMediaFromLibrary */
export async function pickHomeImage(): Promise<ImagePicker.ImagePickerAsset | null> {
  return pickHomeMediaFromLibrary('post');
}
