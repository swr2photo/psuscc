import { decode } from 'base64-arraybuffer';
import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';
import { supabase } from '@/lib/supabase';
import { STORAGE_BUCKET_HOME_FEED } from '@/lib/supabase-storage';
import { assertVideoWithinLimit, type HomeCapturedMedia } from './homeMedia';

async function readUriBytes(uri: string): Promise<ArrayBuffer> {
  if (Platform.OS === 'web') {
    const res = await fetch(uri);
    if (!res.ok) {
      throw new Error('อ่านไฟล์ไม่สำเร็จ ลองใหม่อีกครั้ง');
    }
    return res.arrayBuffer();
  } else {
    try {
      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: 'base64',
      });
      return decode(base64);
    } catch (err) {
      console.error('readUriBytes error:', err);
      throw new Error('อ่านไฟล์ไม่สำเร็จ ลองใหม่อีกครั้ง');
    }
  }
}

async function readImageBytes(media: HomeCapturedMedia): Promise<ArrayBuffer> {
  if (media.base64) {
    return decode(media.base64);
  }
  if (media.uri.startsWith('data:')) {
    const part = media.uri.split(',')[1];
    if (part) return decode(part);
  }
  return readUriBytes(media.uri);
}

export async function uploadHomeFeedMedia(userId: string, media: HomeCapturedMedia): Promise<string> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.user) {
    throw new Error('กรุณาเข้าสู่ระบบ');
  }

  assertVideoWithinLimit(media);

  const isVideo = media.mediaType === 'video';
  const ext =
    isVideo ?
      media.uri.toLowerCase().includes('.mov') ? 'mov'
      : 'mp4'
    : media.mimeType?.includes('png') || media.uri.toLowerCase().endsWith('.png') ? 'png'
    : 'jpg';

  const contentType =
    media.mimeType ||
    (isVideo ?
      ext === 'mov' ? 'video/quicktime'
      : 'video/mp4'
    : ext === 'png' ? 'image/png'
    : 'image/jpeg');

  const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 9)}.${ext}`;
  const bytes = isVideo ? await readUriBytes(media.uri) : await readImageBytes(media);

  const { error } = await supabase.storage
    .from(STORAGE_BUCKET_HOME_FEED)
    .upload(path, bytes, { contentType, upsert: false });

  if (error) {
    if (error.message.includes('Bucket not found') || error.message.includes('bucket')) {
      throw new Error('ยังไม่มี bucket home-feed บน Supabase — รัน migration add_home_feed');
    }
    if (error.message.includes('row-level security') || error.message.includes('policy')) {
      throw new Error('อัปโหลดไม่ได้ (สิทธิ์ storage) — รัน migration fix_home_feed_create');
    }
    throw error;
  }

  const { data } = supabase.storage.from(STORAGE_BUCKET_HOME_FEED).getPublicUrl(path);
  return data.publicUrl;
}

/** @deprecated use uploadHomeFeedMedia */
export async function uploadHomeFeedImage(userId: string, media: { uri: string; base64?: string; mimeType?: string }) {
  return uploadHomeFeedMedia(userId, {
    uri: media.uri,
    mediaType: 'image',
    mimeType: media.mimeType,
    base64: media.base64,
  });
}
