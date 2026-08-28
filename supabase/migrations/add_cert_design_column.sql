-- เพิ่มคอลัมน์ cert_design (JSONB) สำหรับเก็บการออกแบบเกียรติบัตรแบบขั้นสูงรายค่าย
-- รัน SQL นี้ใน Supabase SQL Editor 1 ครั้ง
-- Backward compatible: คอลัมน์เดิม (cert_template_url, cert_name_x ฯลฯ) ยังคงอยู่
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS cert_design JSONB;

COMMENT ON COLUMN public.events.cert_design IS
  'การตั้งค่าออกแบบเกียรติบัตรขั้นสูง: layoutStyle, fontFamily, subtitle, eventTitle, date, signature';
