-- ==============================================================================
-- KupKop QA fixes (D-031)
--   1. New SOS reports: server decides state, claim, clinic, hidden and urgency; the photo
--      must be a live-snaps object in the reporter's own folder; max 5 reports per 10 minutes
--   2. live-snaps uploads: own folder only, images only, 2 MB max
--   3. bills: uploader and admins only (was readable and writable by every signed-in user)
--   4. profiles: email and is_verified join role and facility_id as admin-only fields
--   5. Claims: one active rescue per volunteer at a time
--   6. Volunteers may apply to become clinic staff
-- ==============================================================================

-- 1. Sanitize every new report
CREATE OR REPLACE FUNCTION public.sanitize_new_sos_report()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_object TEXT;
BEGIN
  -- A report always starts open; claims, clinics and hiding only happen through their functions
  NEW.state := 'reported';
  NEW.claimed_by := NULL;
  NEW.claimed_at := NULL;
  NEW.facility_id := NULL;
  NEW.hidden_at := NULL;

  -- Urgency follows the emergency type (AGENTS.md escalation tiers), not the client
  NEW.urgency := CASE
    WHEN NEW.emergency_type IN ('hit_and_run', 'bleeding') THEN 'critical'::emergency_urgency
    WHEN NEW.emergency_type IN ('fracture', 'trapped_abused') THEN 'urgent'::emergency_urgency
    ELSE 'moderate'::emergency_urgency
  END;

  -- Live camera only: the photo must be one this reporter just uploaded to live-snaps
  v_object := split_part(split_part(COALESCE(NEW.photo_url, ''), '/storage/v1/object/public/live-snaps/', 2), '?', 1);
  IF NEW.photo_url NOT LIKE 'https://%.supabase.co/storage/v1/object/public/live-snaps/%'
     OR v_object NOT LIKE NEW.reporter_id::text || '/%'
     OR NOT EXISTS (SELECT 1 FROM storage.objects o WHERE o.bucket_id = 'live-snaps' AND o.name = v_object) THEN
    RAISE EXCEPTION 'The photo must come from the live camera upload.' USING ERRCODE = 'check_violation';
  END IF;

  IF (SELECT count(*) FROM public.sos_reports r
      WHERE r.reporter_id = NEW.reporter_id AND r.created_at > clock_timestamp() - INTERVAL '10 minutes') >= 5 THEN
    RAISE EXCEPTION 'Too many reports in a short time. Please wait a few minutes before sending another.'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sanitize_new_sos_report ON public.sos_reports;
CREATE TRIGGER trg_sanitize_new_sos_report
  BEFORE INSERT ON public.sos_reports
  FOR EACH ROW
  EXECUTE FUNCTION public.sanitize_new_sos_report();

-- 2. live-snaps: own folder, images only, 2 MB
UPDATE storage.buckets
SET file_size_limit = 2097152,
    allowed_mime_types = ARRAY['image/webp', 'image/jpeg', 'image/png']
WHERE id = 'live-snaps';

DROP POLICY IF EXISTS "Authenticated users can upload live-snaps" ON storage.objects;
CREATE POLICY "Authenticated users can upload live-snaps"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'live-snaps'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  );

-- 3. bills: private to the uploader and admins
DROP POLICY IF EXISTS "Authenticated users can view and upload bills" ON storage.objects;

DROP POLICY IF EXISTS "Bills readable by uploader or admin" ON storage.objects;
CREATE POLICY "Bills readable by uploader or admin"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'bills'
    AND ((storage.foldername(name))[1] = (SELECT auth.uid())::text OR public.is_admin())
  );

DROP POLICY IF EXISTS "Bills uploaded into own folder" ON storage.objects;
CREATE POLICY "Bills uploaded into own folder"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'bills'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  );

DROP POLICY IF EXISTS "Bills changed or removed by admin" ON storage.objects;
CREATE POLICY "Bills changed or removed by admin"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'bills' AND public.is_admin());

-- 4. Admin-only profile fields. Applies to app users (signed-in or anonymous API calls);
--    the SQL editor and the service role are not app users and keep full access.
CREATE OR REPLACE FUNCTION public.prevent_role_tampering()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF COALESCE(auth.jwt() ->> 'role', '') IN ('authenticated', 'anon')
     AND NOT public.is_admin()
     AND (NEW.role IS DISTINCT FROM OLD.role
          OR NEW.facility_id IS DISTINCT FROM OLD.facility_id
          OR NEW.email IS DISTINCT FROM OLD.email
          OR NEW.is_verified IS DISTINCT FROM OLD.is_verified) THEN
    RAISE EXCEPTION 'Only an admin can change role, clinic, email or verification on a profile.';
  END IF;
  RETURN NEW;
END;
$$;

-- 5. One active rescue per volunteer (admins exempt)
CREATE OR REPLACE FUNCTION public.claim_sos_report(p_report_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid UUID := (SELECT auth.uid());
  v_role user_role;
  v_report RECORD;
  v_now TIMESTAMPTZ := clock_timestamp();
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sign in required to claim a rescue');
  END IF;

  SELECT role INTO v_role FROM public.profiles WHERE id = v_uid;
  IF v_role IS NULL OR v_role NOT IN ('volunteer', 'admin') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only approved volunteers can claim a rescue');
  END IF;

  IF v_role <> 'admin' AND EXISTS (
    SELECT 1 FROM public.sos_reports r
    WHERE r.claimed_by = v_uid AND r.state = 'claimed' AND r.id <> p_report_id
      AND r.claimed_at > (v_now - INTERVAL '60 minutes')
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'You already have an active rescue. Admit or release it first.');
  END IF;

  SELECT * INTO v_report FROM public.sos_reports WHERE id = p_report_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Report not found');
  END IF;

  IF v_report.state NOT IN ('reported', 'claimed') THEN
    RETURN jsonb_build_object('success', false, 'error', 'This case is already past the claim stage');
  END IF;

  IF v_report.state = 'claimed'
     AND v_report.claimed_by IS NOT NULL
     AND v_report.claimed_by <> v_uid
     AND v_report.claimed_at > (v_now - INTERVAL '60 minutes') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Already claimed by another rescuer',
      'claimed_at', v_report.claimed_at
    );
  END IF;

  UPDATE public.sos_reports
  SET claimed_by = v_uid, claimed_at = v_now, state = 'claimed', updated_at = v_now
  WHERE id = p_report_id;

  RETURN jsonb_build_object(
    'success', true,
    'report_id', p_report_id,
    'claimed_by', v_uid,
    'claimed_at', v_now,
    'lock_duration_minutes', 60
  );
END;
$$;

REVOKE ALL ON FUNCTION public.claim_sos_report(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_sos_report(UUID) TO authenticated;

-- 6. Citizens apply for either role; volunteers may apply to become clinic staff
DROP POLICY IF EXISTS "Users submit own pending application" ON public.role_applications;
CREATE POLICY "Users submit own pending application"
  ON public.role_applications FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT auth.uid()) = user_id
    AND status = 'pending'
    AND reviewed_at IS NULL
    AND reviewed_by IS NULL
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (SELECT auth.uid())
        AND (p.role = 'citizen' OR (p.role = 'volunteer' AND requested_role = 'facility'))
    )
  );
