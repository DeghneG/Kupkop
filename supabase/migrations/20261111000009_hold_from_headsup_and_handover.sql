-- D-060: two loopholes from the QA run (D-059).
--   1. The arrival hold starts when a clinic is TOLD, not when it answers. Until the clinic said "expecting", the normal
--      15 / 30 / 60-minute lock applied, so a slow answer could cost a rescuer already driving there the case. Now, once a
--      clinic is told and has not said it cannot take the animal, the claim holds for the expected drive plus 15 minutes.
--      heads_up_eta_minutes is only set while a clinic is told, so an untold case keeps the severity lock.
--   2. The clinic's "Animal arrived" admits the case. Before, the rescuer still had to tap Admit: until they did, the claim
--      could lapse (reopening the case to other volunteers and alerts) or be released, with the animal already in the clinic.
--      Now the confirmation is the handover: the case is admitted to that clinic at once, intake confirmed, care clock started.
--      An admin can still admit directly with admit_to_facility() (a clinic with no staff account).
-- Mirrors claimWindowMinutes() in src/lib/sos/escalation.ts and the demo engine in src/lib/demo/demo.ts.

CREATE OR REPLACE FUNCTION public.claim_window(
  p_emergency_type TEXT,
  p_checkin_kind TEXT,
  p_heads_up_response TEXT DEFAULT NULL,
  p_eta_minutes INTEGER DEFAULT NULL
)
RETURNS INTERVAL
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_checkin_kind IS NULL THEN INTERVAL '1 minute'
    WHEN p_eta_minutes IS NOT NULL AND p_heads_up_response IS DISTINCT FROM 'cannot'
      THEN make_interval(mins => p_eta_minutes + 15)
    ELSE make_interval(mins => public.claim_lock_minutes(p_emergency_type))
  END;
$$;

-- The claim extras still clear when a case leaves 'claimed', except the time the clinic confirmed the animal arrived:
-- on an admitted case it records the handover.
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
    IF NEW.state IS DISTINCT FROM 'admitted' THEN
      NEW.clinic_received_at := NULL;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- The clinic that was told confirms the animal is physically there: that is the handover, so the case is admitted to it now
CREATE OR REPLACE FUNCTION public.clinic_confirm_received(p_report_id UUID)
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

  SELECT * INTO v_facility FROM public.facilities WHERE id = v_report.heads_up_facility_id;
  IF NOT FOUND OR v_facility.status <> 'Listed' THEN
    RETURN jsonb_build_object('success', false, 'error', 'This clinic is paused and cannot receive animals right now');
  END IF;

  UPDATE public.sos_reports
  SET state = 'admitted',
      facility_id = v_report.heads_up_facility_id,
      clinic_received_at = v_now,
      intake_confirmed_at = v_now,
      updated_at = v_now
  WHERE id = p_report_id;

  UPDATE public.facilities SET last_active_at = v_now WHERE id = v_report.heads_up_facility_id;

  -- The first recovery update starts the 14-day care clock
  INSERT INTO public.recovery_updates (report_id, author_id, notes, state, created_at)
  VALUES (p_report_id, v_uid, 'Brought to ' || v_facility.name || ' by the rescuer. The clinic confirmed the animal arrived.', 'admitted', v_now);

  RETURN jsonb_build_object('success', true, 'received_at', v_now, 'state', 'admitted', 'facility_id', v_report.heads_up_facility_id);
END;
$$;
REVOKE ALL ON FUNCTION public.clinic_confirm_received(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.clinic_confirm_received(UUID) TO authenticated;
