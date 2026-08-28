-- ============================================================================
-- PSUSCC Shop: สินค้า ตะกร้า คำสั่งซื้อ จัดส่ง ที่อยู่ (รันหลัง is_admin())
-- ============================================================================

-- -----------------------------------------------------------------------------
-- 1) ตารางหลัก
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.shop_categories (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  slug        text NOT NULL UNIQUE,
  sort_order  int NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.shop_products (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id    uuid REFERENCES public.shop_categories(id) ON DELETE SET NULL,
  name           text NOT NULL,
  description    text,
  product_type   text NOT NULL DEFAULT 'simple'
    CHECK (product_type IN ('simple', 'apparel')),
  base_price     numeric(12,2),
  image_urls     jsonb NOT NULL DEFAULT '[]'::jsonb,
  sale_starts_at timestamptz,
  sale_ends_at   timestamptz,
  is_published   boolean NOT NULL DEFAULT false,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_shop_products_category ON public.shop_products(category_id);
CREATE INDEX IF NOT EXISTS idx_shop_products_published ON public.shop_products(is_published);

CREATE TABLE IF NOT EXISTS public.shop_product_variants (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id         uuid NOT NULL REFERENCES public.shop_products(id) ON DELETE CASCADE,
  size_label         text,
  price              numeric(12,2) NOT NULL,
  sku                text,
  stock_quantity     int NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0),
  low_stock_threshold int,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_shop_variants_product ON public.shop_product_variants(product_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_shop_variant_size_per_product
  ON public.shop_product_variants (product_id, size_label)
  WHERE size_label IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_shop_variant_single_non_size
  ON public.shop_product_variants (product_id)
  WHERE size_label IS NULL;

CREATE TABLE IF NOT EXISTS public.shop_shipping_methods (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code             text NOT NULL UNIQUE,
  name             text NOT NULL,
  base_fee         numeric(12,2) NOT NULL DEFAULT 0,
  free_over_amount numeric(12,2),
  sort_order       int NOT NULL DEFAULT 0,
  is_active        boolean NOT NULL DEFAULT true,
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- ตั้งค่าที่ไม่ลับ (ค่าธรรมเนียมเพิ่ม ฯลฯ)
CREATE TABLE IF NOT EXISTS public.shop_carrier_settings (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  carrier             text NOT NULL DEFAULT 'thai_post' UNIQUE,
  shipping_markup_baht numeric(12,2) NOT NULL DEFAULT 0,
  token_is_set        boolean NOT NULL DEFAULT false,
  updated_at          timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.shop_carrier_settings (carrier)
VALUES ('thai_post')
ON CONFLICT (carrier) DO NOTHING;

-- token ไม่ให้ client อ่านผ่าน PostgREST — ไม่มี policy สำหรับ authenticated
CREATE TABLE IF NOT EXISTS public.shop_carrier_secrets (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  carrier    text NOT NULL DEFAULT 'thai_post' UNIQUE,
  api_token  text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.shop_carrier_secrets (carrier)
VALUES ('thai_post')
ON CONFLICT (carrier) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.shop_user_addresses (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name       text NOT NULL,
  phone           text NOT NULL,
  address_line    text NOT NULL,
  province_id     int,
  district_id     int,
  subdistrict_id  int,
  province_name   text,
  district_name   text,
  subdistrict_name text,
  postal_code     text,
  is_default      boolean NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_shop_addresses_user ON public.shop_user_addresses(user_id);

CREATE TABLE IF NOT EXISTS public.shop_carts (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.shop_cart_items (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cart_id     uuid NOT NULL REFERENCES public.shop_carts(id) ON DELETE CASCADE,
  variant_id  uuid NOT NULL REFERENCES public.shop_product_variants(id) ON DELETE CASCADE,
  quantity    int NOT NULL CHECK (quantity > 0),
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (cart_id, variant_id)
);

CREATE INDEX IF NOT EXISTS idx_shop_cart_items_cart ON public.shop_cart_items(cart_id);

CREATE TABLE IF NOT EXISTS public.shop_orders (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status               text NOT NULL DEFAULT 'pending_payment'
    CHECK (status IN (
      'pending_payment', 'payment_review', 'paid', 'fulfilling',
      'shipped', 'completed', 'cancelled', 'payment_failed'
    )),
  subtotal             numeric(12,2) NOT NULL DEFAULT 0,
  shipping_fee         numeric(12,2) NOT NULL DEFAULT 0,
  total                numeric(12,2) NOT NULL DEFAULT 0,
  shipping_method_id   uuid REFERENCES public.shop_shipping_methods(id) ON DELETE SET NULL,
  user_address_id      uuid REFERENCES public.shop_user_addresses(id) ON DELETE SET NULL,
  slip_url             text,
  slipok_payload       jsonb,
  payment_verified_at  timestamptz,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_shop_orders_user ON public.shop_orders(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.shop_order_items (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id    uuid NOT NULL REFERENCES public.shop_orders(id) ON DELETE CASCADE,
  product_id  uuid NOT NULL REFERENCES public.shop_products(id) ON DELETE RESTRICT,
  variant_id  uuid NOT NULL REFERENCES public.shop_product_variants(id) ON DELETE RESTRICT,
  quantity    int NOT NULL CHECK (quantity > 0),
  unit_price  numeric(12,2) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_shop_order_items_order ON public.shop_order_items(order_id);

CREATE TABLE IF NOT EXISTS public.shop_shipments (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id        uuid NOT NULL UNIQUE REFERENCES public.shop_orders(id) ON DELETE CASCADE,
  tracking_number text,
  carrier         text NOT NULL DEFAULT 'thai_post',
  last_status     text,
  raw_response    jsonb,
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- Triggers updated_at
-- -----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_shop_products_updated ON public.shop_products;
CREATE TRIGGER trg_shop_products_updated
  BEFORE UPDATE ON public.shop_products
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

DROP TRIGGER IF EXISTS trg_shop_variants_updated ON public.shop_product_variants;
CREATE TRIGGER trg_shop_variants_updated
  BEFORE UPDATE ON public.shop_product_variants
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

DROP TRIGGER IF EXISTS trg_shop_orders_updated ON public.shop_orders;
CREATE TRIGGER trg_shop_orders_updated
  BEFORE UPDATE ON public.shop_orders
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

DROP TRIGGER IF EXISTS trg_shop_user_addresses_updated ON public.shop_user_addresses;
CREATE TRIGGER trg_shop_user_addresses_updated
  BEFORE UPDATE ON public.shop_user_addresses
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- -----------------------------------------------------------------------------
-- Stock: เมื่อสถานะเป็น paid ให้หักสต็อก
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.shop_deduct_stock_on_paid()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'paid' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'paid') THEN
    UPDATE public.shop_product_variants v
    SET stock_quantity = GREATEST(0, v.stock_quantity - oi.quantity)
    FROM public.shop_order_items oi
    WHERE oi.order_id = NEW.id AND oi.variant_id = v.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_shop_orders_deduct_stock ON public.shop_orders;
CREATE TRIGGER trg_shop_orders_deduct_stock
  AFTER INSERT OR UPDATE OF status ON public.shop_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.shop_deduct_stock_on_paid();

-- -----------------------------------------------------------------------------
-- RPC: สร้างคำสั่งซื้อ + ล้างตะกร้า (กันขายเกินสต็อกในทรานแซคชันเดียว)
-- p_lines: [{"variant_id":"uuid","quantity":3}, ...]
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.shop_place_order(
  p_lines jsonb,
  p_shipping_method_id uuid,
  p_user_address_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_order_id uuid;
  v_line jsonb;
  v_variant_id uuid;
  v_qty int;
  v_unit_price numeric(12,2);
  v_product_id uuid;
  v_stock int;
  v_subtotal numeric(12,2) := 0;
  v_ship_fee numeric(12,2) := 0;
  v_free_over numeric(12,2);
  v_total numeric(12,2);
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = 'check_violation';
  END IF;

  IF p_user_address_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.shop_user_addresses a
    WHERE a.id = p_user_address_id AND a.user_id = v_uid
  ) THEN
    RAISE EXCEPTION 'invalid_address' USING ERRCODE = 'check_violation';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.shop_shipping_methods sm
    WHERE sm.id = p_shipping_method_id AND sm.is_active
  ) THEN
    RAISE EXCEPTION 'invalid_shipping' USING ERRCODE = 'check_violation';
  END IF;

  SELECT sm.base_fee, sm.free_over_amount
  INTO v_ship_fee, v_free_over
  FROM public.shop_shipping_methods sm
  WHERE sm.id = p_shipping_method_id;

  FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines)
  LOOP
    v_variant_id := (v_line->>'variant_id')::uuid;
    v_qty := (v_line->>'quantity')::int;

    IF v_qty IS NULL OR v_qty < 1 THEN
      RAISE EXCEPTION 'bad_quantity' USING ERRCODE = 'check_violation';
    END IF;

    SELECT v.price, v.product_id, v.stock_quantity
    INTO v_unit_price, v_product_id, v_stock
    FROM public.shop_product_variants v
    WHERE v.id = v_variant_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'variant_not_found' USING ERRCODE = 'check_violation';
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM public.shop_products p
      WHERE p.id = v_product_id AND p.is_published
        AND (p.sale_starts_at IS NULL OR p.sale_starts_at <= now())
        AND (p.sale_ends_at IS NULL OR p.sale_ends_at >= now())
    ) THEN
      RAISE EXCEPTION 'product_not_available' USING ERRCODE = 'check_violation';
    END IF;

    IF v_stock < v_qty THEN
      RAISE EXCEPTION 'insufficient_stock' USING ERRCODE = 'check_violation';
    END IF;

    v_subtotal := v_subtotal + (v_unit_price * v_qty);
  END LOOP;

  IF v_free_over IS NOT NULL AND v_subtotal >= v_free_over THEN
    v_ship_fee := 0;
  END IF;

  v_total := v_subtotal + v_ship_fee;

  INSERT INTO public.shop_orders (
    user_id, status, subtotal, shipping_fee, total,
    shipping_method_id, user_address_id
  )
  VALUES (
    v_uid, 'pending_payment', v_subtotal, v_ship_fee, v_total,
    p_shipping_method_id, p_user_address_id
  )
  RETURNING id INTO v_order_id;

  FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines)
  LOOP
    v_variant_id := (v_line->>'variant_id')::uuid;
    v_qty := (v_line->>'quantity')::int;

    SELECT price, product_id INTO v_unit_price, v_product_id
    FROM public.shop_product_variants WHERE id = v_variant_id;

    INSERT INTO public.shop_order_items (order_id, product_id, variant_id, quantity, unit_price)
    VALUES (v_order_id, v_product_id, v_variant_id, v_qty, v_unit_price);
  END LOOP;

  DELETE FROM public.shop_cart_items ci
  USING public.shop_carts c
  WHERE ci.cart_id = c.id AND c.user_id = v_uid;

  RETURN v_order_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.shop_place_order(jsonb, uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.shop_attach_payment_slip(p_order_id uuid, p_slip_url text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_n int;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = 'check_violation';
  END IF;
  UPDATE public.shop_orders
  SET slip_url = p_slip_url,
      status = 'payment_review',
      updated_at = now()
  WHERE id = p_order_id
    AND user_id = auth.uid()
    AND status = 'pending_payment';
  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n = 0 THEN
    RAISE EXCEPTION 'order_not_found_or_invalid_status' USING ERRCODE = 'check_violation';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.shop_attach_payment_slip(uuid, text) TO authenticated;

-- -----------------------------------------------------------------------------
-- RPC: บันทึก token ไปรษณีย์ไทย (เรียกจาก Edge Function หลังตรวจแอดมิน)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.shop_admin_set_carrier_token(p_token text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = 'check_violation';
  END IF;
  UPDATE public.shop_carrier_secrets
  SET api_token = NULLIF(trim(p_token), ''),
      updated_at = now()
  WHERE carrier = 'thai_post';

  UPDATE public.shop_carrier_settings
  SET token_is_set = (length(trim(COALESCE(p_token, ''))) > 0),
      updated_at = now()
  WHERE carrier = 'thai_post';
END;
$$;

GRANT EXECUTE ON FUNCTION public.shop_admin_set_carrier_token(text) TO authenticated;

-- -----------------------------------------------------------------------------
-- Seed ตัวอย่าง
-- -----------------------------------------------------------------------------
INSERT INTO public.shop_categories (name, slug, sort_order) VALUES
  ('เสื้อผ้า', 'wear', 1),
  ('อุปกรณ์', 'gear', 2),
  ('พิเศษ', 'limited', 3)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.shop_shipping_methods (code, name, base_fee, free_over_amount, sort_order)
VALUES
  ('thai_post_std', 'ไปรษณีย์ไทย (มาตรฐาน)', 50, 500, 1),
  ('pickup', 'รับที่จุดบริการ', 0, NULL, 2)
ON CONFLICT (code) DO NOTHING;

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
ALTER TABLE public.shop_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_shipping_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_carrier_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_carrier_secrets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_user_addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_carts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_cart_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_shipments ENABLE ROW LEVEL SECURITY;

-- Categories: อ่านได้ทุกคน
DROP POLICY IF EXISTS "shop_categories_select_all" ON public.shop_categories;
CREATE POLICY "shop_categories_select_all"
  ON public.shop_categories FOR SELECT TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "shop_categories_admin_write" ON public.shop_categories;
CREATE POLICY "shop_categories_admin_write"
  ON public.shop_categories FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Products
DROP POLICY IF EXISTS "shop_products_select_published" ON public.shop_products;
CREATE POLICY "shop_products_select_published"
  ON public.shop_products FOR SELECT TO anon, authenticated
  USING (
    is_published = true
    AND (sale_starts_at IS NULL OR sale_starts_at <= now())
    AND (sale_ends_at IS NULL OR sale_ends_at >= now())
  );

DROP POLICY IF EXISTS "shop_products_admin_all" ON public.shop_products;
CREATE POLICY "shop_products_admin_all"
  ON public.shop_products FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Variants (เฉพาะของสินค้าที่เผยแพร่)
DROP POLICY IF EXISTS "shop_variants_select_visible" ON public.shop_product_variants;
CREATE POLICY "shop_variants_select_visible"
  ON public.shop_product_variants FOR SELECT TO anon, authenticated
  USING (EXISTS (
    SELECT 1 FROM public.shop_products p
    WHERE p.id = product_id AND p.is_published = true
      AND (p.sale_starts_at IS NULL OR p.sale_starts_at <= now())
      AND (p.sale_ends_at IS NULL OR p.sale_ends_at >= now())
  ));

DROP POLICY IF EXISTS "shop_variants_admin_all" ON public.shop_product_variants;
CREATE POLICY "shop_variants_admin_all"
  ON public.shop_product_variants FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Shipping methods
DROP POLICY IF EXISTS "shop_shipping_select_active" ON public.shop_shipping_methods;
CREATE POLICY "shop_shipping_select_active"
  ON public.shop_shipping_methods FOR SELECT TO anon, authenticated
  USING (is_active = true);

DROP POLICY IF EXISTS "shop_shipping_admin_all" ON public.shop_shipping_methods;
CREATE POLICY "shop_shipping_admin_all"
  ON public.shop_shipping_methods FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Carrier settings (ไม่มี token)
DROP POLICY IF EXISTS "shop_carrier_settings_select_admin" ON public.shop_carrier_settings;
CREATE POLICY "shop_carrier_settings_select_admin"
  ON public.shop_carrier_settings FOR SELECT TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "shop_carrier_settings_update_admin" ON public.shop_carrier_settings;
CREATE POLICY "shop_carrier_settings_update_admin"
  ON public.shop_carrier_settings FOR UPDATE TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- shop_carrier_secrets: ไม่มี policy → client อ่าน/เขียนไม่ได้

-- Addresses
DROP POLICY IF EXISTS "shop_addresses_own" ON public.shop_user_addresses;
CREATE POLICY "shop_addresses_own"
  ON public.shop_user_addresses FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Carts
DROP POLICY IF EXISTS "shop_carts_own" ON public.shop_carts;
CREATE POLICY "shop_carts_own"
  ON public.shop_carts FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "shop_cart_items_own" ON public.shop_cart_items;
CREATE POLICY "shop_cart_items_own"
  ON public.shop_cart_items FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.shop_carts c
    WHERE c.id = cart_id AND c.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.shop_carts c
    WHERE c.id = cart_id AND c.user_id = auth.uid()
  ));

-- Orders
DROP POLICY IF EXISTS "shop_orders_select_own" ON public.shop_orders;
CREATE POLICY "shop_orders_select_own"
  ON public.shop_orders FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "shop_orders_admin_update" ON public.shop_orders;
CREATE POLICY "shop_orders_admin_update"
  ON public.shop_orders FOR UPDATE TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Order items
DROP POLICY IF EXISTS "shop_order_items_select" ON public.shop_order_items;
CREATE POLICY "shop_order_items_select"
  ON public.shop_order_items FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.shop_orders o
    WHERE o.id = order_id AND (o.user_id = auth.uid() OR public.is_admin())
  ));

DROP POLICY IF EXISTS "shop_order_items_admin_all" ON public.shop_order_items;
CREATE POLICY "shop_order_items_admin_all"
  ON public.shop_order_items FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Shipments
DROP POLICY IF EXISTS "shop_shipments_select" ON public.shop_shipments;
CREATE POLICY "shop_shipments_select"
  ON public.shop_shipments FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.shop_orders o
    WHERE o.id = order_id AND (o.user_id = auth.uid() OR public.is_admin())
  ));

DROP POLICY IF EXISTS "shop_shipments_admin_write" ON public.shop_shipments;
CREATE POLICY "shop_shipments_admin_write"
  ON public.shop_shipments FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- -----------------------------------------------------------------------------
-- Storage: product-images
-- -----------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('product-images', 'product-images', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "product_images_public_read" ON storage.objects;
CREATE POLICY "product_images_public_read"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'product-images');

DROP POLICY IF EXISTS "product_images_admin_insert" ON storage.objects;
CREATE POLICY "product_images_admin_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'product-images' AND public.is_admin());

DROP POLICY IF EXISTS "product_images_admin_update" ON storage.objects;
CREATE POLICY "product_images_admin_update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'product-images' AND public.is_admin())
  WITH CHECK (bucket_id = 'product-images' AND public.is_admin());

DROP POLICY IF EXISTS "product_images_admin_delete" ON storage.objects;
CREATE POLICY "product_images_admin_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'product-images' AND public.is_admin());

COMMENT ON TABLE public.shop_orders IS 'คำสั่งซื้อร้านค้า — ชำระผ่านสลิป + SlipOK (Edge)';
