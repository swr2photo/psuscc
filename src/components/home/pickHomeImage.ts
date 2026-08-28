import * as ImagePicker from 'expo-image-picker';
import { Alert } from 'react-native';

export async function pickHomeImage(): Promise<ImagePicker.ImagePickerAsset | null> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) {
    Alert.alert('ต้องการสิทธิ์', 'อนุญาตเข้าถึงรูปภาพเพื่ออัปโหลด');
    return null;
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.85,
    base64: true,
    exif: false,
  });

  if (result.canceled || !result.assets[0]) return null;
  return result.assets[0];
}
