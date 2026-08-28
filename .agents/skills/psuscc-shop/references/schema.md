# Shop schema (Postgres)

Prefix `shop_*`. Requires `public.is_admin()` from check-in migration.

## Tables

| Table | Notes |
|-------|--------|
| `shop_categories` | Public read; admin write |
| `shop_products` | `product_type` `simple \| apparel`, `image_urls` jsonb, `sale_starts_at` / `sale_ends_at`, `is_published` |
| `shop_product_variants` | `size_label`, `price`, `stock_quantity`; unique partial indexes on `(product_id, size_label)` and single NULL size per product |
| `shop_shipping_methods` | `base_fee`, `free_over_amount`, `is_active` |
| `shop_carrier_settings` | Non-secret; `shipping_markup_baht`, `token_is_set` |
| `shop_carrier_secrets` | `api_token` — **no RLS policies** → not readable via anon/authenticated PostgREST |
| `shop_user_addresses` | Per-user shipping addresses |
| `shop_carts` / `shop_cart_items` | Server-side cart for logged-in users |
| `shop_orders` | Status enum see migration CHECK |
| `shop_order_items` | Snapshot `unit_price` |
| `shop_shipments` | One row per order (`order_id` UNIQUE) |
| `shop_product_reviews` | Verified purchase reviews; `reviewer_display_name` masked |
| `shop_products.units_sold` | Incremented when order status → `paid` |
| `shop_products.rating_avg` / `review_count` | Maintained by review triggers |

## RPC

- `shop_place_order(p_lines jsonb, p_shipping_method_id uuid, p_user_address_id uuid)` — SECURITY DEFINER; validates stock and sale window; clears cart.
- `shop_attach_payment_slip(p_order_id, p_slip_url)` — user attaches slip, sets `payment_review`.
- `shop_submit_product_review(p_order_id, p_product_id, p_rating, p_body)` — buyer review after payment.
- `shop_admin_set_carrier_token(p_token text)` — admin only.

## Triggers

- `shop_deduct_stock_on_paid` — when `status` becomes `paid`, decrements variant stock from line items.

## Storage

- Bucket `product-images` — public read; admin write policies.
- Reuses `slips` bucket for payment slip uploads (align RLS with SlipOK URL requirements).
