-- จำกัดจำนวนครั้งเช็กอินสำเร็จต่อผู้ใช้ต่อค่าย (รวมทุก QR session ของ event เดียวกัน)
-- NULL = ไม่จำกัด

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS max_checkins_per_user integer
  CHECK (max_checkins_per_user IS NULL OR max_checkins_per_user >= 1);

COMMENT ON COLUMN public.events.max_checkins_per_user IS
  'เช็กอินสำเร็จได้สูงสุดกี่ครั้งต่อคนในค่ายนี้ (นับรวมทุก session). NULL = ไม่จำกัด';
