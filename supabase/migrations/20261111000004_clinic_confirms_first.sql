-- The clinic confirms the animal is there BEFORE the volunteer can mark it admitted.
--   1. the volunteer tells a clinic (send_clinic_heads_up, now required);
--   2. that clinic's staff tap "Animal arrived" (clinic_confirm_received) -> clinic_received_at;
--   3. only then can the volunteer admit, and only to that clinic. The 14-day care clock starts at the clinic's confirmation.
-- An admin can still admit directly (for a clinic with no staff account); that case waits for the old intake confirmation.
-- This also removes the "tapped the wrong clinic" problem: the clinic that confirms is the clinic that gets the case.

ALTER TABLE public.sos_reports ADD COLUMN IF NOT EXISTS clinic_received_at TIMESTAMPTZ;

-- Like the other claim extras, it belongs to one claim and starts empty on insert
CREATE OR REPLACE FUNCTION public.reset_claim_extras()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.animal_name := NULL;
    NEW.admin_assigned_at := NULL;
    NEW.checkin_kind := NULL;
    NEW.checkin_at := NULL;
    NEW.heads_up_facility_id := NULL;
    NEW.heads_up_eta_minutes := NULL;
    NEW.heads_up_at := NULL;
    NEW.heads_up_response := NULL;
    NEW.heads_up_response_at := NULL;
    NEW.heads_up_note := NULL;
    NEW.clinic_received_at := NULL;
    RETURN NEW;
  END IF;

  IF NEW.state IS DISTINCT FROM 'claimed' OR NEW.claimed_by IS DISTINCT FROM OLD.claimed_by OR NEW.claimed_at IS NULL THEN
    NEW.checkin_kind := NULL;
    NEW.checkin_at := NULL;
    NEW.heads_up_facility_id := NULL;
    NEW.heads_up_eta_minutes := NULL;
    NEW.heads_up_at := NULL;
    NEW.heads_up_response := NULL;
    NEW.heads_up_response_at := NULL;
    NEW.heads_up_note := NULL;
    NEW.clinic_received_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;

-- Telling a (different) clinic starts over: the new clinic has not confirmed anything yet.
-- Once a clinic has confirmed it has the animal, the rescuer cannot send the heads-up elsewhere.
CREATE OR REPLACE FUNCTION public.send_clinic_heads_up(p_report_id UUID, p_facility_id UUID, p_eta_minutes INTEGER DEFAULT NULL)
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
    RETURN jsonb_build_object('success', false, 'error', 'Only a claimed case can send a heads-up');
  END IF;
  IF v_report.claimed_by IS DISTINCT FROM v_uid AND NOT public.is_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only the rescuer who claimed this case can tell a clinic');
  END IF;
  IF v_report.clinic_received_at IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'A clinic already confirmed it has the animal. You can mark it admitted now.');
  END IF;

  SELECT * INTO v_facility FROM public.facilities WHERE id = p_facility_id;
  IF NOT FOUND OR v_facility.status <> 'Listed' THEN
    RETURN jsonb_build_object('success', false, 'error', 'This clinic is not accepting animals right now');
  END IF;
  IF v_facility.availability = 'full'
     AND v_facility.availability_set_at > v_now - INTERVAL '12 hours' THEN
    RETURN jsonb_build_object('success', false, 'error', v_facility.name || ' reported it is full. Choose another clinic.');
  END IF;
  IF p_eta_minutes IS NOT NULL AND (p_eta_minutes < 1 OR p_eta_minutes > 180) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Arrival time must be between 1 and 180 minutes');
  END IF;

  UPDATE public.sos_reports
  SET heads_up_facility_id = p_facility_id,
      heads_up_eta_minutes = p_eta_minutes,
      heads_up_at = v_now,
      heads_up_response = NULL,
      heads_up_response_at = NULL,
      heads_up_note = NULL,
      clinic_received_at = NULL,
      -- Telling a clinic is a step like the others: it restarts the lock (otherwise telling a different clinic after an
      -- "expecting" could find the old lock already used up)
      claimed_at = v_now,
      updated_at = v_now
  WHERE id = p_report_id;

  RETURN jsonb_build_object('success', true, 'facility_id', p_facility_id);
END;
$$;
REVOKE ALL ON FUNCTION public.send_clinic_heads_up(UUID, UUID, INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.send_clinic_heads_up(UUID, UUID, INTEGER) TO authenticated;

-- The clinic that was told confirms the animal is physically there
CREATE OR REPLACE FUNCTION public.clinic_confirm_received(p_report_id UUID)
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
  SELECT * INTO v_report FROM public.sos_reports WHERE id = p_report_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Report not found');
  END IF;
  IF v_uid IS NULL OR v_report.heads_up_facility_id IS NULL OR NOT public.is_case_clinic_staff(v_report.heads_up_facility_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only staff of the clinic that was told can confirm the animal arrived');
  END IF;
  IF v_report.state <> 'claimed' THEN
    RETURN jsonb_build_object('success', false, 'error', 'This case is no longer with a rescuer on the way');
  END IF;
  IF v_report.heads_up_response = 'cannot' THEN
    RETURN jsonb_build_object('success', false, 'error', 'You told the rescuer the clinic cannot take this animal');
  END IF;
  IF v_report.clinic_received_at IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'You already confirmed this animal arrived');
  END IF;

  UPDATE public.sos_reports
  SET clinic_received_at = v_now,
      heads_up_response = COALESCE(heads_up_response, 'expecting'),
      heads_up_response_at = COALESCE(heads_up_response_at, v_now),
      updated_at = v_now
  WHERE id = p_report_id;

  RETURN jsonb_build_object('success', true, 'received_at', v_now);
END;
$$;
REVOKE ALL ON FUNCTION public.clinic_confirm_received(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.clinic_confirm_received(UUID) TO authenticated;

-- Admitting: the volunteer can only admit to the clinic that confirmed. An admin can admit directly.
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
  v_confirmed BOOLEAN;
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

  v_confirmed := v_report.clinic_received_at IS NOT NULL AND v_report.heads_up_facility_id = p_facility_id;
  IF NOT v_confirmed AND NOT public.is_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ask the clinic to confirm the animal arrived first. You can mark it admitted once they do.');
  END IF;

  SELECT * INTO v_facility FROM public.facilities WHERE id = p_facility_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Partner facility not found');
  END IF;
  IF v_facility.status <> 'Listed' THEN
    RETURN jsonb_build_object('success', false, 'error', 'This clinic is paused and cannot receive animals right now');
  END IF;

  UPDATE public.sos_reports
  SET facility_id = p_facility_id,
      state = 'admitted',
      intake_confirmed_at = CASE WHEN v_confirmed THEN v_report.clinic_received_at ELSE NULL END,
      updated_at = v_now
  WHERE id = p_report_id;

  UPDATE public.facilities SET last_active_at = v_now WHERE id = p_facility_id;

  INSERT INTO public.recovery_updates (report_id, author_id, notes, state, created_at)
  VALUES (
    p_report_id,
    v_uid,
    COALESCE(
      NULLIF(left(p_notes, 500), ''),
      CASE WHEN v_confirmed THEN 'Brought to ' || v_facility.name || '. The clinic confirmed the animal arrived.'
           ELSE 'Brought to ' || v_facility.name || '. Waiting for the clinic to confirm.' END
    ),
    'admitted',
    v_now
  );

  RETURN jsonb_build_object('success', true, 'report_id', p_report_id, 'facility_id', p_facility_id, 'state', 'admitted', 'admitted_at', v_now);
END;
$$;
REVOKE ALL ON FUNCTION public.admit_to_facility(UUID, UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admit_to_facility(UUID, UUID, TEXT) TO authenticated;
