-- รีวิวสินค้าจากผู้ซื้อที่ชำระแล้ว + ยอดขายจริงจากคำสั่งซื้อ

ALTER TABLE public.shop_products
  ADD COLUMN IF NOT EXISTS units_sold int NOT NULL DEFAULT 0 CHECK (units_sold >= 0),
  ADD COLUMN IF NOT EXISTS rating_avg numeric(3,2) CHECK (rating_avg IS NULL OR (rating_avg >= 1 AND rating_avg <= 5)),
  ADD COLUMN IF NOT EXISTS review_count int NOT NULL DEFAULT 0 CHECK (review_count >= 0);

CREATE TABLE IF NOT EXISTS public.shop_product_reviews (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id            uuid NOT NULL REFERENCES public.shop_products(id) ON DELETE CASCADE,
  user_id               uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  order_id              uuid NOT NULL REFERENCES public.shop_orders(id) ON DELETE CASCADE,
  variant_id            uuid REFERENCES public.shop_product_variants(id) ON DELETE SET NULL,
  rating                int NOT NULL CHECK (rating >= 1 AND rating <= 5),
  body                  text,
  variant_label         text,
  reviewer_display_name text NOT NULL DEFAULT 'ผู้ใช้',
  helpful_count         int NOT NULL DEFAULT 0 CHECK (helpful_count >= 0),
  is_hidden             boolean NOT NULL DEFAULT false,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, order_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_shop_reviews_product_created
  ON public.shop_product_reviews (product_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_shop_reviews_order
  ON public.shop_product_reviews (order_id);

-- ชื่อที่แสดงในรีวิว (ไม่เปิดเผยชื่อเต็ม)
CREATE OR REPLACE FUNCTION public.shop_mask_display_name(p_name text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_name IS NULL OR length(trim(p_name)) = 0 THEN 'ผู้ใช้'
    WHEN length(trim(p_name)) <= 2 THEN left(trim(p_name), 1) || '***'
    ELSE left(trim(p_name), 1)
      || repeat('*', greatest(3, length(trim(p_name)) - 2))
      || right(trim(p_name), 1)
  END;
$$;

-- อัปเดตคะแนนเฉลี่ย / จำนวนรีวิวบนสินค้า
CREATE OR REPLACE FUNCTION public.shop_refresh_product_review_stats(p_product_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.shop_products p
  SET
    review_count = COALESCE((
      SELECT COUNT(*)::int
      FROM public.shop_product_reviews r
      WHERE r.product_id = p_product_id AND r.is_hidden = false
    ), 0),
    rating_avg = (
      SELECT ROUND(AVG(r.rating)::numeric, 2)
      FROM public.shop_product_reviews r
      WHERE r.product_id = p_product_id AND r.is_hidden = false
    )
  WHERE p.id = p_product_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.shop_reviews_stats_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_product_id uuid;
BEGIN
  v_product_id := COALESCE(NEW.product_id, OLD.product_id);
  PERFORM public.shop_refresh_product_review_stats(v_product_id);
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_shop_reviews_stats ON public.shop_product_reviews;
CREATE TRIGGER trg_shop_reviews_stats
  AFTER INSERT OR UPDATE OR DELETE ON public.shop_product_reviews
  FOR EACH ROW
  EXECUTE FUNCTION public.shop_reviews_stats_trigger();

-- หักสต็อก + นับยอดขายเมื่อชำระแล้ว
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

    UPDATE public.shop_products p
    SET units_sold = p.units_sold + agg.qty
    FROM (
      SELECT oi.product_id, SUM(oi.quantity)::int AS qty
      FROM public.shop_order_items oi
      WHERE oi.order_id = NEW.id
      GROUP BY oi.product_id
    ) agg
    WHERE p.id = agg.product_id;
  END IF;
  RETURN NEW;
END;
$$;

-- ส่งรีวิว (ต้องซื้อและชำระแล้ว)
CREATE OR REPLACE FUNCTION public.shop_submit_product_review(
  p_order_id uuid,
  p_product_id uuid,
  p_rating int,
  p_body text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_order public.shop_orders%ROWTYPE;
  v_item public.shop_order_items%ROWTYPE;
  v_name text;
  v_review_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'ต้องเข้าสู่ระบบก่อนรีวิว';
  END IF;

  IF p_rating IS NULL OR p_rating < 1 OR p_rating > 5 THEN
    RAISE EXCEPTION 'ให้คะแนน 1–5 ดาว';
  END IF;

  SELECT * INTO v_order FROM public.shop_orders WHERE id = p_order_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ไม่พบคำสั่งซื้อ';
  END IF;
  IF v_order.user_id <> v_uid THEN
    RAISE EXCEPTION 'ไม่มีสิทธิ์รีวิวคำสั่งซื้อนี้';
  END IF;
  IF v_order.status NOT IN ('paid', 'fulfilling', 'shipped', 'completed') THEN
    RAISE EXCEPTION 'รีวิวได้หลังชำระเงินแล้วเท่านั้น';
  END IF;

  SELECT * INTO v_item
  FROM public.shop_order_items
  WHERE order_id = p_order_id AND product_id = p_product_id
  LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'สินค้านี้ไม่อยู่ในคำสั่งซื้อ';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.shop_product_reviews
    WHERE user_id = v_uid AND order_id = p_order_id AND product_id = p_product_id
  ) THEN
    RAISE EXCEPTION 'คุณรีวิวสินค้านี้ในคำสั่งซื้อนี้แล้ว';
  END IF;

  SELECT full_name INTO v_name FROM public.profiles WHERE id = v_uid;

  INSERT INTO public.shop_product_reviews (
    product_id,
    user_id,
    order_id,
    variant_id,
    rating,
    body,
    variant_label,
    reviewer_display_name
  )
  VALUES (
    p_product_id,
    v_uid,
    p_order_id,
    v_item.variant_id,
    p_rating,
    NULLIF(trim(p_body), ''),
    (SELECT size_label FROM public.shop_product_variants WHERE id = v_item.variant_id),
    public.shop_mask_display_name(v_name)
  )
  RETURNING id INTO v_review_id;

  RETURN v_review_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.shop_submit_product_review(uuid, uuid, int, text) TO authenticated;

-- backfill ยอดขายจากคำสั่งซื้อที่ชำระแล้ว
UPDATE public.shop_products p
SET units_sold = COALESCE((
  SELECT SUM(oi.quantity)::int
  FROM public.shop_order_items oi
  JOIN public.shop_orders o ON o.id = oi.order_id
  WHERE oi.product_id = p.id
    AND o.status IN ('paid', 'fulfilling', 'shipped', 'completed')
), 0);

DROP TRIGGER IF EXISTS trg_shop_reviews_updated ON public.shop_product_reviews;
CREATE TRIGGER trg_shop_reviews_updated
  BEFORE UPDATE ON public.shop_product_reviews
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

ALTER TABLE public.shop_product_reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "shop_reviews_select_public" ON public.shop_product_reviews;
CREATE POLICY "shop_reviews_select_public"
  ON public.shop_product_reviews FOR SELECT TO anon, authenticated
  USING (
    is_hidden = false
    AND EXISTS (
      SELECT 1 FROM public.shop_products p
      WHERE p.id = product_id
        AND p.is_published = true
        AND (p.sale_starts_at IS NULL OR p.sale_starts_at <= now())
        AND (p.sale_ends_at IS NULL OR p.sale_ends_at >= now())
    )
  );

DROP POLICY IF EXISTS "shop_reviews_select_own" ON public.shop_product_reviews;
CREATE POLICY "shop_reviews_select_own"
  ON public.shop_product_reviews FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "shop_reviews_admin_all" ON public.shop_product_reviews;
CREATE POLICY "shop_reviews_admin_all"
  ON public.shop_product_reviews FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());
