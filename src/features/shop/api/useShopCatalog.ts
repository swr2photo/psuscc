import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { publicCatalogQueryOptions } from '@/lib/publicQueryOptions';
import { supabase } from '@/lib/supabase';
import type { ShopCategory, ShopProduct, ShopShippingMethod } from '../types';

function normalizeShopProductRow(row: Record<string, unknown>): ShopProduct {
  const category = row.shop_categories;
  const categoryObj =
    category && typeof category === 'object' && !Array.isArray(category)
      ? (category as ShopProduct['shop_categories'])
      : null;

  return {
    ...(row as any),
    base_price: row.base_price != null ? Number(row.base_price) : null,
    units_sold: Number(row.units_sold ?? 0),
    rating_avg: row.rating_avg != null ? Number(row.rating_avg) : null,
    review_count: Number(row.review_count ?? 0),
    image_urls: (row.image_urls as string[]) ?? [],
    shop_categories: categoryObj,
    shop_product_variants: ((row.shop_product_variants as Record<string, unknown>[]) ?? []).map(
      (v) => ({
        ...v,
        price: Number(v.price),
        stock_quantity: Number(v.stock_quantity ?? 0),
      }),
    ),
  } as ShopProduct;
}

export function useShopCategories() {
  return useQuery({
    queryKey: ['shop', 'categories'],
    ...publicCatalogQueryOptions,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('shop_categories')
        .select('*')
        .order('sort_order', { ascending: true });
      if (error) throw error;
      return data as ShopCategory[];
    },
  });
}

export function useShopProducts(categorySlug: string | null) {
  return useQuery({
    queryKey: ['shop', 'products', categorySlug],
    ...publicCatalogQueryOptions,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      let categoryId: string | undefined;
      if (categorySlug && categorySlug !== 'all') {
        const { data: cat, error: catErr } = await supabase
          .from('shop_categories')
          .select('id')
          .eq('slug', categorySlug)
          .maybeSingle();
        if (catErr) throw catErr;
        categoryId = cat?.id;
      }

      let q = supabase
        .from('shop_products')
        .select('*, shop_product_variants(*), shop_categories(id, name, slug)')
        .eq('is_published', true)
        .order('created_at', { ascending: false });

      if (categoryId) q = q.eq('category_id', categoryId);

      const { data, error } = await q;
      if (error) throw error;

      return (data ?? []).map((row) => normalizeShopProductRow(row));
    },
  });
}

export function useShopProduct(productId: string | null) {
  return useQuery({
    queryKey: ['shop', 'product', productId],
    enabled: !!productId,
    ...publicCatalogQueryOptions,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('shop_products')
        .select('*, shop_product_variants(*), shop_categories(id, name, slug)')
        .eq('id', productId!)
        .eq('is_published', true)
        .single();
      if (error) throw error;
      return normalizeShopProductRow(data);
    },
  });
}

export function useShopShippingMethods() {
  return useQuery({
    queryKey: ['shop', 'shipping'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('shop_shipping_methods')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });
      if (error) throw error;
      return (data ?? []).map((r) => ({
        ...r,
        base_fee: Number(r.base_fee),
        free_over_amount: r.free_over_amount != null ? Number(r.free_over_amount) : null,
      })) as ShopShippingMethod[];
    },
  });
}
