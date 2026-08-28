import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { corsHeaders } from '../_shared/cors.ts';

/**
 * Proxy Thailand Post tracking. Set THAI_POST_TRACK_URL to your registered endpoint
 * (e.g. https://trackapi.thailandpost.co.th/post/api/v1/track) and store token in
 * shop_carrier_secrets (read with service role).
 */
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
    const trackUrl =
      Deno.env.get('THAILANDPOST_TRACK_URL') ??
      Deno.env.get('THAI_POST_TRACK_URL') ??
      'https://trackapi.thailandpost.co.th/post/api/v1/track';
    const authUrl =
      Deno.env.get('THAILANDPOST_AUTH_URL') ??
      Deno.env.get('THAI_POST_AUTH_URL') ??
      'https://trackapi.thailandpost.co.th/post/api/v1/authenticate/token';

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
      .select('id,user_id,status')
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

    const { data: shipment } = await admin
      .from('shop_shipments')
      .select('tracking_number,carrier')
      .eq('order_id', orderId)
      .maybeSingle();

    const barcode = (body?.barcode as string | undefined) ?? shipment?.tracking_number;
    if (!barcode) {
      return json({ error: 'no_tracking_number' }, 400);
    }

    const { data: secretRow } = await admin
      .from('shop_carrier_secrets')
      .select('api_token')
      .eq('carrier', 'thai_post')
      .maybeSingle();

    // This is the "Static Token Key" from Thailand Post developer portal.
    const tokenKeyRaw =
      secretRow?.api_token ??
      Deno.env.get('THAILANDPOST_API_KEY') ??
      Deno.env.get('THAI_POST_TOKEN');
    const tokenKey = tokenKeyRaw?.trim();
    if (!tokenKey) {
      return json({ error: 'thai_post_not_configured' }, 503);
    }
    const authHeaderValue = tokenKey.toLowerCase().startsWith('token ')
      ? tokenKey
      : `Token ${tokenKey}`;

    // Step 1) Exchange static token key for access token (valid ~1 month).
    const authRes = await fetch(authUrl, {
      method: 'POST',
      headers: {
        Authorization: authHeaderValue,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({}),
    });

    const authContentType = authRes.headers.get('content-type') ?? '';
    const authBodyText = await authRes.text().catch(() => '');
    const authJson = safeParseJson(authBodyText) as Record<string, unknown> | null;
    const accessToken = (authJson?.token as string | undefined)?.trim();

    if (!authRes.ok || !accessToken) {
      // Persist auth failure for debugging.
      await admin
        .from('shop_shipments')
        .upsert(
          {
            order_id: orderId,
            tracking_number: barcode,
            carrier: shipment?.carrier ?? 'thai_post',
            last_status: `THAI_POST_AUTH_HTTP_${authRes.status}`.slice(0, 180),
            raw_response: {
              ok: authRes.ok,
              step: 'authenticate/token',
              status: authRes.status,
              contentType: authContentType,
              parsed: authJson ?? {},
              bodyText: authBodyText ? authBodyText.slice(0, 4000) : null,
            },
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'order_id' },
        );

      return json(
        {
          ok: false,
          step: 'authenticate/token',
          status: authRes.status,
        },
        200,
      );
    }

    // Step 2) Track with access token + required payload fields.
    const tpRes = await fetch(trackUrl, {
      method: 'POST',
      headers: {
        Authorization: `Token ${accessToken}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ status: 'all', language: 'TH', barcode: [barcode] }),
    });

    const contentType = tpRes.headers.get('content-type') ?? '';
    const bodyText = await tpRes.text().catch(() => '');
    const tpJson = safeParseJson(bodyText) ?? {};

    const tpAny = tpJson as Record<string, unknown>;
    const response = tpAny.response as Record<string, unknown> | undefined;
    // Thailand Post commonly returns:
    // response.items: { "<barcode>": [ { ...events... } ] }
    const itemsAny = response?.items as unknown;
    const firstItem = pickFirstItem(itemsAny, barcode);
    const tpMsg =
      (tpAny.message as string | undefined) ??
      (tpAny.error as string | undefined) ??
      (tpAny.status as string | undefined) ??
      undefined;

    const statusTextBase =
      (firstItem?.status_detail as string | undefined) ??
      (firstItem?.status as string | undefined) ??
      (tpRes.ok ? 'OK' : `THAI_POST_HTTP_${tpRes.status}`);

    const statusText = tpRes.ok
      ? statusTextBase === 'OK' && !firstItem
        ? 'ไม่พบข้อมูลพัสดุ'
        : String(statusTextBase).slice(0, 180)
      : tpMsg
        ? `${statusTextBase}: ${tpMsg}`.slice(0, 180)
        : String(statusTextBase).slice(0, 180);

    // Always persist raw_response for debugging/UI, even when non-2xx.
    await admin
      .from('shop_shipments')
      .upsert(
        {
          order_id: orderId,
          tracking_number: barcode,
          carrier: shipment?.carrier ?? 'thai_post',
          last_status: statusText,
          raw_response: {
            ok: tpRes.ok,
            status: tpRes.status,
            contentType,
            auth: {
              ok: authRes.ok,
              status: authRes.status,
              contentType: authContentType,
              parsed: authJson ?? {},
            },
            parsed: tpJson,
            bodyText: bodyText ? bodyText.slice(0, 4000) : null,
          },
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'order_id' },
      );

    return json({
      ok: tpRes.ok,
      thailandpost: tpJson,
      status: tpRes.status,
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

function safeParseJson(text: string): unknown | null {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function pickFirstItem(itemsAny: unknown, barcode: string): Record<string, unknown> | undefined {
  if (!itemsAny) return undefined;

  // Case 1: response.items is an array
  if (Array.isArray(itemsAny)) {
    const first = itemsAny[0];
    return first && typeof first === 'object' ? (first as Record<string, unknown>) : undefined;
  }

  // Case 2: response.items is an object keyed by barcode
  if (typeof itemsAny === 'object') {
    const obj = itemsAny as Record<string, unknown>;
    const byKey = obj[barcode];
    if (Array.isArray(byKey)) {
      const first = byKey[0];
      return first && typeof first === 'object' ? (first as Record<string, unknown>) : undefined;
    }
    // fallback: first property
    const firstKey = Object.keys(obj)[0];
    const maybeArr = firstKey ? obj[firstKey] : undefined;
    if (Array.isArray(maybeArr)) {
      const first = maybeArr[0];
      return first && typeof first === 'object' ? (first as Record<string, unknown>) : undefined;
    }
  }

  return undefined;
}
