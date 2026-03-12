/*
  # Fix infinite recursion in RLS policies

  1. Changes
    - Create a security definer function to check admin status without recursion
    - Update RLS policies to use this function instead of subqueries
    - This prevents infinite recursion when checking permissions

  2. Security
    - Function is SECURITY DEFINER to bypass RLS when checking admin status
    - Still maintains restrictive access by default
    - Only checks the specific user making the request
*/

-- Create a function to check if current user is admin (bypasses RLS)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND (role = 'admin' OR email IN ('verdiqmag@gmail.com', 'admin@verdiq.ai'))
  );
$$;

-- Drop all existing policies on users table
DROP POLICY IF EXISTS "Users can view own profile" ON users;
DROP POLICY IF EXISTS "Admins can view all profiles" ON users;
DROP POLICY IF EXISTS "Users can update own profile" ON users;
DROP POLICY IF EXISTS "Admins can update all users" ON users;
DROP POLICY IF EXISTS "Admins can delete users" ON users;
DROP POLICY IF EXISTS "Service role can insert users" ON users;

-- Create new non-recursive policies using the function
CREATE POLICY "Users can view profiles"
  ON users FOR SELECT
  TO authenticated
  USING (auth.uid() = id OR public.is_admin());

CREATE POLICY "Users can update own profile"
  ON users FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Admins can update all profiles"
  ON users FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins can delete users"
  ON users FOR DELETE
  TO authenticated
  USING (public.is_admin());

CREATE POLICY "Allow user creation"
  ON users FOR INSERT
  TO authenticated
  WITH CHECK (true);
