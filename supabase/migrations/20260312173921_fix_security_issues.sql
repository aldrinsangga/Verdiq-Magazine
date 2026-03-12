/*
  # Fix Security Issues

  1. Remove Unused Indexes
    - Drop indexes that are not being used to improve write performance
    - Indexes: idx_reviews_user_id, idx_reviews_is_published, idx_reviews_created_at
    - Indexes: idx_purchases_user_id, idx_support_tickets_user_id, idx_support_tickets_status

  2. Fix Multiple Permissive Policies
    - Convert overlapping policies to single consolidated policies
    - Ensures proper access control hierarchy

  ## Changes

  ### Unused Indexes
  - Remove 6 unused indexes from reviews, purchases, and support_tickets tables

  ### Policy Fixes
  - Consolidate RLS policies to eliminate multiple permissive policies
  - Combine admin and user access into single policies with OR conditions
*/

-- Drop unused indexes
DROP INDEX IF EXISTS idx_reviews_user_id;
DROP INDEX IF EXISTS idx_reviews_is_published;
DROP INDEX IF EXISTS idx_reviews_created_at;
DROP INDEX IF EXISTS idx_purchases_user_id;
DROP INDEX IF EXISTS idx_support_tickets_user_id;
DROP INDEX IF EXISTS idx_support_tickets_status;

-- Fix purchases table policies (multiple permissive for SELECT)
DROP POLICY IF EXISTS "Users can view own purchases" ON purchases;
DROP POLICY IF EXISTS "Admins can view all purchases" ON purchases;

CREATE POLICY "Users and admins can view purchases"
  ON purchases FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND (users.role = 'admin' OR users.email IN ('verdiqmag@gmail.com', 'admin@verdiq.ai'))
    )
  );

-- Fix reviews table policies (multiple permissive for SELECT)
DROP POLICY IF EXISTS "Public can view published reviews" ON reviews;
DROP POLICY IF EXISTS "Users can view own reviews" ON reviews;

CREATE POLICY "Users can view accessible reviews"
  ON reviews FOR SELECT
  TO authenticated
  USING (
    is_published = true 
    OR user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND (users.role = 'admin' OR users.email IN ('verdiqmag@gmail.com', 'admin@verdiq.ai'))
    )
  );

-- Fix style_guides table policies (multiple permissive for SELECT)
DROP POLICY IF EXISTS "Public can view style guides" ON style_guides;
DROP POLICY IF EXISTS "Admins can manage style guides" ON style_guides;

CREATE POLICY "Anyone can view style guides"
  ON style_guides FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can insert style guides"
  ON style_guides FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND (users.role = 'admin' OR users.email IN ('verdiqmag@gmail.com', 'admin@verdiq.ai'))
    )
  );

CREATE POLICY "Admins can update style guides"
  ON style_guides FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND (users.role = 'admin' OR users.email IN ('verdiqmag@gmail.com', 'admin@verdiq.ai'))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND (users.role = 'admin' OR users.email IN ('verdiqmag@gmail.com', 'admin@verdiq.ai'))
    )
  );

CREATE POLICY "Admins can delete style guides"
  ON style_guides FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND (users.role = 'admin' OR users.email IN ('verdiqmag@gmail.com', 'admin@verdiq.ai'))
    )
  );

-- Fix support_tickets table policies (multiple permissive for INSERT, SELECT, UPDATE)
DROP POLICY IF EXISTS "Authenticated users can create support tickets" ON support_tickets;
DROP POLICY IF EXISTS "Admins can manage all tickets" ON support_tickets;
DROP POLICY IF EXISTS "Admins can view all tickets" ON support_tickets;
DROP POLICY IF EXISTS "Users can view own tickets" ON support_tickets;
DROP POLICY IF EXISTS "Users can update own tickets" ON support_tickets;

CREATE POLICY "Users can create support tickets"
  ON support_tickets FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid() OR user_id IS NULL
  );

CREATE POLICY "Users can view accessible tickets"
  ON support_tickets FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND (users.role = 'admin' OR users.email IN ('verdiqmag@gmail.com', 'admin@verdiq.ai'))
    )
  );

CREATE POLICY "Users can update accessible tickets"
  ON support_tickets FOR UPDATE
  TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND (users.role = 'admin' OR users.email IN ('verdiqmag@gmail.com', 'admin@verdiq.ai'))
    )
  )
  WITH CHECK (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND (users.role = 'admin' OR users.email IN ('verdiqmag@gmail.com', 'admin@verdiq.ai'))
    )
  );

CREATE POLICY "Admins can delete tickets"
  ON support_tickets FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND (users.role = 'admin' OR users.email IN ('verdiqmag@gmail.com', 'admin@verdiq.ai'))
    )
  );

-- Fix users table policies (multiple permissive for SELECT)
DROP POLICY IF EXISTS "Users can view own profile" ON users;
DROP POLICY IF EXISTS "Admins can view all users" ON users;

CREATE POLICY "Users can view accessible profiles"
  ON users FOR SELECT
  TO authenticated
  USING (
    id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM users AS admin_user
      WHERE admin_user.id = auth.uid() 
      AND (admin_user.role = 'admin' OR admin_user.email IN ('verdiqmag@gmail.com', 'admin@verdiq.ai'))
    )
  );
