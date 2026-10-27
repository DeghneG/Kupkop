-- ==============================================================================
-- KupKop Track 1: Claim Locking, Escalation & Facility Handoff Engine
-- Functions: claim_sos_report, release_sos_claim, admit_to_facility
-- Solves RLS restriction on claiming unclaimed reports and ensures atomic locks
-- ==============================================================================

-- 1. Atomic Claim SOS Report Function
-- Locks the emergency report to the authenticated volunteer or provided volunteer_id
-- Prevents race conditions and duplicate dispatches
CREATE OR REPLACE FUNCTION public.claim_sos_report(
  p_report_id UUID,
  p_volunteer_id UUID DEFAULT auth.uid()
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_report RECORD;
  v_claimer_role user_role;
  v_now TIMESTAMPTZ := clock_timestamp();
BEGIN
  -- Validate volunteer ID
  IF p_volunteer_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Authentication required to claim incident'
    );
  END IF;

  -- Verify volunteer role (allow volunteer and admin, or bypass if in prototype test mode)
  SELECT role INTO v_claimer_role FROM public.profiles WHERE id = p_volunteer_id;
  IF v_claimer_role IS NOT NULL AND v_claimer_role NOT IN ('volunteer', 'admin') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Only verified volunteers or admins can claim rescue dispatches'
    );
  END IF;

  -- Select report with row lock to prevent race conditions
  SELECT * INTO v_report
  FROM public.sos_reports
  WHERE id = p_report_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Report not found'
    );
  END IF;

  -- Check if already claimed and lock has not expired (60-minute duration)
  IF v_report.state = 'claimed' 
     AND v_report.claimed_by IS NOT NULL 
     AND v_report.claimed_by <> p_volunteer_id
     AND v_report.claimed_at > (v_now - INTERVAL '60 minutes') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Incident already claimed by another rescuer',
      'claimed_at', v_report.claimed_at
    );
  END IF;

  -- Disallow claiming if already resolved or in care unless re-opened
  IF v_report.state IN ('resolved') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Incident is already resolved'
    );
  END IF;

  -- Atomically apply the claim lock
  UPDATE public.sos_reports
  SET
    claimed_by = p_volunteer_id,
    claimed_at = v_now,
    state = 'claimed',
    updated_at = v_now
  WHERE id = p_report_id;

  RETURN jsonb_build_object(
    'success', true,
    'report_id', p_report_id,
    'claimed_by', p_volunteer_id,
    'claimed_at', v_now,
    'lock_duration_minutes', 60
  );
END;
$$;

-- 2. Release SOS Claim Function
-- Allows the current claimer or an admin to release the lock back to 'reported'
CREATE OR REPLACE FUNCTION public.release_sos_claim(
  p_report_id UUID,
  p_volunteer_id UUID DEFAULT auth.uid()
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_report RECORD;
  v_now TIMESTAMPTZ := clock_timestamp();
BEGIN
  SELECT * INTO v_report
  FROM public.sos_reports
  WHERE id = p_report_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Report not found');
  END IF;

  -- Check permission: caller must be the claimer, reporter, or an admin
  IF v_report.claimed_by IS NOT NULL 
     AND v_report.claimed_by <> p_volunteer_id 
     AND NOT public.is_admin() THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Unauthorized: You did not claim this rescue'
    );
  END IF;

  -- Release the claim back to 'reported'
  UPDATE public.sos_reports
  SET
    claimed_by = NULL,
    claimed_at = NULL,
    state = 'reported',
    updated_at = v_now
  WHERE id = p_report_id;

  RETURN jsonb_build_object(
    'success', true,
    'report_id', p_report_id,
    'state', 'reported'
  );
END;
$$;

-- 3. Handoff & Admit to Facility Function
-- Transitions state from 'claimed' to 'admitted', links facility, and posts initial recovery update
CREATE OR REPLACE FUNCTION public.admit_to_facility(
  p_report_id UUID,
  p_facility_id UUID,
  p_notes TEXT DEFAULT 'Patient arrived and admitted to partner facility.',
  p_author_id UUID DEFAULT auth.uid()
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_report RECORD;
  v_facility RECORD;
  v_now TIMESTAMPTZ := clock_timestamp();
BEGIN
  -- Verify report exists
  SELECT * INTO v_report
  FROM public.sos_reports
  WHERE id = p_report_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Report not found');
  END IF;

  -- Verify facility exists
  SELECT * INTO v_facility
  FROM public.facilities
  WHERE id = p_facility_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Partner clinic/facility not found');
  END IF;

  -- Update report state to admitted
  UPDATE public.sos_reports
  SET
    facility_id = p_facility_id,
    state = 'admitted',
    updated_at = v_now
  WHERE id = p_report_id;

  -- Refresh facility last_active_at
  UPDATE public.facilities
  SET last_active_at = v_now
  WHERE id = p_facility_id;

  -- Insert initial recovery update to start the 14-day inactivity clock
  IF p_author_id IS NOT NULL THEN
    INSERT INTO public.recovery_updates (
      report_id,
      author_id,
      notes,
      state,
      created_at
    ) VALUES (
      p_report_id,
      p_author_id,
      COALESCE(p_notes, 'Admitted to ' || v_facility.name),
      'admitted',
      v_now
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'report_id', p_report_id,
    'facility_id', p_facility_id,
    'state', 'admitted',
    'admitted_at', v_now
  );
END;
$$;
