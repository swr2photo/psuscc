-- สตอรี + โพสต์หน้า Home (ผู้ใช้ล็อกอิน)

CREATE TABLE IF NOT EXISTS public.home_stories (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  image_url   text NOT NULL,
  caption     text,
  expires_at  timestamptz NOT NULL DEFAULT (now() + interval '24 hours'),
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_home_stories_user_created
  ON public.home_stories (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_home_stories_expires
  ON public.home_stories (expires_at DESC);

CREATE TABLE IF NOT EXISTS public.home_posts (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  image_url   text NOT NULL,
  caption     text,
  is_hidden   boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_home_posts_created
  ON public.home_posts (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_home_posts_user
  ON public.home_posts (user_id, created_at DESC);

-- Storage
INSERT INTO storage.buckets (id, name, public)
VALUES ('home-feed', 'home-feed', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "home_feed_public_select" ON storage.objects;
CREATE POLICY "home_feed_public_select"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'home-feed');

DROP POLICY IF EXISTS "home_feed_auth_insert" ON storage.objects;
CREATE POLICY "home_feed_auth_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'home-feed');

DROP POLICY IF EXISTS "home_feed_own_delete" ON storage.objects;
CREATE POLICY "home_feed_own_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'home-feed');

ALTER TABLE public.home_stories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.home_posts ENABLE ROW LEVEL SECURITY;

-- Stories: อ่านได้เมื่อยังไม่หมดอายุ
DROP POLICY IF EXISTS "home_stories_select_active" ON public.home_stories;
CREATE POLICY "home_stories_select_active"
  ON public.home_stories FOR SELECT TO authenticated
  USING (expires_at > now());

DROP POLICY IF EXISTS "home_stories_insert_own" ON public.home_stories;
CREATE POLICY "home_stories_insert_own"
  ON public.home_stories FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "home_stories_delete_own" ON public.home_stories;
CREATE POLICY "home_stories_delete_own"
  ON public.home_stories FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());

-- Posts
DROP POLICY IF EXISTS "home_posts_select_visible" ON public.home_posts;
CREATE POLICY "home_posts_select_visible"
  ON public.home_posts FOR SELECT TO authenticated
  USING (is_hidden = false OR user_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "home_posts_insert_own" ON public.home_posts;
CREATE POLICY "home_posts_insert_own"
  ON public.home_posts FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "home_posts_update_own" ON public.home_posts;
CREATE POLICY "home_posts_update_own"
  ON public.home_posts FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.is_admin())
  WITH CHECK (user_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "home_posts_delete_own" ON public.home_posts;
CREATE POLICY "home_posts_delete_own"
  ON public.home_posts FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());
