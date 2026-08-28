---
name: psuscc-shop
description: Implements and maintains the PSUSCC in-app store on Supabase and Expo—catalog, cart, checkout with Thai address data, SlipOK slip verification via Edge Functions, Thailand Post tracking proxy, admin product/shipping/carrier settings. Use when working on shop_orders, shop_products, store screens under src/app/(tabs)/store, admin manage-shop, SlipOK, or Thai Post APIs.
disable-model-invocation: true
---

# PSUSCC Shop System

## Quick reference

- **Schema & RLS**: See [references/schema.md](references/schema.md)
- **SlipOK & Thailand Post**: See [references/integrations.md](references/integrations.md)

## App entry points

| Area | Path |
|------|------|
| Store tab (catalog) | [index.tsx](../../../src/app/(tabs)/store/index.tsx) |
| Product detail | [[id].tsx](../../../src/app/(tabs)/store/product/[id].tsx) |
| Cart / checkout / orders | [cart.tsx](../../../src/app/(tabs)/store/cart.tsx), [checkout.tsx](../../../src/app/(tabs)/store/checkout.tsx), [orders.tsx](../../../src/app/(tabs)/store/orders.tsx) |
| Order detail (slip, verify, track) | [[id].tsx](../../../src/app/(tabs)/store/order/[id].tsx) |
| Shop API hooks | [features/shop/](../../../src/features/shop/) |
| Thai address JSON | [thai-address-data.json](../../../src/assets/addresses/thai-address-data.json) |
| Hook | [useThaiAddress.ts](../../../src/hooks/useThaiAddress.ts) |
| Admin: products | [manage-shop.tsx](../../../src/app/(admin)/manage-shop.tsx), [shop-product-edit.tsx](../../../src/app/(admin)/shop-product-edit.tsx) |
| Admin: orders / tracking | [shop-admin-orders.tsx](../../../src/app/(admin)/shop-admin-orders.tsx) |
| Admin: shipping & carrier token | [shop-settings.tsx](../../../src/app/(admin)/shop-settings.tsx) |

## User flow (short)

1. Browse published `shop_products` within sale window · select variant (size/price) · add to `shop_cart_items`.
2. Checkout: collect `shop_user_addresses` (cascade จังหวัด/อำเภอ/ตำบล from bundled JSON), pick `shop_shipping_methods`, call RPC `shop_place_order` (clears cart, validates stock).
3. Upload slip to storage bucket `slips` · RPC `shop_attach_payment_slip` → status `payment_review`.
4. Edge Function `verify-shop-slip` calls SlipOK · on success sets `paid` and triggers stock deduction trigger.
5. User taps “อัปเดตสถานะพัสดุ” → Edge `track-parcel` uses token from `shop_carrier_secrets` / env.

## Admin flow (short)

- CRUD products & variants, images as URL list, sale dates, publish flag.
- Set Thailand Post API token via RPC `shop_admin_set_carrier_token` (from [shop-settings.tsx](../../../src/app/(admin)/shop-settings.tsx)); edit shipping fees on `shop_shipping_methods`.
- Enter tracking on [shop-admin-orders.tsx](../../../src/app/(admin)/shop-admin-orders.tsx) → upserts `shop_shipments`, sets order `shipped`.

## Migrations & Edge Functions

- Migration: [add_shop_system.sql](../../../supabase/migrations/add_shop_system.sql) (depends on `public.is_admin()`, `tg_set_updated_at()` from earlier migrations).
- Functions: [verify-shop-slip](../../../supabase/functions/verify-shop-slip), [track-parcel](../../../supabase/functions/track-parcel).

## Secrets (Supabase project)

Configure in Edge Function secrets / dashboard:

- `SLIPOK_API_KEY`, `SLIPOK_BRANCH_ID`, optional `SLIPOK_BASE_URL`
- Optional: `THAI_POST_TRACK_URL`, fallback token `THAI_POST_TOKEN` if DB token empty

## Slip URLs and privacy

SlipOK verifies using a **publicly reachable image URL**. If bucket `slips` is private, generate a long-lived signed URL in a server path or make objects public for the `shop-slips/` prefix—document the chosen policy for production.
