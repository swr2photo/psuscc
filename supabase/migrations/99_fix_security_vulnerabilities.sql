-- ============================================================================
-- FIX SECURITY VULNERABILITIES
-- 1. Remove hardcoded admin email
-- 2. Secure qr_token in checkin_sessions
-- 3. Add server-side check-in validation (RPC)
-- ============================================================================

-- 1) Redefine is_admin() to remove hardcoded email -----------------------------
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
    );
$$;

-- 2) Secure checkin_sessions and qr_token --------------------------------------

-- Drop existing public select policy
DROP POLICY IF EXISTS "checkin_sessions_select_all" ON public.checkin_sessions;

-- Allow authenticated users to select only non-sensitive columns
-- Note: Postgres RLS doesn't natively support column-level masking in a single policy easily.
-- A better approach is to revoke select on the table and grant select on a view.

-- Revoke all on table from authenticated, then grant specific access
-- REVOKE ALL ON public.checkin_sessions FROM authenticated; -- This might be too aggressive for Supabase defaults

-- Instead, we'll keep the policy but change it to only allow admins to see everything.
-- Non-admins will use a view.
CREATE POLICY "checkin_sessions_select_admin"
  ON public.checkin_sessions FOR SELECT
  USING (public.is_admin());

-- Create a safe view for authenticated users (excludes qr_token)
CREATE OR REPLACE VIEW public.v_checkin_sessions_safe AS
SELECT
  id,
  event_id,
  session_date,
  title,
  start_time,
  end_time,
  is_active,
  location_name,
  location_lat,
  location_lng,
  location_radius,
  enforce_location,
  created_at,
  updated_at,
  created_by
FROM public.checkin_sessions;

GRANT SELECT ON public.v_checkin_sessions_safe TO authenticated;

-- 3) Server-side Check-in Logic (RPC) -----------------------------------------

CREATE OR REPLACE FUNCTION public.perform_checkin(
  p_qr_token text,
  p_lat double precision DEFAULT NULL,
  p_lng double precision DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER -- Runs with privileges of the creator (admin)
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_session record;
  v_distance integer;
  v_now timestamptz := now();
  v_event_checkin_count integer;
  v_max_checkins integer;
BEGIN
  -- Get current user
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('status', 'error', 'message', 'กรุณาเข้าสู่ระบบก่อนเช็กอิน');
  END IF;

  -- 1. Find the session by qr_token
  SELECT s.*, e.title as event_title, e.max_checkins_per_user
  INTO v_session
  FROM public.checkin_sessions s
  LEFT JOIN public.events e ON e.id = s.event_id
  WHERE s.qr_token = p_qr_token
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'inactive', 'message', 'ไม่พบ QR Code นี้ในระบบ กรุณาตรวจสอบจากแอดมินอีกครั้ง');
  END IF;

  -- 2. Validate session status and time
  IF NOT v_session.is_active THEN
    RETURN jsonb_build_object('status', 'inactive', 'message', 'แอดมินปิดการเช็กอิน QR นี้ไว้ชั่วคราว');
  END IF;

  IF v_now < v_session.start_time THEN
    RETURN jsonb_build_object('status', 'expired', 'message', 'ยังไม่ถึงเวลาเช็กอิน');
  END IF;

  IF v_now > v_session.end_time THEN
    RETURN jsonb_build_object('status', 'expired', 'message', 'หมดเวลาเช็กอินแล้ว');
  END IF;

  -- 3. Validate location (Geofence)
  IF v_session.enforce_location AND v_session.location_lat IS NOT NULL AND v_session.location_lng IS NOT NULL THEN
    IF p_lat IS NULL OR p_lng IS NULL THEN
      RETURN jsonb_build_object('status', 'out_of_range', 'message', 'ไม่สามารถอ่านตำแหน่งของคุณได้ กรุณาเปิด GPS');
    END IF;

    -- Simple Haversine approximation in SQL or use PostGIS if available
    -- For now, we'll use a standard formula
    v_distance := round(6371000 * acos(
      cos(radians(v_session.location_lat)) * cos(radians(p_lat)) *
      cos(radians(p_lng) - radians(v_session.location_lng)) +
      sin(radians(v_session.location_lat)) * sin(radians(p_lat))
    ));

    IF v_distance > v_session.location_radius THEN
      -- Log out of range attempt
      INSERT INTO public.checkins (session_id, event_id, user_id, user_lat, user_lng, distance_meters, status, note)
      VALUES (v_session.id, v_session.event_id, v_user_id, p_lat, p_lng, v_distance, 'out_of_range', 'นอกพื้นที่ที่กำหนด');
      
      RETURN jsonb_build_object(
        'status', 'out_of_range',
        'message', 'คุณอยู่ห่างจากจุดเช็กอิน ' || v_distance || ' ม.',
        'distanceMeters', v_distance
      );
    END IF;
  END IF;

  -- 4. Check for duplicates
  IF EXISTS (
    SELECT 1 FROM public.checkins
    WHERE session_id = v_session.id AND user_id = v_user_id AND status = 'success'
  ) THEN
    RETURN jsonb_build_object('status', 'duplicate', 'message', 'คุณเช็กอินรอบนี้ไปแล้ว');
  END IF;

  -- 5. Check event-wide limit
  IF v_session.event_id IS NOT NULL AND v_session.max_checkins_per_user IS NOT NULL AND v_session.max_checkins_per_user >= 1 THEN
    SELECT count(*) INTO v_event_checkin_count
    FROM public.checkins
    WHERE user_id = v_user_id AND event_id = v_session.event_id AND status = 'success';

    IF v_event_checkin_count >= v_session.max_checkins_per_user THEN
      RETURN jsonb_build_object(
        'status', 'limit_reached',
        'message', 'คุณใช้สิทธิ์เช็กอินครบ ' || v_session.max_checkins_per_user || ' ครั้งแล้วสำหรับค่ายนี้'
      );
    END IF;
  END IF;

  -- 6. Perform the check-in
  INSERT INTO public.checkins (session_id, event_id, user_id, user_lat, user_lng, distance_meters, status)
  VALUES (v_session.id, v_session.event_id, v_user_id, p_lat, p_lng, v_distance, 'success');

  RETURN jsonb_build_object(
    'status', 'success',
    'message', 'เช็กอินสำเร็จ ขอบคุณที่เข้าร่วมกิจกรรม!',
    'campName', v_session.event_title
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.perform_checkin(text, double precision, double precision) TO authenticated;

-- 4) Update checkins RLS to restrict successful inserts to RPC ----------------
-- This is optional but adds an extra layer of security.
-- If we want to prevent users from bypassing the RPC and inserting 'success' directly.
-- We can add a CHECK to the policy.

DROP POLICY IF EXISTS "checkins_insert_self" ON public.checkins;
CREATE POLICY "checkins_insert_self"
  ON public.checkins FOR INSERT
  WITH CHECK (
    auth.uid() = user_id 
    AND (
      -- Allow inserting non-success statuses (like out_of_range logs)
      status != 'success'
      -- Or if it's admin
      OR public.is_admin()
      -- In Supabase, RPC calls with SECURITY DEFINER will bypass RLS check for the creator,
      -- but if we want to be sure, we can keep it strict.
    )
  );
