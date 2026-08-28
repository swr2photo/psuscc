-- สรุปยอดเช็กอินต่อกิจกรรม (event)
-- รันใน Supabase SQL Editor หลัง add_checkin_system.sql
--
-- แสดงเฉพาะกิจกรรมที่เคยมี session เช็กอิน หรือมีรายการ checkins

CREATE OR REPLACE VIEW public.v_checkin_summary_by_event AS
SELECT
  e.id AS event_id,
  e.title AS event_title,
  COUNT(c.id) FILTER (WHERE c.status = 'success') AS success_checkins,
  COUNT(DISTINCT c.user_id) FILTER (WHERE c.status = 'success') AS unique_attendees,
  COUNT(c.id) FILTER (WHERE c.status = 'out_of_range') AS out_of_range_count,
  (
    SELECT COUNT(*)::integer
    FROM public.checkin_sessions s
    WHERE s.event_id = e.id
  ) AS session_count
FROM public.events e
LEFT JOIN public.checkins c ON c.event_id = e.id
WHERE EXISTS (
    SELECT 1 FROM public.checkin_sessions s WHERE s.event_id = e.id
  )
  OR EXISTS (
    SELECT 1 FROM public.checkins x WHERE x.event_id = e.id
  )
GROUP BY e.id, e.title
ORDER BY success_checkins DESC, e.title ASC;

COMMENT ON VIEW public.v_checkin_summary_by_event IS
  'สรุปยอดเช็กอินต่อกิจกรรม: ครั้งสำเร็จ, จำนวนคนไม่ซ้ำ, session';

GRANT SELECT ON public.v_checkin_summary_by_event TO authenticated;
