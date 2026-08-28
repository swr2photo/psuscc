# External integrations

## SlipOK

- SDK reference pattern: POST `{$SLIPOK_BASE_URL}/{$SLIPOK_BRANCH_ID}` with `FormData`: `url`, `amount`, `log`; header `x-authorization: {$SLIPOK_API_KEY}`.
- Default base: `https://api.slipok.com/api/line/apikey`.
- Edge implementation: [supabase/functions/verify-shop-slip/index.ts](../../../supabase/functions/verify-shop-slip/index.ts) — expects order in `payment_review` with `slip_url`; updates order to `paid` or `payment_failed`.

## Thailand Post tracking

- Developer API format varies by registration. Edge: [supabase/functions/track-parcel/index.ts](../../../supabase/functions/track-parcel/index.ts).
- Reads token from `shop_carrier_secrets.api_token` (service role) or env `THAI_POST_TOKEN`.
- Default POST URL env: `THAI_POST_TRACK_URL` (`https://trackapi.thailandpost.co.th/post/api/v1/track` placeholder).
- Request body used: `{ "barcode": ["TRACKNO"] }` with `Authorization: Token <token>` — **adjust to match your Thailand Post developer contract**.

## Address data

- Bundled: [src/assets/addresses/thai-address-data.json](../../../src/assets/addresses/thai-address-data.json) (compact format: `provinces[].id/n`, `districts[].id/n/p`, `subDistricts[].id/n/z/d`).
- Original source project: `D:\shop\psusccshop\public\thai-address-data.json` — keep in sync if that dataset updates.
