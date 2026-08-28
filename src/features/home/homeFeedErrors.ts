/** แปลง error จาก Supabase / อัปโหลด เป็นข้อความที่ผู้ใช้เข้าใจ */
export function formatHomeFeedError(e: unknown, fallback: string): string {
  const raw =
    e instanceof Error ? e.message
    : typeof e === 'object' && e !== null && 'message' in e ? String((e as { message: unknown }).message)
    : fallback;

  if (/home_posts|home_stories|schema cache|relation.*does not exist/i.test(raw)) {
    return 'ยังไม่ได้ตั้งค่าฐานข้อมูล — รัน migration add_home_feed และ fix_home_feed_create บน Supabase';
  }
  if (/location_label|tagged_user|allow_comments|allow_likes|allow_replies/i.test(raw)) {
    return 'ยังไม่ได้รัน migration add_home_feed_settings (หรือโพสต์จะบันทึกแบบพื้นฐาน — ลองรีสตาร์ทแอป)';
  }
  if (/like_count|comment_count/i.test(raw)) {
    return 'ยังไม่ได้รัน migration add_home_post_engagement บน Supabase';
  }
  if (/Bucket not found|bucket/i.test(raw)) {
    return 'ยังไม่มี bucket home-feed — รัน migration add_home_feed';
  }
  if (/row-level security|policy/i.test(raw)) {
    return 'ไม่มีสิทธิ์บันทึก — ลองเข้าสู่ระบบใหม่ หรือรัน migration fix_home_feed_create';
  }
  if (/profiles|foreign key|violates foreign key/i.test(raw)) {
    return 'โปรไฟล์ยังไม่พร้อม — กรุณากรอกข้อมูลโปรไฟล์ให้ครบก่อนโพสต์';
  }
  if (/JWT|session|not authenticated|กรุณาเข้าสู่ระบบ/i.test(raw)) {
    return 'กรุณาเข้าสู่ระบบก่อนโพสต์';
  }
  return raw || fallback;
}
