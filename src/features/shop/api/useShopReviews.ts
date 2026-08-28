import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { publicCatalogQueryOptions } from '@/lib/publicQueryOptions';
import { supabase } from '@/lib/supabase';
import type { ShopProductReview } from '../types';

const REVIEWABLE_STATUSES = ['paid', 'fulfilling', 'shipped', 'completed'] as const;

export function useShopProductReviews(productId: string | null, limit = 20) {
  return useQuery({
    queryKey: ['shop', 'reviews', productId, limit],
    enabled: !!productId,
    ...publicCatalogQueryOptions,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('shop_product_reviews')
        .select(
          'id, product_id, user_id, order_id, variant_id, rating, body, variant_label, reviewer_display_name, helpful_count, created_at',
        )
        .eq('product_id', productId!)
        .order('created_at', { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data ?? []) as ShopProductReview[];
    },
  });
}

export function useOrderProductReviews(orderId: string | null) {
  return useQuery({
    queryKey: ['shop', 'reviews', 'order', orderId],
    enabled: !!orderId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('shop_product_reviews')
        .select('id, product_id, order_id, rating')
        .eq('order_id', orderId!);
      if (error) throw error;
      return (data ?? []) as Pick<ShopProductReview, 'id' | 'product_id' | 'order_id' | 'rating'>[];
    },
  });
}

export function useSubmitShopReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      order_id: string;
      product_id: string;
      rating: number;
      body?: string;
    }) => {
      const { data, error } = await supabase.rpc('shop_submit_product_review', {
        p_order_id: payload.order_id,
        p_product_id: payload.product_id,
        p_rating: payload.rating,
        p_body: payload.body?.trim() || null,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: (_id, vars) => {
      void qc.invalidateQueries({ queryKey: ['shop', 'reviews', vars.product_id] });
      void qc.invalidateQueries({ queryKey: ['shop', 'reviews', 'order', vars.order_id] });
      void qc.invalidateQueries({ queryKey: ['shop', 'product', vars.product_id] });
      void qc.invalidateQueries({ queryKey: ['shop', 'products'] });
    },
  });
}

export function canReviewShopOrder(status: string): boolean {
  return (REVIEWABLE_STATUSES as readonly string[]).includes(status);
}
