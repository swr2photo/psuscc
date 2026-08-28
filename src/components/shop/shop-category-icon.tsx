import { getShopCategoryIcon, getShopCategoryIconColor } from '@/constants/shop-category-icons';

type Props = {
  slug: string;
  size?: number;
  color?: string;
  strokeWidth?: number;
};

export function ShopCategoryIcon({ slug, size = 32, color, strokeWidth = 2 }: Props) {
  const Icon = getShopCategoryIcon(slug);
  const tint = color ?? getShopCategoryIconColor(slug);
  return <Icon size={size} color={tint} strokeWidth={strokeWidth} />;
}
