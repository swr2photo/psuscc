-- ตั้งค่าโพสต์ / สตอรี (สถานที่, แท็กเพื่อน, ปิดคอมเมนต์/ไลก์)

ALTER TABLE public.home_posts
  ADD COLUMN IF NOT EXISTS location_label text,
  ADD COLUMN IF NOT EXISTS tagged_user_ids uuid[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS allow_comments boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS allow_likes boolean NOT NULL DEFAULT true;

ALTER TABLE public.home_stories
  ADD COLUMN IF NOT EXISTS location_label text,
  ADD COLUMN IF NOT EXISTS tagged_user_ids uuid[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS allow_replies boolean NOT NULL DEFAULT true;
