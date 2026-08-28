-- ไลก์ / คอมเมนต์ / บันทึกโพสต์หน้า Home

ALTER TABLE public.home_posts
  ADD COLUMN IF NOT EXISTS like_count int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS comment_count int NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.home_post_likes (
  post_id    uuid NOT NULL REFERENCES public.home_posts(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_home_post_likes_user
  ON public.home_post_likes (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.home_post_comments (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id    uuid NOT NULL REFERENCES public.home_posts(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body       text NOT NULL CHECK (char_length(trim(body)) > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_home_post_comments_post
  ON public.home_post_comments (post_id, created_at ASC);

CREATE TABLE IF NOT EXISTS public.home_post_saves (
  post_id    uuid NOT NULL REFERENCES public.home_posts(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_home_post_saves_user
  ON public.home_post_saves (user_id, created_at DESC);

-- Counters
CREATE OR REPLACE FUNCTION public.home_post_refresh_like_count(p_post_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.home_posts
  SET like_count = (SELECT count(*)::int FROM public.home_post_likes WHERE post_id = p_post_id)
  WHERE id = p_post_id;
$$;

CREATE OR REPLACE FUNCTION public.home_post_refresh_comment_count(p_post_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.home_posts
  SET comment_count = (SELECT count(*)::int FROM public.home_post_comments WHERE post_id = p_post_id)
  WHERE id = p_post_id;
$$;

CREATE OR REPLACE FUNCTION public.home_post_likes_count_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.home_post_refresh_like_count(NEW.post_id);
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM public.home_post_refresh_like_count(OLD.post_id);
  END IF;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.home_post_comments_count_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.home_post_refresh_comment_count(NEW.post_id);
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM public.home_post_refresh_comment_count(OLD.post_id);
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_home_post_likes_count ON public.home_post_likes;
CREATE TRIGGER trg_home_post_likes_count
  AFTER INSERT OR DELETE ON public.home_post_likes
  FOR EACH ROW EXECUTE FUNCTION public.home_post_likes_count_trigger();

DROP TRIGGER IF EXISTS trg_home_post_comments_count ON public.home_post_comments;
CREATE TRIGGER trg_home_post_comments_count
  AFTER INSERT OR DELETE ON public.home_post_comments
  FOR EACH ROW EXECUTE FUNCTION public.home_post_comments_count_trigger();

-- Backfill counts for existing posts
UPDATE public.home_posts p
SET
  like_count = COALESCE((SELECT count(*)::int FROM public.home_post_likes l WHERE l.post_id = p.id), 0),
  comment_count = COALESCE((SELECT count(*)::int FROM public.home_post_comments c WHERE c.post_id = p.id), 0);

ALTER TABLE public.home_post_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.home_post_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.home_post_saves ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "home_post_likes_select" ON public.home_post_likes;
CREATE POLICY "home_post_likes_select"
  ON public.home_post_likes FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "home_post_likes_insert_own" ON public.home_post_likes;
CREATE POLICY "home_post_likes_insert_own"
  ON public.home_post_likes FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "home_post_likes_delete_own" ON public.home_post_likes;
CREATE POLICY "home_post_likes_delete_own"
  ON public.home_post_likes FOR DELETE TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "home_post_comments_select" ON public.home_post_comments;
CREATE POLICY "home_post_comments_select"
  ON public.home_post_comments FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "home_post_comments_insert_own" ON public.home_post_comments;
CREATE POLICY "home_post_comments_insert_own"
  ON public.home_post_comments FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "home_post_comments_delete_own" ON public.home_post_comments;
CREATE POLICY "home_post_comments_delete_own"
  ON public.home_post_comments FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "home_post_saves_select_own" ON public.home_post_saves;
CREATE POLICY "home_post_saves_select_own"
  ON public.home_post_saves FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "home_post_saves_insert_own" ON public.home_post_saves;
CREATE POLICY "home_post_saves_insert_own"
  ON public.home_post_saves FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "home_post_saves_delete_own" ON public.home_post_saves;
CREATE POLICY "home_post_saves_delete_own"
  ON public.home_post_saves FOR DELETE TO authenticated
  USING (user_id = auth.uid());
