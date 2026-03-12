/*
  # Add is_subscribed column to users table

  1. Changes
    - Add `is_subscribed` boolean column with default false

  2. Notes
    - Column is nullable to support existing rows
    - Default value is false (free tier)
*/

-- Add is_subscribed column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'is_subscribed'
  ) THEN
    ALTER TABLE users ADD COLUMN is_subscribed boolean DEFAULT false;
  END IF;
END $$;
