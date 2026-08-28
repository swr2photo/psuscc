export type HomeAnnouncementLink =
  | { type: 'event'; id: string }
  | { type: 'route'; path: string }
  | { type: 'url'; url: string };

export type HomeAnnouncementSlide = {
  id: string;
  imageUrl: string;
  title?: string;
  subtitle?: string;
  link?: HomeAnnouncementLink;
};

/** ประกาศคงที่ — แก้รูป/ข้อความได้ที่นี่ (หรือต่อ Supabase ภายหลัง) */
export const HOME_ANNOUNCEMENT_SLIDES: HomeAnnouncementSlide[] = [
  {
    id: 'welcome',
    imageUrl: 'https://images.unsplash.com/photo-1523240795612-9a054b0db644?w=1200',
    title: 'PSU Computer Club',
    subtitle: 'กิจกรรม ค่าย และชุมชนนักศึกษา',
    link: { type: 'route', path: '/(tabs)/activities' },
  },
  {
    id: 'store',
    imageUrl: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=1200',
    title: 'ร้านค้าสโมสร',
    subtitle: 'ของที่ระลึกและสินค้า PSU SCC',
    link: { type: 'route', path: '/(tabs)/store' },
  },
];
