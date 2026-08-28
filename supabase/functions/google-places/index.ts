import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { corsHeaders } from '../_shared/cors.ts';

type ReqBody =
  | { action: 'autocomplete'; query: string }
  | { action: 'details'; place_id: string }
  | { action: 'reverse_geocode'; lat: number; lng: number };

const GOOGLE_BASE = 'https://maps.googleapis.com/maps/api/place';

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
    const googleKey = (Deno.env.get('GOOGLE_MAPS_API_KEY') ?? '').trim();

    if (!googleKey) {
      return json({ error: 'google_maps_not_configured' }, 503);
    }

    // Validate user session from the caller's JWT.
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

    // Admin-only (prevents leaking API key via unrestricted proxy).
    const admin = createClient(supabaseUrl, serviceKey);
    const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).maybeSingle();
    if (profile?.role !== 'admin') {
      return json({ error: 'forbidden' }, 403);
    }

    const body = (await req.json().catch(() => ({}))) as Partial<ReqBody>;
    if (body.action === 'autocomplete') {
      const q = String(body.query ?? '').trim();
      if (q.length < 2) return json({ predictions: [] });

      const url =
        `${GOOGLE_BASE}/autocomplete/json?` +
        new URLSearchParams({
          key: googleKey,
          input: q,
          language: 'th',
          components: 'country:th',
        }).toString();

      const res = await fetch(url);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return json({ error: 'google_http_error', status: res.status }, 502);

      if (data?.status !== 'OK' && data?.status !== 'ZERO_RESULTS') {
        return json({ error: 'google_error', status: data?.status, message: data?.error_message }, 502);
      }

      return json({ predictions: data?.predictions ?? [] });
    }

    if (body.action === 'details') {
      const placeId = String((body as any).place_id ?? '').trim();
      if (!placeId) return json({ error: 'place_id_required' }, 400);

      const url =
        `${GOOGLE_BASE}/details/json?` +
        new URLSearchParams({
          key: googleKey,
          place_id: placeId,
          language: 'th',
          fields: 'name,formatted_address,geometry,url',
        }).toString();

      const res = await fetch(url);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return json({ error: 'google_http_error', status: res.status }, 502);
      if (data?.status !== 'OK') {
        return json({ error: 'google_error', status: data?.status, message: data?.error_message }, 502);
      }
      return json({ result: data?.result ?? {} });
    }

    if (body.action === 'reverse_geocode') {
      const lat = Number((body as any).lat);
      const lng = Number((body as any).lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        return json({ error: 'lat_lng_required' }, 400);
      }

      const url =
        `https://maps.googleapis.com/maps/api/geocode/json?` +
        new URLSearchParams({
          key: googleKey,
          latlng: `${lat},${lng}`,
          language: 'th',
          region: 'th',
        }).toString();

      const res = await fetch(url);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return json({ error: 'google_http_error', status: res.status }, 502);
      if (data?.status !== 'OK' && data?.status !== 'ZERO_RESULTS') {
        return json({ error: 'google_error', status: data?.status, message: data?.error_message }, 502);
      }

      const first = (data?.results?.[0] ?? {}) as Record<string, unknown>;
      return json({ result: first });
    }

    return json({ error: 'invalid_action' }, 400);
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

