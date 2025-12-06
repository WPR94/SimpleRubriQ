-- Fix RLS policies to match actual schema with user_id
-- Run this in Supabase SQL Editor

-- Drop existing policies
DROP POLICY IF EXISTS "Profiles select own or admins" ON public.profiles;
DROP POLICY IF EXISTS "Profiles insert self" ON public.profiles;
DROP POLICY IF EXISTS "Profiles update self or admins" ON public.profiles;

-- Create simplified, non-recursive policies (avoid 500s from self-referencing EXISTS)
CREATE POLICY "Profiles select own"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Profiles insert self"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Profiles update self"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Optional: add a separate admin-only policy later via a SECURITY DEFINER function

-- Verify policies were created
SELECT policyname, cmd FROM pg_policies WHERE tablename = 'profiles';
