-- รูปในแชทกลุ่มกิจกรรม: ผู้ใช้ล็อกอินอัปโหลดได้, อ่านได้แบบ public (ให้ RN Image ใช้ตรงจาก URL)

INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-attachments', 'chat-attachments', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "chat_attachments_public_select" ON storage.objects;
CREATE POLICY "chat_attachments_public_select"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'chat-attachments');

DROP POLICY IF EXISTS "chat_attachments_authenticated_insert" ON storage.objects;
CREATE POLICY "chat_attachments_authenticated_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'chat-attachments');
