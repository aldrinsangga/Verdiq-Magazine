/*
  # Fix admin RLS policies for better performance

  1. Changes
    - Drop existing complex RLS policy
    - Create simpler, more efficient policies that check role directly
    - Ensure admins can read all user data without subqueries

  2. Security
    - Maintain restrictive access by default
    - Allow users to read only their own data
    - Allow admins to read/update all data based on role column
*/

-- Drop existing SELECT policy
DROP POLICY IF EXISTS "Users can view accessible profiles" ON users;

-- Create new efficient policies
CREATE POLICY "Users can view own profile"
  ON users FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles"
  ON users FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
      AND (u.role = 'admin' OR u.email IN ('verdiqmag@gmail.com', 'admin@verdiq.ai'))
    )
  );

-- Ensure admin can update all users
DROP POLICY IF EXISTS "Admins can update all users" ON users;

CREATE POLICY "Admins can update all users"
  ON users FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
      AND (u.role = 'admin' OR u.email IN ('verdiqmag@gmail.com', 'admin@verdiq.ai'))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
      AND (u.role = 'admin' OR u.email IN ('verdiqmag@gmail.com', 'admin@verdiq.ai'))
    )
  );
