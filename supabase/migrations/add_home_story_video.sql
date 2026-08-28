-- สตอรีวิดีโอ (สูงสุด 1 นาที)

ALTER TABLE public.home_stories
  ADD COLUMN IF NOT EXISTS media_type text NOT NULL DEFAULT 'image',
  ADD COLUMN IF NOT EXISTS duration_ms integer;

ALTER TABLE public.home_stories
  DROP CONSTRAINT IF EXISTS home_stories_media_type_check;

ALTER TABLE public.home_stories
  ADD CONSTRAINT home_stories_media_type_check
  CHECK (media_type IN ('image', 'video'));

-- วิดีโอ: บังคับไม่เกิน 60 วินาที (ถ้ามี duration)
ALTER TABLE public.home_stories
  DROP CONSTRAINT IF EXISTS home_stories_duration_check;

ALTER TABLE public.home_stories
  ADD CONSTRAINT home_stories_duration_check
  CHECK (duration_ms IS NULL OR (duration_ms > 0 AND duration_ms <= 60000));
