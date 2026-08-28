import {
  LayoutGrid,
  Shirt,
  Backpack,
  Gem,
  type LucideIcon,
} from 'lucide-react-native';

/** ไอคอนหมวดร้านค้า — slug จาก shop_categories + all */
export const SHOP_CATEGORY_ICON_MAP: Record<string, LucideIcon> = {
  all: LayoutGrid,
  wear: Shirt,
  gear: Backpack,
  limited: Gem,
};

/** สี accent ต่อหมวด (รองรับทั้งโหมดสว่าง/มืด) */
export const SHOP_CATEGORY_ICON_COLOR: Record<string, string> = {
  all: '#007AFF',
  wear: '#FF9500',
  gear: '#30D158',
  limited: '#BF5AF2',
};

const FALLBACK_ICON = LayoutGrid;
const FALLBACK_COLOR = '#8E8E93';

export function getShopCategoryIcon(slug: string): LucideIcon {
  return SHOP_CATEGORY_ICON_MAP[slug] ?? FALLBACK_ICON;
}

export function getShopCategoryIconColor(slug: string): string {
  return SHOP_CATEGORY_ICON_COLOR[slug] ?? FALLBACK_COLOR;
}
