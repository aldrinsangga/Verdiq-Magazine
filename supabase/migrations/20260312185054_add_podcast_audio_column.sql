/*
  # Add podcast_audio column to reviews table

  ## Summary
  The reviews table was missing the `podcast_audio` column used to store
  base64-encoded WAV audio data for the podcast feature. The code was trying
  to save `podcast_audio` but the table only had `podcast_audio_url`.

  ## Changes
  - reviews: Add `podcast_audio` column (text, nullable) to store base64 audio data
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'reviews' AND column_name = 'podcast_audio'
  ) THEN
    ALTER TABLE reviews ADD COLUMN podcast_audio text;
  END IF;
END $$;
