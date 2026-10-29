-- ==============================================================================
-- KupKop Phase 3 + 4: clinic care tracking, admin review, report flags
--   * profiles.facility_id links clinic staff to the clinic they work at (admin-set only)
--   * role_applications.facility_id: clinic staff applicants say which clinic
--   * post_recovery_update(): clinic staff / admin move a case admitted -> healing -> resolved
--     and restart the 14-day clock; replaces direct inserts into recovery_updates
--   * report_flags: signed-in users flag fake, duplicate or abusive reports; admins review
--   * sos_reports.hidden_at: admin hides a fake report from the feed
-- ==============================================================================

-- 1. Clinic staff belong to one clinic
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS facility_id UUID REFERENCES public.facilities(id) ON DELETE SET NULL;

-- Users can update their own profile, so guard facility_id like role
CREATE OR REPLACE FUNCTION public.prevent_role_tampering()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (NEW.role IS DISTINCT FROM OLD.role OR NEW.facility_id IS DISTINCT FROM OLD.facility_id)
     AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Role modification denied: Users cannot alter their own role or clinic.';
  END IF;
  RETURN NEW;
END;
$$;

-- 2. Clinic staff applications name their clinic
ALTER TABLE public.role_applications
  ADD COLUMN IF NOT EXISTS facility_id UUID REFERENCES public.facilities(id) ON DELETE CASCADE;

ALTER TABLE public.role_applications DROP CONSTRAINT IF EXISTS role_applications_facility_needed;
ALTER TABLE public.role_applications ADD CONSTRAINT role_applications_facility_needed
  CHECK (requested_role <> 'facility' OR facility_id IS NOT NULL);

CREATE OR REPLACE FUNCTION public.review_role_application(
  p_application_id UUID,
  p_approve BOOLEAN
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_app RECORD;
  v_now TIMESTAMPTZ := clock_timestamp();
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Admins only');
  END IF;

  SELECT * INTO v_app FROM public.role_applications WHERE id = p_application_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Application not found');
  END IF;
  IF v_app.status <> 'pending' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Application already reviewed');
  END IF;

  UPDATE public.role_applications
  SET status = CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END,
      reviewed_at = v_now,
      reviewed_by = (SELECT auth.uid())
  WHERE id = p_application_id;

  IF p_approve THEN
    -- Allowed by prevent_role_tampering because the caller is an admin
    UPDATE public.profiles
    SET role = v_app.requested_role,
        facility_id = CASE WHEN v_app.requested_role = 'facility' THEN v_app.facility_id ELSE NULL END,
        updated_at = v_now
    WHERE id = v_app.user_id;
  END IF;

  RETURN jsonb_build_object('success', true, 'approved', p_approve);
END;
$$;

REVOKE ALL ON FUNCTION public.review_role_application(UUID, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.review_role_application(UUID, BOOLEAN) TO authenticated;

-- 3. Recovery updates: admitted -> healing -> resolved, only by that clinic's staff or an admin
CREATE OR REPLACE FUNCTION public.post_recovery_update(
  p_report_id UUID,
  p_notes TEXT,
  p_state case_state
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid UUID := (SELECT auth.uid());
  v_profile RECORD;
  v_report RECORD;
  v_notes TEXT := NULLIF(btrim(left(COALESCE(p_notes, ''), 500)), '');
  v_now TIMESTAMPTZ := clock_timestamp();
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sign in required');
  END IF;

  SELECT role, facility_id INTO v_profile FROM public.profiles WHERE id = v_uid;

  SELECT * INTO v_report FROM public.sos_reports WHERE id = p_report_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Report not found');
  END IF;

  IF NOT public.is_admin()
     AND NOT (v_profile.role = 'facility' AND v_profile.facility_id IS NOT NULL
              AND v_profile.facility_id = v_report.facility_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only staff of the clinic caring for this animal can post updates');
  END IF;

  IF v_report.state NOT IN ('admitted', 'healing') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Updates can only be posted while the animal is in care');
  END IF;

  -- Allowed next states: stay admitted (note only) or move forward; never back to admitted from healing
  IF p_state NOT IN ('admitted', 'healing', 'resolved')
     OR (v_report.state = 'healing' AND p_state = 'admitted') THEN
    RETURN jsonb_build_object('success', false, 'error', 'That status change is not allowed');
  END IF;

  IF v_notes IS NULL OR char_length(v_notes) < 5 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Write a short note on how the animal is doing (5+ characters)');
  END IF;

  INSERT INTO public.recovery_updates (report_id, author_id, notes, state, created_at)
  VALUES (p_report_id, v_uid, v_notes, p_state, v_now);

  UPDATE public.sos_reports SET state = p_state, updated_at = v_now WHERE id = p_report_id;
  UPDATE public.facilities SET last_active_at = v_now WHERE id = v_report.facility_id;

  RETURN jsonb_build_object('success', true, 'report_id', p_report_id, 'state', p_state, 'posted_at', v_now);
END;
$$;

REVOKE ALL ON FUNCTION public.post_recovery_update(UUID, TEXT, case_state) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.post_recovery_update(UUID, TEXT, case_state) TO authenticated;

-- All recovery updates now go through admit_to_facility / post_recovery_update.
-- The old policy let any facility user post on any clinic's case.
DROP POLICY IF EXISTS "Responders can insert updates on their cases" ON public.recovery_updates;

-- 4. Admin can hide a fake report from the feed (kept for the record, never deleted)
ALTER TABLE public.sos_reports ADD COLUMN IF NOT EXISTS hidden_at TIMESTAMPTZ;

DROP POLICY IF EXISTS "SOS reports are viewable by everyone" ON public.sos_reports;
CREATE POLICY "SOS reports are viewable by everyone"
  ON public.sos_reports FOR SELECT
  TO anon, authenticated
  USING (
    hidden_at IS NULL
    OR (SELECT auth.uid()) = reporter_id
    OR public.is_admin()
  );

-- 5. Report flags
CREATE TABLE IF NOT EXISTS public.report_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES public.sos_reports(id) ON DELETE CASCADE,
  flagged_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reason TEXT NOT NULL CHECK (reason IN ('fake', 'duplicate', 'abuse', 'other')),
  note TEXT CHECK (note IS NULL OR char_length(note) <= 300),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'dismissed', 'hidden')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL
);

-- One flag per person per report
CREATE UNIQUE INDEX IF NOT EXISTS report_flags_one_per_user ON public.report_flags (report_id, flagged_by);

ALTER TABLE public.report_flags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own flags, admins read all" ON public.report_flags;
CREATE POLICY "Users read own flags, admins read all"
  ON public.report_flags FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = flagged_by OR public.is_admin());

DROP POLICY IF EXISTS "Users flag reports as themselves" ON public.report_flags;
CREATE POLICY "Users flag reports as themselves"
  ON public.report_flags FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT auth.uid()) = flagged_by
    AND status = 'open'
    AND reviewed_at IS NULL
    AND reviewed_by IS NULL
  );

-- No UPDATE / DELETE policies: review happens only through review_report_flag().

CREATE OR REPLACE FUNCTION public.review_report_flag(
  p_flag_id UUID,
  p_hide_report BOOLEAN
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_flag RECORD;
  v_now TIMESTAMPTZ := clock_timestamp();
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Admins only');
  END IF;

  SELECT * INTO v_flag FROM public.report_flags WHERE id = p_flag_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Flag not found');
  END IF;
  IF v_flag.status <> 'open' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Flag already reviewed');
  END IF;

  IF p_hide_report THEN
    UPDATE public.sos_reports SET hidden_at = v_now, updated_at = v_now
    WHERE id = v_flag.report_id AND hidden_at IS NULL;
  END IF;

  -- Close every open flag on the same report with the same outcome
  UPDATE public.report_flags
  SET status = CASE WHEN p_hide_report THEN 'hidden' ELSE 'dismissed' END,
      reviewed_at = v_now,
      reviewed_by = (SELECT auth.uid())
  WHERE report_id = v_flag.report_id AND status = 'open';

  RETURN jsonb_build_object('success', true, 'hidden', p_hide_report);
END;
$$;

REVOKE ALL ON FUNCTION public.review_report_flag(UUID, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.review_report_flag(UUID, BOOLEAN) TO authenticated;
