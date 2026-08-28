-- Allow anonymous browsing of events on web (marketing / guest mode).
-- Admins retain full CRUD via events_admin_* policies when RLS is enabled.

DROP POLICY IF EXISTS "events_public_select" ON public.events;
CREATE POLICY "events_public_select"
  ON public.events
  FOR SELECT
  TO anon, authenticated
  USING (true);
