import { supabase } from '@/lib/supabase';
import type { ShopCartItem } from '../types';

export async function ensureShopCartId(): Promise<string | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: existing } = await supabase
    .from('shop_carts')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (existing?.id) return existing.id;

  const { data: created, error } = await supabase
    .from('shop_carts')
    .insert({ user_id: user.id })
    .select('id')
    .single();

  if (error) throw error;
  return created.id;
}

export async function fetchCartItems(): Promise<ShopCartItem[]> {
  const cartId = await ensureShopCartId();
  if (!cartId) return [];

  const { data, error } = await supabase
    .from('shop_cart_items')
    .select(
      `
      id,
      cart_id,
      variant_id,
      quantity,
      shop_product_variants (
        id,
        product_id,
        size_label,
        price,
        sku,
        stock_quantity,
        shop_products ( id, name, image_urls, product_type )
      )
    `,
    )
    .eq('cart_id', cartId);

  if (error) throw error;

  type VariantEmb = {
    id: string;
    product_id: string;
    size_label: string | null;
    price: unknown;
    sku: string | null;
    stock_quantity: number;
    shop_products:
      | { id: string; name: string; image_urls: unknown; product_type: string }
      | { id: string; name: string; image_urls: unknown; product_type: string }[];
  };

  type ItemRow = {
    id: string;
    cart_id: string;
    variant_id: string;
    quantity: number;
    shop_product_variants: VariantEmb | VariantEmb[] | null;
  };

  return ((data ?? []) as unknown as ItemRow[]).map((row) => {
    const vRaw = row.shop_product_variants;
    const v = Array.isArray(vRaw) ? vRaw[0] : vRaw;
    if (!v) throw new Error('cart_variant_missing');
    const pRaw = v.shop_products;
    const p = Array.isArray(pRaw) ? pRaw[0] : pRaw;
    if (!p) throw new Error('cart_product_missing');
    return {
      id: row.id,
      cart_id: row.cart_id,
      variant_id: row.variant_id,
      quantity: row.quantity,
      shop_product_variants: {
        id: v.id,
        product_id: v.product_id,
        size_label: v.size_label,
        price: Number(v.price),
        sku: v.sku,
        stock_quantity: v.stock_quantity,
        low_stock_threshold: null,
        shop_products: {
          id: p.id,
          name: p.name,
          image_urls: (p.image_urls as string[]) ?? [],
          product_type: p.product_type as 'simple' | 'apparel',
        },
      },
    };
  }) as ShopCartItem[];
}

export async function addCartItem(variantId: string, quantity: number) {
  const cartId = await ensureShopCartId();
  if (!cartId) throw new Error('login_required');

  const { data: existing } = await supabase
    .from('shop_cart_items')
    .select('id, quantity')
    .eq('cart_id', cartId)
    .eq('variant_id', variantId)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from('shop_cart_items')
      .update({ quantity: existing.quantity + quantity })
      .eq('id', existing.id);
    if (error) throw error;
    return;
  }

  const { error } = await supabase.from('shop_cart_items').insert({
    cart_id: cartId,
    variant_id: variantId,
    quantity,
  });
  if (error) throw error;
}

export async function setCartItemQuantity(itemId: string, quantity: number) {
  if (quantity < 1) {
    const { error } = await supabase.from('shop_cart_items').delete().eq('id', itemId);
    if (error) throw error;
    return;
  }
  const { error } = await supabase.from('shop_cart_items').update({ quantity }).eq('id', itemId);
  if (error) throw error;
}

export async function removeCartItem(itemId: string) {
  const { error } = await supabase.from('shop_cart_items').delete().eq('id', itemId);
  if (error) throw error;
}
