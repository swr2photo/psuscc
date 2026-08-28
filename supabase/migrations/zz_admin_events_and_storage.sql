-- รันหลัง migration ที่สร้าง public.is_admin() (เช่น add_checkin_system.sql)
-- นโยบาย events มีผลเมื่อตาราง events เปิด RLS อยู่แล้ว — ไม่บังคับเปิด RLS ที่นี่ (กันแอปผู้ใช้หลุด)
-- Storage bucket certificates: อ่านเมื่อล็อกอิน + แอดมินอัปโหลด/ลบ

DROP POLICY IF EXISTS "events_admin_select" ON public.events;
CREATE POLICY "events_admin_select"
  ON public.events FOR SELECT
  TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "events_admin_insert" ON public.events;
CREATE POLICY "events_admin_insert"
  ON public.events FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "events_admin_update" ON public.events;
CREATE POLICY "events_admin_update"
  ON public.events FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "events_admin_delete" ON public.events;
CREATE POLICY "events_admin_delete"
  ON public.events FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- Storage: อ่านได้เมื่อล็อกอิน (ใช้กับ createSignedUrl แสดงรูปจาก bucket แบบ private)
DROP POLICY IF EXISTS "certificates_select_authenticated" ON storage.objects;
CREATE POLICY "certificates_select_authenticated"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'certificates');

DROP POLICY IF EXISTS "certificates_insert_admin" ON storage.objects;
CREATE POLICY "certificates_insert_admin"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'certificates' AND public.is_admin());

DROP POLICY IF EXISTS "certificates_update_admin" ON storage.objects;
CREATE POLICY "certificates_update_admin"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'certificates' AND public.is_admin())
  WITH CHECK (bucket_id = 'certificates' AND public.is_admin());

DROP POLICY IF EXISTS "certificates_delete_admin" ON storage.objects;
CREATE POLICY "certificates_delete_admin"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'certificates' AND public.is_admin());
