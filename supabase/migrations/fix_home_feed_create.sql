-- แก้สร้างโพสต์/สตอรีไม่ได้: storage policy + ความสัมพันธ์ profiles สำหรับ embed

-- อัปโหลดได้ทุก path ใน bucket (เหมือน chat-attachments)
DROP POLICY IF EXISTS "home_feed_auth_insert" ON storage.objects;
CREATE POLICY "home_feed_auth_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'home-feed');

-- ให้ PostgREST join profiles ได้ (user_id -> profiles.id)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'profiles'
  ) THEN
    ALTER TABLE public.home_posts DROP CONSTRAINT IF EXISTS home_posts_user_id_fkey;
    ALTER TABLE public.home_posts
      ADD CONSTRAINT home_posts_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

    ALTER TABLE public.home_stories DROP CONSTRAINT IF EXISTS home_stories_user_id_fkey;
    ALTER TABLE public.home_stories
      ADD CONSTRAINT home_stories_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;
END $$;
