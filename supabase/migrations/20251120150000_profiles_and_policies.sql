-- Migration: profiles table and RLS policies
-- Timestamp: 2025-11-20 15:00:00

-- 1. Create profiles table (if not exists)
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  full_name text,
  is_admin boolean DEFAULT FALSE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 2. Policies (drop existing duplicates to avoid conflicts)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE policyname='Profiles select own or admins' AND tablename='profiles') THEN
    EXECUTE 'DROP POLICY "Profiles select own or admins" ON public.profiles';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE policyname='Profiles insert self' AND tablename='profiles') THEN
    EXECUTE 'DROP POLICY "Profiles insert self" ON public.profiles';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE policyname='Profiles update self or admins' AND tablename='profiles') THEN
    EXECUTE 'DROP POLICY "Profiles update self or admins" ON public.profiles';
  END IF;
END$$;

CREATE POLICY "Profiles select own or admins"
  ON public.profiles FOR SELECT
  USING (
    auth.uid() = id OR EXISTS (
      SELECT 1 FROM public.profiles p2 WHERE p2.id = auth.uid() AND p2.is_admin = TRUE
    )
  );

CREATE POLICY "Profiles insert self"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Profiles update self or admins"
  ON public.profiles FOR UPDATE
  USING (
    auth.uid() = id OR EXISTS (
      SELECT 1 FROM public.profiles p2 WHERE p2.id = auth.uid() AND p2.is_admin = TRUE
    )
  )
  WITH CHECK (
    auth.uid() = id OR EXISTS (
      SELECT 1 FROM public.profiles p2 WHERE p2.id = auth.uid() AND p2.is_admin = TRUE
    )
  );

-- 3. Helpful index
CREATE INDEX IF NOT EXISTS idx_profiles_is_admin ON public.profiles(is_admin) WHERE is_admin = TRUE;

COMMENT ON TABLE public.profiles IS 'User profile data and admin flag';
COMMENT ON COLUMN public.profiles.is_admin IS 'Admin privileges flag';
