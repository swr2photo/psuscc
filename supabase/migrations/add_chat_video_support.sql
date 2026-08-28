-- เพิ่มคอลัมน์สำหรับวิดีโอในแชท
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS video_url text;

COMMENT ON COLUMN public.messages.video_url IS 'URL/path ใน storage.chat-attachments สำหรับไฟล์วิดีโอ';
