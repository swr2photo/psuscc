import { Alert, Platform, Share } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';
import type { HomePost } from './types';

function shareMessage(post: HomePost, handle: string): string {
  const lines = [`@${handle} บน PSUSCC`];
  if (post.caption?.trim()) lines.push(post.caption.trim());
  lines.push(post.image_url);
  return lines.join('\n');
}

export async function shareHomePostExternally(post: HomePost, handle: string): Promise<void> {
  const message = shareMessage(post, handle);
  try {
    await Share.share({
      message,
      url: Platform.OS === 'ios' ? post.image_url : undefined,
      title: 'แชร์โพสต์',
    });
  } catch {
    /* dismissed */
  }
}

export async function saveHomePostImageToDevice(imageUrl: string): Promise<void> {
  const ext = imageUrl.toLowerCase().includes('.png') ? 'png' : 'jpg';
  const dest = `${FileSystem.cacheDirectory}psuscc-post-${Date.now()}.${ext}`;
  const { uri } = await FileSystem.downloadAsync(imageUrl, dest);

  const perm = await MediaLibrary.requestPermissionsAsync();
  if (perm.granted) {
    await MediaLibrary.saveToLibraryAsync(uri);
    return;
  }

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, {
      mimeType: ext === 'png' ? 'image/png' : 'image/jpeg',
      dialogTitle: 'บันทึกรูป',
    });
    return;
  }

  Alert.alert('บันทึกไม่สำเร็จ', 'ไม่สามารถบันทึกรูปบนอุปกรณ์นี้ได้');
}
