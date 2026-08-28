-- Add map-based location fields to events
-- Stores chosen place name/text + lat/lng + optional Google place_id.

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS location_lat double precision,
  ADD COLUMN IF NOT EXISTS location_lng double precision,
  ADD COLUMN IF NOT EXISTS location_place_id text;

