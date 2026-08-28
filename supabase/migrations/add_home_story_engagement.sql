-- ผู้ชม / ไลก์ / ตอบกลับสตอรี

CREATE TABLE IF NOT EXISTS public.home_story_views (
  story_id   uuid NOT NULL REFERENCES public.home_stories(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  viewed_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (story_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_home_story_views_story
  ON public.home_story_views (story_id, viewed_at DESC);

CREATE TABLE IF NOT EXISTS public.home_story_likes (
  story_id   uuid NOT NULL REFERENCES public.home_stories(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (story_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_home_story_likes_story
  ON public.home_story_likes (story_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.home_story_replies (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id    uuid NOT NULL REFERENCES public.home_stories(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body        text NOT NULL CHECK (char_length(trim(body)) > 0),
  reply_type  text NOT NULL DEFAULT 'message' CHECK (reply_type IN ('reply', 'message')),
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_home_story_replies_story
  ON public.home_story_replies (story_id, created_at ASC);

ALTER TABLE public.home_story_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.home_story_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.home_story_replies ENABLE ROW LEVEL SECURITY;

-- บันทึกการดู (ไม่นับเจ้าของเป็นผู้ชม)
DROP POLICY IF EXISTS "home_story_views_insert_own" ON public.home_story_views;
CREATE POLICY "home_story_views_insert_own"
  ON public.home_story_views FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.home_stories s
      WHERE s.id = story_id
        AND s.expires_at > now()
        AND s.user_id <> auth.uid()
    )
  );

DROP POLICY IF EXISTS "home_story_views_update_own" ON public.home_story_views;
CREATE POLICY "home_story_views_update_own"
  ON public.home_story_views FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "home_story_views_select" ON public.home_story_views;
CREATE POLICY "home_story_views_select"
  ON public.home_story_views FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.home_stories s
      WHERE s.id = story_id AND s.user_id = auth.uid()
    )
  );

-- ไลก์
DROP POLICY IF EXISTS "home_story_likes_select" ON public.home_story_likes;
CREATE POLICY "home_story_likes_select"
  ON public.home_story_likes FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "home_story_likes_insert_own" ON public.home_story_likes;
CREATE POLICY "home_story_likes_insert_own"
  ON public.home_story_likes FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.home_stories s
      WHERE s.id = story_id AND s.expires_at > now()
    )
  );

DROP POLICY IF EXISTS "home_story_likes_delete_own" ON public.home_story_likes;
CREATE POLICY "home_story_likes_delete_own"
  ON public.home_story_likes FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- ตอบกลับ / ส่งข้อความ
DROP POLICY IF EXISTS "home_story_replies_select" ON public.home_story_replies;
CREATE POLICY "home_story_replies_select"
  ON public.home_story_replies FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.home_stories s
      WHERE s.id = story_id AND s.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "home_story_replies_insert_own" ON public.home_story_replies;
CREATE POLICY "home_story_replies_insert_own"
  ON public.home_story_replies FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.home_stories s
      WHERE s.id = story_id
        AND s.expires_at > now()
        AND COALESCE(s.allow_replies, true) = true
        AND s.user_id <> auth.uid()
    )
  );

DROP POLICY IF EXISTS "home_story_replies_delete_own" ON public.home_story_replies;
CREATE POLICY "home_story_replies_delete_own"
  ON public.home_story_replies FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());
