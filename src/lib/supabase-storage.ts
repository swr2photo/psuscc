import { supabase } from '@/lib/supabase';

/** บักเก็ตที่ใช้เก็บรูปเกียรติบัตรและรูปกิจกรรมในโปรเจกต์นี้ */
export const STORAGE_BUCKET_CERTIFICATES = 'certificates';

/** รูปในข้อความแชทกิจกรรม (migration `add_chat_attachments_storage`) */
export const STORAGE_BUCKET_CHAT_ATTACHMENTS = 'chat-attachments';

/** สตอรีและโพสต์หน้า Home (`add_home_feed`) */
export const STORAGE_BUCKET_HOME_FEED = 'home-feed';

/**
 * ดึง path ใน bucket จาก URL เต็มของ Supabase Storage หรือ path ล้วน
 */
export function extractStorageObjectPath(storedUrl: string, bucket: string): string | null {
  const trimmed = storedUrl.trim();
  if (!trimmed) return null;

  if (!trimmed.includes('://')) {
    return trimmed.replace(/^\/+/, '');
  }

  const encBucket = encodeURIComponent(bucket);
  const patterns = [
    `/object/public/${bucket}/`,
    `/object/public/${encBucket}/`,
    `/object/sign/${bucket}/`,
    `/object/sign/${encBucket}/`,
    `/object/authenticated/${bucket}/`,
    `/object/authenticated/${encBucket}/`,
  ];

  for (const p of patterns) {
    const idx = trimmed.indexOf(p);
    if (idx === -1) continue;
    let rest = trimmed.slice(idx + p.length);
    const q = rest.indexOf('?');
    if (q !== -1) rest = rest.slice(0, q);
    const hash = rest.indexOf('#');
    if (hash !== -1) rest = rest.slice(0, hash);
    try {
      return decodeURIComponent(rest);
    } catch {
      return rest;
    }
  }

  return null;
}

/**
 * URL สำหรับแสดงรูปในแอป: ใช้ signed URL ถ้าเป็นไฟล์ใน bucket ของโปรเจกต์ (รองรับ bucket แบบ private)
 * ถ้าไม่ใช่ path ใน bucket หรือ sign ไม่ได้ จะคืน URL เดิม (เช่น โฮสต์ภายนอก)
 */
export async function getReadableStorageUrl(
  bucket: string,
  storedUrl: string | null | undefined,
  expiresSec = 3600,
): Promise<string | null> {
  if (!storedUrl?.trim()) return null;

  const path = extractStorageObjectPath(storedUrl, bucket);
  if (!path) {
    return storedUrl.trim();
  }

  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, expiresSec);
  if (!error && data?.signedUrl) {
    return data.signedUrl;
  }

  const { data: pub } = supabase.storage.from(bucket).getPublicUrl(path);
  return pub.publicUrl;
}
