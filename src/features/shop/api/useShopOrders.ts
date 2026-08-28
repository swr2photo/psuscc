import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { ShopOrder, ShopOrderItem, ShopShipment } from '../types';

function parseEdgeFunctionError(err: unknown): Error {
  if (err instanceof Error) {
    const anyErr = err as unknown as { context?: { status?: number; body?: unknown } };
    const status = anyErr.context?.status;
    const body = anyErr.context?.body;
    if (status || body) {
      const msg = extractMessageFromBody(body);
      return new Error(
        [
          'เรียก Edge Function ไม่สำเร็จ',
          status ? `(HTTP ${status})` : null,
          msg ? `: ${msg}` : null,
        ]
          .filter(Boolean)
          .join(' '),
      );
    }
    return err;
  }

  if (typeof err === 'object' && err) {
    const anyErr = err as { message?: string; context?: { status?: number; body?: unknown } };
    const status = anyErr.context?.status;
    const msg = extractMessageFromBody(anyErr.context?.body) ?? anyErr.message;
    return new Error(
      ['เรียก Edge Function ไม่สำเร็จ', status ? `(HTTP ${status})` : null, msg ? `: ${msg}` : null]
        .filter(Boolean)
        .join(' '),
    );
  }

  return new Error(String(err));
}

function extractMessageFromBody(body: unknown): string | null {
  if (!body) return null;
  if (typeof body === 'string') return body;
  if (typeof body !== 'object') return String(body);
  const b = body as Record<string, unknown>;
  const msg = (b.message as string | undefined) ?? (b.error as string | undefined);
  if (msg) return msg;
  try {
    return JSON.stringify(b);
  } catch {
    return null;
  }
}

function unwrapJoin<T>(x: T | T[] | null | undefined): T | null {
  if (x == null) return null;
  return Array.isArray(x) ? x[0] ?? null : x;
}

function normalizeEmbeddedOrder(row: Record<string, unknown>): ShopOrder {
  const base = normalizeOrder(row) as unknown as Record<string, unknown>;
  return {
    ...(base as unknown as ShopOrder),
    shop_user_addresses: unwrapJoin(base.shop_user_addresses as never) as ShopOrder['shop_user_addresses'],
    shop_shipping_methods: unwrapJoin(base.shop_shipping_methods as never) as ShopOrder['shop_shipping_methods'],
    shop_shipments: unwrapJoin(base.shop_shipments as never) as ShopOrder['shop_shipments'],
  };
}

export function useShopOrders() {
  return useQuery({
    queryKey: ['shop', 'orders'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('shop_orders')
        .select(
          `
          *,
          shop_shipping_methods ( name, code, base_fee ),
          shop_user_addresses ( full_name, phone, address_line, postal_code, province_name, district_name, subdistrict_name ),
          shop_shipments ( tracking_number, last_status, updated_at )
        `,
        )
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []).map((r) => normalizeEmbeddedOrder(r as Record<string, unknown>));
    },
  });
}

export function useShopOrderDetail(orderId: string | null) {
  return useQuery({
    queryKey: ['shop', 'order', orderId],
    enabled: !!orderId,
    queryFn: async () => {
      const { data: order, error: oerr } = await supabase
        .from('shop_orders')
        .select(
          `
          *,
          shop_shipping_methods ( id, name, code, base_fee ),
          shop_user_addresses ( * )
        `,
        )
        .eq('id', orderId!)
        .single();
      if (oerr) throw oerr;

      const { data: items, error: ierr } = await supabase
        .from('shop_order_items')
        .select(
          `
          *,
          shop_products ( name, image_urls ),
          shop_product_variants ( size_label, price )
        `,
        )
        .eq('order_id', orderId!);
      if (ierr) throw ierr;

      const { data: ship } = await supabase
        .from('shop_shipments')
        .select('*')
        .eq('order_id', orderId!)
        .maybeSingle();

      return {
        order: normalizeEmbeddedOrder(order as Record<string, unknown>),
        items: (items ?? []).map((it) => {
          const raw = it as ShopOrderItem & {
            shop_products?: unknown;
            shop_product_variants?: unknown;
          };
          return {
            ...raw,
            shop_products: unwrapJoin(raw.shop_products as never),
            shop_product_variants: unwrapJoin(raw.shop_product_variants as never),
          };
        }),
        shipment: (ship as ShopShipment) ?? null,
      };
    },
  });
}

function normalizeOrder(row: Record<string, unknown>): ShopOrder {
  const base = { ...(row as unknown as ShopOrder) };
  return {
    ...base,
    subtotal: Number(row.subtotal),
    shipping_fee: Number(row.shipping_fee),
    total: Number(row.total),
  };
}

export function usePlaceShopOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      lines: { variant_id: string; quantity: number }[];
      shipping_method_id: string;
      user_address_id: string;
    }) => {
      const { data, error } = await supabase.rpc('shop_place_order', {
        p_lines: payload.lines,
        p_shipping_method_id: payload.shipping_method_id,
        p_user_address_id: payload.user_address_id,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['shop', 'cart'] });
      qc.invalidateQueries({ queryKey: ['shop', 'orders'] });
    },
  });
}

export function useAttachShopSlip() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ orderId, slipUrl }: { orderId: string; slipUrl: string }) => {
      const { error } = await supabase.rpc('shop_attach_payment_slip', {
        p_order_id: orderId,
        p_slip_url: slipUrl,
      });
      if (error) throw error;
    },
    onSuccess: (_, v) => {
      qc.invalidateQueries({ queryKey: ['shop', 'orders'] });
      qc.invalidateQueries({ queryKey: ['shop', 'order', v.orderId] });
    },
  });
}

export async function invokeVerifyShopSlip(orderId: string) {
  console.time('⏱️ invokeVerifyShopSlip');
  try {
    const { data, error } = await supabase.functions.invoke('verify-shop-slip', {
      body: { order_id: orderId },
    });
    if (error) throw parseEdgeFunctionError(error);
    return data as { verified?: boolean; ok?: boolean; error?: string; message?: string };
  } finally {
    console.timeEnd('⏱️ invokeVerifyShopSlip');
  }
}

export async function invokeTrackParcel(orderId: string, barcode?: string) {
  console.time('⏱️ invokeTrackParcel');
  try {
    const { data, error } = await supabase.functions.invoke('track-parcel', {
      body: { order_id: orderId, barcode },
    });
    if (error) throw parseEdgeFunctionError(error);
    return data as Record<string, unknown>;
  } finally {
    console.timeEnd('⏱️ invokeTrackParcel');
  }
}
