-- ==============================================================================
-- KupKop Hardening: claim / release / admit functions + direct-write RLS
-- Fixes:
--   * Identity comes from auth.uid() only (no spoofable p_volunteer_id / p_author_id)
--   * No NULL-role bypass: caller must have a profile with role volunteer/admin
--   * Strict state machine: reported -> claimed -> admitted
--   * Functions are not executable by anon / PUBLIC
--   * Reporters / claimers can no longer write sos_reports directly (which would
--     bypass the claim lock); all case transitions go through these functions
--   * recovery_updates inserts limited to the claimer, facility staff, or admin
-- ==============================================================================

-- 1. Remove the old, spoofable signatures
DROP FUNCTION IF EXISTS public.claim_sos_report(UUID, UUID);
DROP FUNCTION IF EXISTS public.release_sos_claim(UUID, UUID);
DROP FUNCTION IF EXISTS public.admit_to_facility(UUID, UUID, TEXT, UUID);

-- 2. Claim
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

-- 3. Release (claimer or admin, only while claimed)
CREATE OR REPLACE FUNCTION public.release_sos_claim(p_report_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid UUID := (SELECT auth.uid());
  v_report RECORD;
  v_now TIMESTAMPTZ := clock_timestamp();
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sign in required');
  END IF;

  SELECT * INTO v_report FROM public.sos_reports WHERE id = p_report_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Report not found');
  END IF;

  IF v_report.state <> 'claimed' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only a claimed case can be released');
  END IF;

  IF v_report.claimed_by IS DISTINCT FROM v_uid AND NOT public.is_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'You did not claim this rescue');
  END IF;

  UPDATE public.sos_reports
  SET claimed_by = NULL, claimed_at = NULL, state = 'reported', updated_at = v_now
  WHERE id = p_report_id;

  RETURN jsonb_build_object('success', true, 'report_id', p_report_id, 'state', 'reported');
END;
$$;

-- 4. Admit to a Listed facility (claimer or admin, only while claimed)
CREATE OR REPLACE FUNCTION public.admit_to_facility(
  p_report_id UUID,
  p_facility_id UUID,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid UUID := (SELECT auth.uid());
  v_report RECORD;
  v_facility RECORD;
  v_now TIMESTAMPTZ := clock_timestamp();
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sign in required');
  END IF;

  SELECT * INTO v_report FROM public.sos_reports WHERE id = p_report_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Report not found');
  END IF;

  IF v_report.state <> 'claimed' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only a claimed case can be admitted');
  END IF;

  IF v_report.claimed_by IS DISTINCT FROM v_uid AND NOT public.is_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only the rescuer who claimed this case can hand it off');
  END IF;

  SELECT * INTO v_facility FROM public.facilities WHERE id = p_facility_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Partner facility not found');
  END IF;

  UPDATE public.sos_reports
  SET facility_id = p_facility_id, state = 'admitted', updated_at = v_now
  WHERE id = p_report_id;

  UPDATE public.facilities SET last_active_at = v_now WHERE id = p_facility_id;

  -- First recovery update starts the 14-day inactivity clock
  INSERT INTO public.recovery_updates (report_id, author_id, notes, state, created_at)
  VALUES (
    p_report_id,
    v_uid,
    COALESCE(NULLIF(left(p_notes, 500), ''), 'Admitted to ' || v_facility.name),
    'admitted',
    v_now
  );

  RETURN jsonb_build_object(
    'success', true,
    'report_id', p_report_id,
    'facility_id', p_facility_id,
    'state', 'admitted',
    'admitted_at', v_now
  );
END;
$$;

-- 5. Lock down execution: signed-in users only
REVOKE ALL ON FUNCTION public.claim_sos_report(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.release_sos_claim(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admit_to_facility(UUID, UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_sos_report(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.release_sos_claim(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admit_to_facility(UUID, UUID, TEXT) TO authenticated;

-- 6. Close the direct-write bypass on sos_reports.
-- The old policy let the reporter or claimer UPDATE any column (e.g. set
-- claimed_by to themselves, or state to 'resolved'). Case transitions now go
-- through the functions above; only admins may write directly.
DROP POLICY IF EXISTS "Authorized users can update reports" ON public.sos_reports;
DROP POLICY IF EXISTS "Admins can update reports" ON public.sos_reports;
CREATE POLICY "Admins can update reports"
  ON public.sos_reports FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- 7. recovery_updates: only the claiming rescuer, facility staff, or admin may post
DROP POLICY IF EXISTS "Authenticated responders can insert updates" ON public.recovery_updates;
CREATE POLICY "Responders can insert updates on their cases"
  ON public.recovery_updates FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT auth.uid()) = author_id
    AND (
      public.is_admin()
      OR EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = (SELECT auth.uid()) AND p.role = 'facility'
      )
      OR EXISTS (
        SELECT 1 FROM public.sos_reports r
        WHERE r.id = report_id AND r.claimed_by = (SELECT auth.uid())
      )
    )
  );
