-- เสียงในแชทกลุ่มกิจกรรม (เก็บใน bucket chat-attachments เหมือนรูป)
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS audio_url text,
  ADD COLUMN IF NOT EXISTS audio_duration_ms integer;

COMMENT ON COLUMN public.messages.audio_url IS 'URL/path ใน storage.chat-attachments ใต้โฟลเดอร์ event-chat-voice/…';
COMMENT ON COLUMN public.messages.audio_duration_ms IS 'ความยาวการบันทึก (มิลลิวินาที)';
