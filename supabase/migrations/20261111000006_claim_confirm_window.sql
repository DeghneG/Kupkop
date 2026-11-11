-- After claiming, the volunteer has ONE minute to tap "On my way" (or "I'm already here"). If they do not, the claim ends and the
-- case is open to everyone again. Once they check in, the severity lock (15 / 30 / 60 minutes) applies as before.
-- Like the existing lock, an ended claim stays 'claimed' in the row until someone claims it again; screens and these functions
-- treat it as open (see needsRescuer() / claimLockEndsAt() in src/lib/sos/escalation.ts, which mirror claim_window() below).
-- Once a clinic has said it is EXPECTING the volunteer, the claim has no time limit: they are committed and on the way there.

CREATE OR REPLACE FUNCTION public.claim_window(p_emergency_type TEXT, p_checkin_kind TEXT, p_heads_up_response TEXT DEFAULT NULL)
RETURNS INTERVAL
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_checkin_kind IS NULL THEN INTERVAL '1 minute'
    WHEN p_heads_up_response = 'expecting' THEN INTERVAL '100 years'
    ELSE make_interval(mins => public.claim_lock_minutes(p_emergency_type))
  END;
$$;

CREATE OR REPLACE FUNCTION public.join_standby(p_report_id UUID)
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
    RETURN jsonb_build_object('success', false, 'error', 'Sign in required');
  END IF;
  SELECT role INTO v_role FROM public.profiles WHERE id = v_uid;
  IF v_role IS NULL OR v_role NOT IN ('volunteer', 'admin') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only approved volunteers can stand by');
  END IF;

  SELECT * INTO v_report FROM public.sos_reports WHERE id = p_report_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Report not found');
  END IF;
  IF v_report.state <> 'claimed' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only a claimed case has a standby list');
  END IF;
  IF v_report.claimed_by = v_uid THEN
    RETURN jsonb_build_object('success', false, 'error', 'This is your own rescue');
  END IF;
  IF v_report.claimed_at <= v_now - public.claim_window(v_report.emergency_type::text, v_report.checkin_kind, v_report.heads_up_response) THEN
    RETURN jsonb_build_object('success', false, 'error', 'The lock has ended. You can claim this case now.');
  END IF;
  IF (SELECT count(*) FROM public.claim_standby s
      JOIN public.sos_reports r ON r.id = s.report_id
      WHERE s.volunteer_id = v_uid AND r.state = 'claimed' AND r.id <> p_report_id) >= 3 THEN
    RETURN jsonb_build_object('success', false, 'error', 'You are already on standby for 3 cases. Leave one first.');
  END IF;

  INSERT INTO public.claim_standby (report_id, volunteer_id, created_at)
  VALUES (p_report_id, v_uid, v_now)
  ON CONFLICT (report_id, volunteer_id) DO NOTHING;
  RETURN jsonb_build_object('success', true);
END;
$$;
REVOKE ALL ON FUNCTION public.join_standby(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.join_standby(UUID) TO authenticated;

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
  v_lock INTEGER;
  v_window INTERVAL;
  v_opened_at TIMESTAMPTZ;
  v_first UUID;
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
      AND r.claimed_at > (v_now - public.claim_window(r.emergency_type::text, r.checkin_kind, r.heads_up_response))
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

  v_lock := public.claim_lock_minutes(v_report.emergency_type::text);
  v_window := public.claim_window(v_report.emergency_type::text, v_report.checkin_kind, v_report.heads_up_response);

  IF v_report.state = 'claimed'
     AND v_report.claimed_by IS NOT NULL
     AND v_report.claimed_by <> v_uid
     AND v_report.claimed_at > (v_now - v_window) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Already claimed by another rescuer',
      'claimed_at', v_report.claimed_at
    );
  END IF;

  -- The case is open again: the first volunteer on standby has 2 minutes before everyone else
  IF v_report.claimed_by IS DISTINCT FROM v_uid THEN
    v_opened_at := CASE WHEN v_report.state = 'claimed' THEN v_report.claimed_at + v_window ELSE v_report.updated_at END;
    SELECT volunteer_id INTO v_first FROM public.claim_standby WHERE report_id = p_report_id ORDER BY created_at LIMIT 1;
    IF v_first IS NOT NULL AND v_first <> v_uid AND v_now < v_opened_at + INTERVAL '2 minutes' THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'This case is held for the next volunteer in line for another ' ||
                 greatest(1, ceil(extract(epoch FROM (v_opened_at + INTERVAL '2 minutes' - v_now)) / 60)::int) || ' min.'
      );
    END IF;
  END IF;

  -- A fresh claim starts with no check-in, even for the same volunteer taking the case again:
  -- they have the one-minute window to tap "On my way".
  UPDATE public.sos_reports
  SET claimed_by = v_uid, claimed_at = v_now, state = 'claimed', updated_at = v_now, admin_assigned_at = NULL,
      checkin_kind = NULL, checkin_at = NULL
  WHERE id = p_report_id;

  -- Whoever takes a case no longer waits for another
  DELETE FROM public.claim_standby WHERE volunteer_id = v_uid;

  RETURN jsonb_build_object(
    'success', true,
    'report_id', p_report_id,
    'claimed_by', v_uid,
    'claimed_at', v_now,
    'lock_duration_minutes', v_lock,
    'confirm_within_seconds', 60
  );
END;
$$;
REVOKE ALL ON FUNCTION public.claim_sos_report(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_sos_report(UUID) TO authenticated;

-- Check-in: refused once the window has run out (the case is open again), otherwise restarts the lock as before
CREATE OR REPLACE FUNCTION public.claim_checkin(p_report_id UUID, p_kind TEXT)
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
  IF p_kind IS NULL OR p_kind NOT IN ('on_my_way', 'arrived') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Check-in must be on_my_way or arrived');
  END IF;

  SELECT * INTO v_report FROM public.sos_reports WHERE id = p_report_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Report not found');
  END IF;
  IF v_report.state <> 'claimed' OR v_report.claimed_by IS DISTINCT FROM v_uid THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only the rescuer who claimed this case can check in');
  END IF;
  IF v_report.checkin_kind = 'arrived' OR v_report.checkin_kind = p_kind THEN
    RETURN jsonb_build_object('success', false, 'error', 'You already checked in for this step');
  END IF;
  IF v_report.claimed_at <= v_now - public.claim_window(v_report.emergency_type::text, v_report.checkin_kind, v_report.heads_up_response) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Your time to check in ran out, so the case is open again. Claim it again if you can still go.');
  END IF;

  UPDATE public.sos_reports
  SET claimed_at = v_now, checkin_kind = p_kind, checkin_at = v_now, updated_at = v_now
  WHERE id = p_report_id;

  RETURN jsonb_build_object(
    'success', true,
    'claimed_at', v_now,
    'lock_duration_minutes', public.claim_lock_minutes(v_report.emergency_type::text)
  );
END;
$$;
REVOKE ALL ON FUNCTION public.claim_checkin(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_checkin(UUID, TEXT) TO authenticated;
