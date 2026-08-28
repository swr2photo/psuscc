-- รูปห้องแชทอยู่ใต้ path event-chat-room-avatar/… — เฉพาะแอดมินตาม public.is_admin()
DROP POLICY IF EXISTS "chat_attachments_authenticated_insert" ON storage.objects;
CREATE POLICY "chat_attachments_authenticated_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'chat-attachments'
    AND (
      name NOT LIKE 'event-chat-room-avatar/%'
      OR public.is_admin()
    )
  );
