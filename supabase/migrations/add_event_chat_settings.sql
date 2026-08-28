-- Chat room display (shared per event). If null, client falls back to title / cover.
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS chat_room_display_name text,
  ADD COLUMN IF NOT EXISTS chat_room_photo_url text;

-- Per-user nickname visible in that event's chat
CREATE TABLE IF NOT EXISTS public.event_chat_nicknames (
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  nickname text NOT NULL CHECK (
    length(trim(nickname)) > 0
    AND length(trim(nickname)) <= 40
  ),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (event_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_event_chat_nicknames_event ON public.event_chat_nicknames(event_id);

ALTER TABLE public.event_chat_nicknames ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS event_chat_nicknames_select_own_or_registered ON public.event_chat_nicknames;
CREATE POLICY event_chat_nicknames_select_own_or_registered
  ON public.event_chat_nicknames FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.event_registrations er
      WHERE er.event_id = event_chat_nicknames.event_id
        AND er.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS event_chat_nicknames_insert_own ON public.event_chat_nicknames;
CREATE POLICY event_chat_nicknames_insert_own
  ON public.event_chat_nicknames FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.event_registrations er
      WHERE er.event_id = event_chat_nicknames.event_id
        AND er.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS event_chat_nicknames_update_own ON public.event_chat_nicknames;
CREATE POLICY event_chat_nicknames_update_own
  ON public.event_chat_nicknames FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
