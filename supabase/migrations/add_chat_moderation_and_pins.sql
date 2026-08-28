-- ข้อความแชท: ยกเลิกส่ง / ผู้ใช้ซ่อนข้อความ / ปักหมุด / แอดมินล้างประวัติห้อง

ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS unsent_at timestamptz;

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS chat_cleared_at timestamptz,
  ADD COLUMN IF NOT EXISTS chat_pinned_message_id uuid REFERENCES public.messages(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS chat_pinned_at timestamptz,
  ADD COLUMN IF NOT EXISTS chat_pinned_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.messages.unsent_at IS 'ผู้ส่งเลิกส่งแล้ว';
COMMENT ON COLUMN public.events.chat_cleared_at IS 'แอดมินลบแชท — ซ่อนข้อความก่อนเวลานี้';
COMMENT ON COLUMN public.events.chat_pinned_message_id IS 'ข้อความปักหมุด (แอดมิน)';

CREATE TABLE IF NOT EXISTS public.chat_message_hidden (
  message_id uuid NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  hidden_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (message_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_chat_message_hidden_user ON public.chat_message_hidden(user_id);

ALTER TABLE public.chat_message_hidden ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS chat_message_hidden_select_own ON public.chat_message_hidden;
CREATE POLICY chat_message_hidden_select_own
  ON public.chat_message_hidden FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS chat_message_hidden_insert_own ON public.chat_message_hidden;
CREATE POLICY chat_message_hidden_insert_own
  ON public.chat_message_hidden FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS chat_message_hidden_delete_own ON public.chat_message_hidden;
CREATE POLICY chat_message_hidden_delete_own
  ON public.chat_message_hidden FOR DELETE TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS messages_owner_unsend_update ON public.messages;
CREATE POLICY messages_owner_unsend_update
  ON public.messages FOR UPDATE TO authenticated
  USING (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.event_registrations er
      WHERE er.event_id = messages.event_id
        AND er.user_id = auth.uid()
        AND er.status = 'registered'
    )
  )
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.event_registrations er
      WHERE er.event_id = messages.event_id
        AND er.user_id = auth.uid()
        AND er.status = 'registered'
    )
  );

CREATE OR REPLACE FUNCTION public.admin_pin_event_chat_message(p_event_id uuid, p_message_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'ไม่ได้รับอนุญาต';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.messages WHERE id = p_message_id AND event_id = p_event_id
  ) THEN
    RAISE EXCEPTION 'ไม่พบข้อความ';
  END IF;
  UPDATE public.events
    SET chat_pinned_message_id = p_message_id,
        chat_pinned_at = now(),
        chat_pinned_by = auth.uid()
  WHERE id = p_event_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_clear_event_chat(p_event_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'ไม่ได้รับอนุญาต';
  END IF;
  UPDATE public.events
    SET chat_cleared_at = now()
  WHERE id = p_event_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_unpin_event_chat(p_event_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'ไม่ได้รับอนุญาต';
  END IF;
  UPDATE public.events
    SET chat_pinned_message_id = NULL,
        chat_pinned_at = NULL,
        chat_pinned_by = NULL
  WHERE id = p_event_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_pin_event_chat_message(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_clear_event_chat(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_unpin_event_chat(uuid) TO authenticated;
