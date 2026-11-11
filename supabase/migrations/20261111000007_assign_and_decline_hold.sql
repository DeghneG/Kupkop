-- QA fix (D-056). Two ways a case comes back to a rescuer left them in the ONE-minute "tap On my way" window, so the
-- claim lapsed almost at once:
--   1. admin_assign_claim: the reset trigger clears the check-in whenever claimed_by changes, so an assigned volunteer
--      (told by a push that may take a while to arrive) lost the case after a minute.
--   2. decline_admission: admitting clears the check-in, so a rescuer standing at a clinic that turned the animal away
--      had one minute before the case opened to others.
-- Both now hold the case on the severity lock (15 / 30 / 60 minutes), the same as after a check-in.

CREATE OR REPLACE FUNCTION public.admin_assign_claim(p_report_id UUID, p_volunteer_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_report RECORD;
  v_now TIMESTAMPTZ := clock_timestamp();
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Admins only');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_volunteer_id AND role IN ('volunteer', 'admin')) THEN
    RETURN jsonb_build_object('success', false, 'error', 'That person is not an approved volunteer');
  END IF;

  SELECT * INTO v_report FROM public.sos_reports WHERE id = p_report_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Report not found');
  END IF;
  IF v_report.state NOT IN ('reported', 'claimed') THEN
    RETURN jsonb_build_object('success', false, 'error', 'This case is already past the claim stage');
  END IF;

  UPDATE public.sos_reports
  SET claimed_by = p_volunteer_id, claimed_at = v_now, state = 'claimed', updated_at = v_now, admin_assigned_at = v_now
  WHERE id = p_report_id;
  -- Separate statement: the reset trigger clears the check-in in the same UPDATE that changes claimed_by.
  -- The admin has committed this volunteer (usually by phone), so the case holds on the severity lock.
  UPDATE public.sos_reports
  SET checkin_kind = 'on_my_way', checkin_at = v_now
  WHERE id = p_report_id;
  DELETE FROM public.claim_standby WHERE volunteer_id = p_volunteer_id;

  RETURN jsonb_build_object('success', true, 'claimed_by', p_volunteer_id);
END;
$$;
REVOKE ALL ON FUNCTION public.admin_assign_claim(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_assign_claim(UUID, UUID) TO authenticated;

-- Clinic can't take the animal: back to the rescuer, who is at the clinic with it, on the severity lock to pick another
CREATE OR REPLACE FUNCTION public.decline_admission(p_report_id UUID, p_reason TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid UUID := (SELECT auth.uid());
  v_report RECORD;
  v_clinic TEXT;
  v_reason TEXT := NULLIF(btrim(left(COALESCE(p_reason, ''), 300)), '');
  v_now TIMESTAMPTZ := clock_timestamp();
BEGIN
  SELECT * INTO v_report FROM public.sos_reports WHERE id = p_report_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Report not found');
  END IF;
  IF v_uid IS NULL OR NOT public.is_case_clinic_staff(v_report.facility_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only staff of this clinic can decline this animal');
  END IF;
  IF v_report.state <> 'admitted' OR v_report.intake_confirmed_at IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only an animal waiting for intake can be declined');
  END IF;
  IF v_reason IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Say briefly why the clinic cannot take the animal');
  END IF;

  SELECT name INTO v_clinic FROM public.facilities WHERE id = v_report.facility_id;

  -- claimed_by is unchanged, so the reset trigger keeps the check-in set here
  UPDATE public.sos_reports
  SET state = 'claimed', facility_id = NULL, claimed_at = v_now, intake_confirmed_at = NULL, updated_at = v_now,
      checkin_kind = 'arrived', checkin_at = v_now
  WHERE id = p_report_id;

  INSERT INTO public.recovery_updates (report_id, author_id, notes, state, created_at)
  VALUES (p_report_id, v_uid, COALESCE(v_clinic, 'The clinic') || ' could not accept the animal: ' || v_reason, 'claimed', v_now);

  RETURN jsonb_build_object('success', true, 'claimed_by', v_report.claimed_by);
END;
$$;
REVOKE ALL ON FUNCTION public.decline_admission(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.decline_admission(UUID, TEXT) TO authenticated;
