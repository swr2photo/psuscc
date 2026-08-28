export type StorePromoSlideKind = 'image' | 'video';

export type StorePromoSlide = {
  id: string;
  kind: StorePromoSlideKind;
  /** remote URL (image or video file e.g. mp4) — prefer HTTPS for production */
  uri: string;
  /** optional: poster frame when video is not focused or while loading */
  posterUri?: string;
  title?: string;
  subtitle?: string;
};

/**
 * Edit slides here (or later load from Supabase / admin API).
 *
 * @example
 * { id: 'p1', kind: 'video', uri: 'https://example.com/promo.mp4', posterUri: 'https://...jpg',
 *   title: 'ลดราคา', subtitle: 'ถึงสิ้นเดือน' }
 */
export const STORE_PROMO_SLIDES: StorePromoSlide[] = [
  {
    id: 'welcome-image',
    kind: 'image',
    uri: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=1200',
    title: 'PSU SCC Store',
    subtitle: 'ของที่ระลึกและสินค้าสโมสร',
  },
  {
    id: 'sample-video',
    kind: 'video',
    uri: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4',
    posterUri:
      'https://images.unsplash.com/photo-1542291026-7eec264c27ff?q=80&w=1200&auto=format&fit=crop',
    title: 'วิดีโอโปรโมชัน',
    subtitle: 'เล่นอัตโนมัติเมื่ออยู่สไลด์นี้ (ปิดเสียง)',
  },
  {
    id: 'sport-gear-image',
    kind: 'image',
    uri: 'https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=1200',
    title: 'หมวดใหม่ทุกเดือน',
    subtitle: 'เลือกหมวดจากแท็บด้านล่าง',
  },
];
