import type { CameraType } from 'expo-camera';
import * as FileSystem from 'expo-file-system';
import { FlipType, manipulateAsync, SaveFormat } from 'expo-image-manipulator';

/** พลิกรูปให้ตรงกับที่เห็นในพรีวิว และแก้ปัญหาองศาภาพ (Rotation) */
export async function fixFrontCameraPhoto(
  uri: string,
  facing: CameraType,
  withBase64: boolean,
): Promise<{ uri: string; base64?: string }> {
  const actions: any[] = [];
  if (facing === 'front') {
    actions.push({ flip: FlipType.Horizontal });
  }

  // แม้จะเป็นกล้องหลัง ก็ควรผ่าน manipulateAsync เพื่อ "อบ" (bake) องศาภาพให้ถูกต้อง
  const result = await manipulateAsync(uri, actions, {
    compress: 0.88,
    format: SaveFormat.JPEG,
    base64: withBase64,
  });
  return { uri: result.uri, base64: result.base64 };
}

export async function deleteCapturedMediaFile(uri: string): Promise<void> {
  if (!uri.startsWith('file://')) return;
  try {
    const info = await FileSystem.getInfoAsync(uri);
    if (info.exists) await FileSystem.deleteAsync(uri, { idempotent: true });
  } catch {
    // ignore
  }
}
