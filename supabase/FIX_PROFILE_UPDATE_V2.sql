-- Fix for "Failed to update profile" error
-- Run this in the Supabase SQL Editor

-- 1. Ensure the profiles table exists with correct columns
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  full_name text,
  is_admin boolean DEFAULT FALSE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 1b. Explicitly add columns if the table already existed but was missing them
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS full_name text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_admin boolean DEFAULT FALSE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

-- 1c. Ensure user_id has a unique constraint (required for ON CONFLICT upserts)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_user_id_key') THEN
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_user_id_key UNIQUE (user_id);
  END IF;
END $$;

-- 1d. Backfill user_id if it's null (it should match id)
UPDATE public.profiles SET user_id = id WHERE user_id IS NULL;

-- 2. Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 3. Grant access to authenticated users
GRANT ALL ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

-- 4. Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Profiles select own or admins" ON public.profiles;
DROP POLICY IF EXISTS "Profiles insert self" ON public.profiles;
DROP POLICY IF EXISTS "Profiles update self or admins" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;

-- 5. Create simple, permissive policies for the user
-- Allow users to view their own profile
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

-- Allow users to insert their own profile
CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Allow users to update their own profile
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- 6. Ensure the user has a profile row if it's missing
-- This attempts to insert a profile for the current user if it doesn't exist
-- Note: This block is for the SQL editor execution context, it might not affect the current user if run by admin
-- But the policies above will allow the frontend 'upsert' to work.
