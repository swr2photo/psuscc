import type { ShopProduct, ShopProductVariant } from './types';

export function resolveShopProductPrice(
  product: ShopProduct,
  variant: ShopProductVariant | null,
): { price: number; comparePrice: number | null } {
  const price = variant?.price ?? product.base_price ?? 0;
  const base = product.base_price;
  const comparePrice = base != null && base > price ? base : null;
  return { price, comparePrice };
}

export function shopProductStockLabel(stock: number): string {
  if (stock <= 0) return 'สินค้าหมด';
  return `คงเหลือ ${stock} ชิ้น`;
}

export function shopProductTotalStock(product: ShopProduct): number {
  const variants = product.shop_product_variants ?? [];
  if (variants.length === 0) return 0;
  return variants.reduce((sum, v) => sum + (v.stock_quantity ?? 0), 0);
}

export function shopProductTypeLabel(type: ShopProduct['product_type']): string {
  return type === 'apparel' ? 'เสื้อผ้า / แฟชั่น' : 'สินค้าทั่วไป';
}

/** ยอดขายจริงจากคำสั่งซื้อที่ชำระแล้ว */
export function formatUnitsSoldLabel(unitsSold: number): string | null {
  if (unitsSold <= 0) return null;
  if (unitsSold >= 10_000) return `ขายแล้ว ${(unitsSold / 1000).toFixed(0)}k+ ชิ้น`;
  if (unitsSold >= 1_000) return `ขายแล้ว ${(unitsSold / 1000).toFixed(1)}k+ ชิ้น`;
  return `ขายแล้ว ${unitsSold} ชิ้น`;
}

export type DiscoverHighlightReason = 'new' | 'bestseller';

const DISCOVER_NEW_DAYS = 30;

/** พบสิ่งใหม่: สินค้าใหม่ล่าสุด (ภายใน 30 วัน) หรือขายดีสุด */
export function pickDiscoverProduct(
  products: ShopProduct[],
): { product: ShopProduct; reason: DiscoverHighlightReason } | null {
  if (products.length === 0) return null;

  const pool = products.filter((p) => p.image_urls?.[0]);
  const list = pool.length ? pool : products;

  const byNewest = [...list].sort(
    (a, b) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime(),
  );
  const newest = byNewest[0];

  const bySales = [...list].sort((a, b) => (b.units_sold ?? 0) - (a.units_sold ?? 0));
  const topSeller = bySales[0];

  const newestMs = newest?.created_at ? Date.parse(newest.created_at) : NaN;
  const isRecent =
    Number.isFinite(newestMs) && Date.now() - newestMs < DISCOVER_NEW_DAYS * 86_400_000;

  if (isRecent && newest) return { product: newest, reason: 'new' };
  if ((topSeller?.units_sold ?? 0) > 0 && topSeller) return { product: topSeller, reason: 'bestseller' };
  if (newest) return { product: newest, reason: 'new' };
  return { product: list[0], reason: 'new' };
}

export function discoverHighlightLabel(reason: DiscoverHighlightReason): string {
  return reason === 'new' ? 'มาใหม่' : 'ขายดี';
}

export function formatRatingAvg(rating: number | null | undefined): string {
  if (rating == null || Number.isNaN(rating)) return '—';
  return rating.toFixed(1);
}
