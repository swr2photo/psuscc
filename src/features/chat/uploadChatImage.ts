import type { ImagePickerAsset } from 'expo-image-picker';

import { decode } from 'base64-arraybuffer';

import { supabase } from '@/lib/supabase';

import { STORAGE_BUCKET_CHAT_ATTACHMENTS } from '@/lib/supabase-storage';



async function uploadToChatAttachments(path: string, asset: ImagePickerAsset): Promise<string> {

  if (!asset.base64) {

    throw new Error('ไม่มีข้อมูลภาพ ลองเลือกรูปใหม่');

  }

  const isPng = asset.mimeType?.includes('png') || asset.uri?.toLowerCase().endsWith('.png');

  const ext = isPng ? 'png' : 'jpeg';

  const contentType = asset.mimeType || (isPng ? 'image/png' : 'image/jpeg');

  const { error } = await supabase.storage

    .from(STORAGE_BUCKET_CHAT_ATTACHMENTS)

    .upload(path, decode(asset.base64), { contentType, upsert: false });

  if (error) throw error;

  const { data } = supabase.storage.from(STORAGE_BUCKET_CHAT_ATTACHMENTS).getPublicUrl(path);

  return data.publicUrl;

}



export async function uploadChatImage(eventId: string, asset: ImagePickerAsset): Promise<string> {

  const isPng = asset.mimeType?.includes('png') || asset.uri?.toLowerCase().endsWith('.png');

  const ext = isPng ? 'png' : 'jpeg';

  const path = `event-chat/${eventId}/${Date.now()}-${Math.random().toString(36).slice(2, 9)}.${ext}`;

  return uploadToChatAttachments(path, asset);

}

export async function uploadChatVideo(eventId: string, localFileUri: string): Promise<string> {
  const res = await fetch(localFileUri);
  const buf = await res.arrayBuffer();
  const lower = localFileUri.toLowerCase();
  const ext = lower.endsWith('.mov') ? 'mov' : 'mp4';
  const contentType = ext === 'mov' ? 'video/quicktime' : 'video/mp4';
  const path = `event-chat-video/${eventId}/${Date.now()}-${Math.random().toString(36).slice(2, 9)}.${ext}`;
  
  const { error } = await supabase.storage.from(STORAGE_BUCKET_CHAT_ATTACHMENTS).upload(path, buf, {
    contentType,
    upsert: false,
  });
  if (error) throw error;
  const { data } = supabase.storage.from(STORAGE_BUCKET_CHAT_ATTACHMENTS).getPublicUrl(path);
  return data.publicUrl;
}


/** อัปโหลดไฟล์เสียงที่บันทึกจาก expo-audio ไป bucket แชท (โฟลเดอร์ event-chat-voice) */
export async function uploadChatVoiceRecording(eventId: string, localFileUri: string): Promise<string> {
  const res = await fetch(localFileUri);
  const buf = await res.arrayBuffer();
  const lower = localFileUri.toLowerCase();
  const ext = lower.endsWith('.webm')
    ? 'webm'
    : lower.endsWith('.aac')
      ? 'aac'
      : lower.endsWith('.caf')
        ? 'caf'
        : 'm4a';
  const contentType =
    ext === 'aac'
      ? 'audio/aac'
      : ext === 'webm'
        ? 'audio/webm'
        : ext === 'caf'
          ? 'audio/x-caf'
          : 'audio/mp4';
  const path = `event-chat-voice/${eventId}/${Date.now()}-${Math.random().toString(36).slice(2, 9)}.${ext}`;
  const { error } = await supabase.storage.from(STORAGE_BUCKET_CHAT_ATTACHMENTS).upload(path, buf, {
    contentType,
    upsert: false,
  });
  if (error) throw error;
  const { data } = supabase.storage.from(STORAGE_BUCKET_CHAT_ATTACHMENTS).getPublicUrl(path);
  return data.publicUrl;
}

export async function uploadChatRoomAvatar(eventId: string, asset: ImagePickerAsset): Promise<string> {

  const isPng = asset.mimeType?.includes('png') || asset.uri?.toLowerCase().endsWith('.png');

  const ext = isPng ? 'png' : 'jpeg';

  const path = `event-chat-room-avatar/${eventId}/${Date.now()}-${Math.random().toString(36).slice(2, 9)}.${ext}`;

  return uploadToChatAttachments(path, asset);

}

