-- D-057: once a clinic is EXPECTING the rescuer, the claim no longer has unlimited time. It holds for the expected drive from
-- the animal to that clinic (distance and Manila traffic by time of day, like a ride app's estimate but without live traffic)
-- plus 15 minutes to hand over, counted from when the clinic was told. If the rescuer goes silent, the case opens again and
-- standby works as usual.
-- Mirrors src/lib/sos/clinics.ts (TRAFFIC, estimateEtaMinutes) and claimWindowMinutes() in src/lib/sos/escalation.ts.

-- Expected minutes to drive between two points: roads are about 1.4x the straight line; weekdays 7-10 am and 5-8 pm
-- at 12 km/h, 10 pm to 5 am at 30 km/h, otherwise 18 km/h; never under 3 minutes.
CREATE OR REPLACE FUNCTION public.travel_minutes(
  p_lat1 DOUBLE PRECISION,
  p_lng1 DOUBLE PRECISION,
  p_lat2 DOUBLE PRECISION,
  p_lng2 DOUBLE PRECISION,
  p_at TIMESTAMPTZ DEFAULT now()
)
RETURNS INTEGER
LANGUAGE sql
STABLE
AS $$
  WITH d AS (
    SELECT
      2 * 6371 * asin(sqrt(
        power(sin(radians(p_lat2 - p_lat1) / 2), 2)
        + cos(radians(p_lat1)) * cos(radians(p_lat2)) * power(sin(radians(p_lng2 - p_lng1) / 2), 2)
      )) * 1.4 AS road_km,
      extract(hour FROM p_at AT TIME ZONE 'Asia/Manila')::int AS h,
      extract(isodow FROM p_at AT TIME ZONE 'Asia/Manila')::int AS dow
  )
  SELECT greatest(3, ceil(road_km / (CASE
      WHEN dow <= 5 AND (h BETWEEN 7 AND 9 OR h BETWEEN 17 AND 19) THEN 12
      WHEN h >= 22 OR h < 5 THEN 30
      ELSE 18
    END) * 60))::int
  FROM d;
$$;

-- The claim window now knows the expected drive. The old three-argument version is replaced, not overloaded.
DROP FUNCTION IF EXISTS public.claim_window(TEXT, TEXT, TEXT);
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
    WHEN p_heads_up_response = 'expecting'
      THEN make_interval(mins => COALESCE(p_eta_minutes, public.claim_lock_minutes(p_emergency_type)) + 15)
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
  IF v_report.claimed_at <= v_now - public.claim_window(v_report.emergency_type::text, v_report.checkin_kind, v_report.heads_up_response, v_report.heads_up_eta_minutes) THEN
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
      AND r.claimed_at > (v_now - public.claim_window(r.emergency_type::text, r.checkin_kind, r.heads_up_response, r.heads_up_eta_minutes))
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
  v_window := public.claim_window(v_report.emergency_type::text, v_report.checkin_kind, v_report.heads_up_response, v_report.heads_up_eta_minutes);

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
  IF v_report.claimed_at <= v_now - public.claim_window(v_report.emergency_type::text, v_report.checkin_kind, v_report.heads_up_response, v_report.heads_up_eta_minutes) THEN
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

-- The heads-up records the expected drive, worked out by the database
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
  -- p_eta_minutes is ignored: the expected drive is worked out here, so a rescuer cannot stretch the hold

  UPDATE public.sos_reports
  SET heads_up_facility_id = p_facility_id,
      heads_up_eta_minutes = public.travel_minutes(v_report.latitude, v_report.longitude, v_facility.latitude, v_facility.longitude, v_now),
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

  RETURN jsonb_build_object('success', true, 'facility_id', p_facility_id,
    'eta_minutes', public.travel_minutes(v_report.latitude, v_report.longitude, v_facility.latitude, v_facility.longitude, v_now));
END;
$$;
REVOKE ALL ON FUNCTION public.send_clinic_heads_up(UUID, UUID, INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.send_clinic_heads_up(UUID, UUID, INTEGER) TO authenticated;
