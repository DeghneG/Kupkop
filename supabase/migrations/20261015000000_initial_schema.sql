-- ==============================================================================
-- KupKop Initial Schema & Security Migration
-- Tables: profiles, facilities, sos_reports, recovery_updates
-- Storage Buckets: live-snaps, bills, plate photos
-- RLS: Strict role protection (users cannot modify profiles.role)
-- ==============================================================================

-- 1. Custom Types (Idempotent creation via DO block)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
    CREATE TYPE user_role AS ENUM ('citizen', 'volunteer', 'facility', 'admin');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'case_state') THEN
    CREATE TYPE case_state AS ENUM ('reported', 'claimed', 'admitted', 'healing', 'resolved');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'emergency_urgency') THEN
    CREATE TYPE emergency_urgency AS ENUM ('critical', 'urgent', 'moderate');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'emergency_type') THEN
    CREATE TYPE emergency_type AS ENUM ('hit_and_run', 'bleeding', 'fracture', 'trapped_abused', 'sick_mange', 'other');
  END IF;
END $$;

-- 2. Profiles Table (linked to Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  phone TEXT,
  role user_role NOT NULL DEFAULT 'citizen',
  is_verified BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Facilities Table (Listed clinics/shelters with 14-day inactivity clock)
CREATE TABLE IF NOT EXISTS public.facilities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  phone TEXT NOT NULL,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  status TEXT NOT NULL DEFAULT 'Listed' CHECK (status IN ('Listed', 'Pending')),
  last_active_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. SOS Reports Table (Live camera emergencies with server-side timestamps)
CREATE TABLE IF NOT EXISTS public.sos_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  short_id TEXT NOT NULL UNIQUE, -- e.g. KK-4821
  reporter_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  animal_type TEXT NOT NULL CHECK (animal_type IN ('dog', 'cat', 'other')),
  emergency_type emergency_type NOT NULL,
  urgency emergency_urgency NOT NULL,
  state case_state NOT NULL DEFAULT 'reported',
  photo_url TEXT NOT NULL,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  location_name TEXT NOT NULL DEFAULT 'Location not set',
  claimed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  claimed_at TIMESTAMPTZ,
  facility_id UUID REFERENCES public.facilities(id) ON DELETE SET NULL,
  server_timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. Recovery Updates Table
CREATE TABLE IF NOT EXISTS public.recovery_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES public.sos_reports(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  notes TEXT NOT NULL,
  photo_url TEXT,
  state case_state NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------------------------
-- Automated Trigger: Create profile row on signup (Always defaults to 'citizen')
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    'citizen' -- Strictly hardcoded default, users can never self-assign roles
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ------------------------------------------------------------------------------
-- Row Level Security (RLS) Policies
-- ------------------------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.facilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sos_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recovery_updates ENABLE ROW LEVEL SECURITY;

-- Helper function to check if current user is admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = (SELECT auth.uid()) AND role = 'admin'
  );
$$;

-- PROFILES POLICIES
DROP POLICY IF EXISTS "Profiles are viewable by authenticated users" ON public.profiles;
CREATE POLICY "Profiles are viewable by authenticated users"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Profiles basic viewable by anon" ON public.profiles;
CREATE POLICY "Profiles basic viewable by anon"
  ON public.profiles FOR SELECT
  TO anon
  USING (true);

DROP POLICY IF EXISTS "Users can update own profile except role" ON public.profiles;
CREATE POLICY "Users can update own profile except role"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING ((SELECT auth.uid()) = id)
  WITH CHECK (
    (SELECT auth.uid()) = id
    AND role = (SELECT p.role FROM public.profiles p WHERE p.id = (SELECT auth.uid()))
  );

DROP POLICY IF EXISTS "Admins can update any profile" ON public.profiles;
CREATE POLICY "Admins can update any profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- FACILITIES POLICIES
DROP POLICY IF EXISTS "Facilities are viewable by everyone" ON public.facilities;
CREATE POLICY "Facilities are viewable by everyone"
  ON public.facilities FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Admins can insert or modify facilities" ON public.facilities;
CREATE POLICY "Admins can insert or modify facilities"
  ON public.facilities FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- SOS REPORTS POLICIES
DROP POLICY IF EXISTS "SOS reports are viewable by everyone" ON public.sos_reports;
CREATE POLICY "SOS reports are viewable by everyone"
  ON public.sos_reports FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Authenticated users can submit SOS reports" ON public.sos_reports;
CREATE POLICY "Authenticated users can submit SOS reports"
  ON public.sos_reports FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT auth.uid()) = reporter_id);

DROP POLICY IF EXISTS "Authorized users can update reports" ON public.sos_reports;
CREATE POLICY "Authorized users can update reports"
  ON public.sos_reports FOR UPDATE
  TO authenticated
  USING (
    (SELECT auth.uid()) = reporter_id
    OR (SELECT auth.uid()) = claimed_by
    OR public.is_admin()
  )
  WITH CHECK (
    (SELECT auth.uid()) = reporter_id
    OR (SELECT auth.uid()) = claimed_by
    OR public.is_admin()
  );

-- RECOVERY UPDATES POLICIES
DROP POLICY IF EXISTS "Recovery updates viewable by everyone" ON public.recovery_updates;
CREATE POLICY "Recovery updates viewable by everyone"
  ON public.recovery_updates FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Authenticated responders can insert updates" ON public.recovery_updates;
CREATE POLICY "Authenticated responders can insert updates"
  ON public.recovery_updates FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT auth.uid()) = author_id);

-- ------------------------------------------------------------------------------
-- Storage Buckets Configuration
-- live-snaps: Public read (for feed images), authenticated insert
-- bills: Authenticated read & insert
-- plate-photos: Private (reporter & admin only)
-- ------------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES 
  ('live-snaps', 'live-snaps', true),
  ('bills', 'bills', false),
  ('plate-photos', 'plate-photos', false)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS
DROP POLICY IF EXISTS "Public live-snaps images are viewable by everyone" ON storage.objects;
CREATE POLICY "Public live-snaps images are viewable by everyone"
  ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'live-snaps');

DROP POLICY IF EXISTS "Authenticated users can upload live-snaps" ON storage.objects;
CREATE POLICY "Authenticated users can upload live-snaps"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'live-snaps');

DROP POLICY IF EXISTS "Authenticated users can view and upload bills" ON storage.objects;
CREATE POLICY "Authenticated users can view and upload bills"
  ON storage.objects FOR ALL
  TO authenticated
  USING (bucket_id = 'bills')
  WITH CHECK (bucket_id = 'bills');

DROP POLICY IF EXISTS "Private plate photos viewable by reporter or admin" ON storage.objects;
CREATE POLICY "Private plate photos viewable by reporter or admin"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'plate-photos'
    AND (
      (storage.foldername(name))[1] = (SELECT auth.uid())::text
      OR public.is_admin()
    )
  );

DROP POLICY IF EXISTS "Authenticated users can upload private plate photos" ON storage.objects;
CREATE POLICY "Authenticated users can upload private plate photos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'plate-photos'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  );
