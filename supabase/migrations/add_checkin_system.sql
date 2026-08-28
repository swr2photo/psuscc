-- ============================================================================
-- ระบบเช็กอินด้วย QR Code (Check-in System)
-- รัน SQL นี้ใน Supabase SQL Editor 1 ครั้ง
--
-- ฟีเจอร์:
--   • แอดมินสร้าง QR Session แต่ละวันต่อกิจกรรม (event)
--   • กำหนดพิกัดสถานที่ + รัศมี (เมตร) ที่อนุญาตให้สแกน
--   • ตั้งช่วงเวลาเปิด-ปิด session ได้
--   • บันทึกผู้เช็กอินและสรุปยอดต่อวัน
-- ============================================================================

-- 1) ตารางหลัก: checkin_sessions ----------------------------------------------
CREATE TABLE IF NOT EXISTS public.checkin_sessions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id        uuid REFERENCES public.events(id) ON DELETE CASCADE,
  session_date    date NOT NULL DEFAULT CURRENT_DATE,
  title           text NOT NULL,
  qr_token        text NOT NULL UNIQUE,
  start_time      timestamptz NOT NULL,
  end_time        timestamptz NOT NULL,
  is_active       boolean NOT NULL DEFAULT true,
  -- ตำแหน่งและรัศมีที่อนุญาตให้เช็กอิน (geofence)
  location_name   text,
  location_lat    double precision,
  location_lng    double precision,
  location_radius integer NOT NULL DEFAULT 100, -- เมตร
  enforce_location boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  created_by      uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_checkin_sessions_event_date
  ON public.checkin_sessions(event_id, session_date DESC);
CREATE INDEX IF NOT EXISTS idx_checkin_sessions_qr_token
  ON public.checkin_sessions(qr_token);
CREATE INDEX IF NOT EXISTS idx_checkin_sessions_active
  ON public.checkin_sessions(is_active, session_date);

COMMENT ON TABLE public.checkin_sessions IS
  'QR Session ของระบบเช็กอินรายวัน (กำหนดเวลา/พื้นที่/สถานะ)';

-- 2) ตารางบันทึก: checkins ----------------------------------------------------
CREATE TABLE IF NOT EXISTS public.checkins (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id      uuid REFERENCES public.checkin_sessions(id) ON DELETE CASCADE,
  event_id        uuid REFERENCES public.events(id) ON DELETE SET NULL,
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  checkin_at      timestamptz NOT NULL DEFAULT now(),
  user_lat        double precision,
  user_lng        double precision,
  distance_meters integer,
  status          text NOT NULL DEFAULT 'success'
    CHECK (status IN ('success', 'out_of_range', 'expired', 'duplicate', 'inactive')),
  note            text,
  UNIQUE (session_id, user_id) -- เช็กอินซ้ำใน session เดียวกันไม่ได้
);

CREATE INDEX IF NOT EXISTS idx_checkins_session ON public.checkins(session_id);
CREATE INDEX IF NOT EXISTS idx_checkins_user    ON public.checkins(user_id);
CREATE INDEX IF NOT EXISTS idx_checkins_event_day
  ON public.checkins(event_id, (checkin_at::date));

COMMENT ON TABLE public.checkins IS
  'บันทึกการเช็กอินของผู้ใช้ พร้อมพิกัดและสถานะ';

-- 3) Trigger: อัปเดต updated_at อัตโนมัติ -------------------------------------
CREATE OR REPLACE FUNCTION public.tg_set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;$$;

DROP TRIGGER IF EXISTS trg_checkin_sessions_updated_at ON public.checkin_sessions;
CREATE TRIGGER trg_checkin_sessions_updated_at
  BEFORE UPDATE ON public.checkin_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_set_updated_at();

-- 4) Helper function: เช็กว่า user ปัจจุบันเป็น admin หรือไม่ ----------------
--    รองรับทั้ง profiles.role = 'admin' และ email ที่อยู่ใน whitelist
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role = 'admin'
    )
    OR EXISTS (
      SELECT 1
      FROM auth.users u
      WHERE u.id = auth.uid()
        -- ปรับ whitelist อีเมลแอดมินได้ที่นี่
        AND u.email = ANY (ARRAY['doralaikon.th@gmail.com'])
    );
$$;

GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- 5) RLS (Row Level Security) -------------------------------------------------
ALTER TABLE public.checkin_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checkins         ENABLE ROW LEVEL SECURITY;

-- ผู้ใช้ทุกคนที่ login อ่าน sessions ได้ (เพื่อตรวจสอบสถานะ session)
DROP POLICY IF EXISTS "checkin_sessions_select_all" ON public.checkin_sessions;
CREATE POLICY "checkin_sessions_select_all"
  ON public.checkin_sessions FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- เฉพาะ admin เพิ่ม/แก้/ลบ sessions
DROP POLICY IF EXISTS "checkin_sessions_admin_all" ON public.checkin_sessions;
CREATE POLICY "checkin_sessions_admin_all"
  ON public.checkin_sessions FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ผู้ใช้สร้าง check-in ของตัวเองได้
DROP POLICY IF EXISTS "checkins_insert_self" ON public.checkins;
CREATE POLICY "checkins_insert_self"
  ON public.checkins FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ผู้ใช้ดูเช็กอินของตัวเองได้ และ admin ดูได้ทั้งหมด
DROP POLICY IF EXISTS "checkins_select_self_or_admin" ON public.checkins;
CREATE POLICY "checkins_select_self_or_admin"
  ON public.checkins FOR SELECT
  USING (auth.uid() = user_id OR public.is_admin());

-- เฉพาะ admin ลบ check-in
DROP POLICY IF EXISTS "checkins_admin_delete" ON public.checkins;
CREATE POLICY "checkins_admin_delete"
  ON public.checkins FOR DELETE
  USING (public.is_admin());

-- 6) View สรุปรายวัน ----------------------------------------------------------
CREATE OR REPLACE VIEW public.v_checkin_daily_summary AS
SELECT
  s.id           AS session_id,
  s.event_id,
  s.title,
  s.session_date,
  s.start_time,
  s.end_time,
  s.is_active,
  s.location_name,
  e.title        AS event_title,
  COUNT(c.id) FILTER (WHERE c.status = 'success')      AS success_count,
  COUNT(c.id) FILTER (WHERE c.status = 'out_of_range') AS out_of_range_count,
  COUNT(c.id) FILTER (WHERE c.status = 'duplicate')    AS duplicate_count,
  COUNT(c.id)                                          AS total_attempts
FROM public.checkin_sessions s
LEFT JOIN public.checkins c ON c.session_id = s.id
LEFT JOIN public.events   e ON e.id = s.event_id
GROUP BY s.id, e.title
ORDER BY s.session_date DESC, s.start_time DESC;

GRANT SELECT ON public.v_checkin_daily_summary TO authenticated;
