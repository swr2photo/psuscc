import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { corsHeaders } from '../_shared/cors.ts';

const SLIPOK_BASE =
  Deno.env.get('SLIPOK_BASE_URL') ?? 'https://api.slipok.com/api/line/apikey';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return json({ error: 'missing_authorization' }, 401);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnon = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const slipKey = Deno.env.get('SLIPOK_API_KEY');
    const branchId = Deno.env.get('SLIPOK_BRANCH_ID');
    const expectedPromptPay = Deno.env.get('PROMPTPAY_ID') ?? Deno.env.get('PAYMENT_ACCOUNT');
    const expectedAccountName = Deno.env.get('PAYMENT_ACCOUNT_NAME');

    if (!slipKey || !branchId) {
      console.error('SlipOK secrets not configured');
      return json({ error: 'slipok_not_configured' }, 500);
    }

    const userClient = createClient(supabaseUrl, supabaseAnon, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: userErr,
    } = await userClient.auth.getUser();
    if (userErr || !user) {
      return json({ error: 'invalid_user' }, 401);
    }

    const body = await req.json().catch(() => ({}));
    const orderId = body?.order_id as string | undefined;
    if (!orderId) {
      return json({ error: 'order_id_required' }, 400);
    }

    const admin = createClient(supabaseUrl, serviceKey);

    const { data: order, error: orderErr } = await admin
      .from('shop_orders')
      .select('id,user_id,status,total,slip_url')
      .eq('id', orderId)
      .single();

    if (orderErr || !order) {
      return json({ error: 'order_not_found' }, 404);
    }

    const { data: profile } = await admin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();
    const isAdmin = profile?.role === 'admin';

    if (order.user_id !== user.id && !isAdmin) {
      return json({ error: 'forbidden' }, 403);
    }

    if (order.status !== 'payment_review' || !order.slip_url) {
      return json({ error: 'invalid_order_state', status: order.status }, 400);
    }

    const form = new FormData();
    form.append('url', order.slip_url);
    form.append('amount', String(order.total));
    form.append('log', 'true');

    const slipRes = await fetch(`${SLIPOK_BASE}/${branchId}`, {
      method: 'POST',
      headers: { 'x-authorization': slipKey },
      body: form,
    });

    const slipJson = await slipRes.json().catch(() => ({}));

    if (slipRes.ok && slipJson?.success && slipJson?.data && !slipJson?.code) {
      if (expectedPromptPay || expectedAccountName) {
        const ids = extractReceiverIds(slipJson);
        const names = extractReceiverNames(slipJson);

        if (expectedPromptPay && ids.length && !ids.includes(normalizeId(expectedPromptPay))) {
          await admin
            .from('shop_orders')
            .update({
              status: 'payment_failed',
              slipok_payload: { ...slipJson, psuscc_reason: 'receiver_mismatch' },
              updated_at: new Date().toISOString(),
            })
            .eq('id', orderId);
          return json({ ok: true, verified: false, message: 'receiver_mismatch' }, 200);
        }

        if (expectedAccountName && names.length && !names.includes(normalizeName(expectedAccountName))) {
          await admin
            .from('shop_orders')
            .update({
              status: 'payment_failed',
              slipok_payload: { ...slipJson, psuscc_reason: 'receiver_name_mismatch' },
              updated_at: new Date().toISOString(),
            })
            .eq('id', orderId);
          return json({ ok: true, verified: false, message: 'receiver_name_mismatch' }, 200);
        }
      }

      const { error: upErr } = await admin
        .from('shop_orders')
        .update({
          status: 'paid',
          payment_verified_at: new Date().toISOString(),
          slipok_payload: slipJson,
          updated_at: new Date().toISOString(),
        })
        .eq('id', orderId);

      if (upErr) {
        console.error(upErr);
        return json({ error: 'db_update_failed' }, 500);
      }

      return json({ ok: true, verified: true, slipok: slipJson });
    }

    const { error: failErr } = await admin
      .from('shop_orders')
      .update({
        status: 'payment_failed',
        slipok_payload: slipJson,
        updated_at: new Date().toISOString(),
      })
      .eq('id', orderId);

    if (failErr) {
      console.error(failErr);
    }

    return json({
      ok: true,
      verified: false,
      slipok: slipJson,
      message: slipJson?.message ?? 'verification_failed',
    });
  } catch (e) {
    console.error(e);
    return json({ error: 'internal_error' }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function normalizeId(id: string): string {
  return id.replace(/\s+/g, '').replace(/[^0-9]/g, '');
}

function normalizeName(name: string): string {
  return name.trim().toLowerCase();
}

function extractReceiverIds(payload: unknown): string[] {
  if (!payload || typeof payload !== 'object') return [];
  const data = (payload as Record<string, unknown>).data as Record<string, unknown> | undefined;
  if (!data) return [];

  const candidates: (string | undefined)[] = [];

  const receiver = data.receiver as Record<string, unknown> | undefined;
  const payee = data.payee as Record<string, unknown> | undefined;
  const promptpay = data.promptpay as Record<string, unknown> | undefined;

  candidates.push(
    receiver?.account as string | undefined,
    receiver?.account_no as string | undefined,
    receiver?.promptpay as string | undefined,
    payee?.account as string | undefined,
    payee?.account_no as string | undefined,
    payee?.promptpay as string | undefined,
    promptpay?.id as string | undefined,
    promptpay?.number as string | undefined,
    data.to as string | undefined,
  );

  return [...new Set(candidates.filter(Boolean).map((v) => normalizeId(v!)).filter(Boolean))];
}

function extractReceiverNames(payload: unknown): string[] {
  if (!payload || typeof payload !== 'object') return [];
  const data = (payload as Record<string, unknown>).data as Record<string, unknown> | undefined;
  if (!data) return [];

  const candidates: (string | undefined)[] = [];

  const receiver = data.receiver as Record<string, unknown> | undefined;
  const payee = data.payee as Record<string, unknown> | undefined;

  candidates.push(
    receiver?.name as string | undefined,
    receiver?.account_name as string | undefined,
    payee?.name as string | undefined,
    payee?.account_name as string | undefined,
    data.receiver as string | undefined,
  );

  return [...new Set(candidates.filter(Boolean).map((v) => normalizeName(v!)).filter(Boolean))];
}
