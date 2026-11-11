-- The person who reported a case can see who claimed it and where they are, so they can find the volunteer.
--   * the volunteer's position is stored in a table nobody can read directly (RLS on, no policies);
--     it is written only by share_rescuer_location() and read only by get_rescuer_info()
--   * only the reporter of the case, the claiming volunteer and admins can read it, only while the case is claimed
--   * it is deleted the moment the claim ends (released, admitted, expired, reassigned) and hidden when older than 10 minutes
--   * what the reporter sees of the volunteer: first name or display name, role, member since, how many animals they have helped.
--     Never email or phone.
--   * a clinic that has said it is EXPECTING the volunteer can track them too (get_incoming_volunteer): its staff only, only while
--     the case is claimed and the clinic has not yet confirmed the animal arrived. Name and position only, never phone or email.
--   * NOTHING is shared until the volunteer taps "On my way" (or "I'm already here"): that tap is their agreement. Before it the
--     reporter only learns that the case was taken (from the case itself), not who or where.

CREATE TABLE IF NOT EXISTS public.rescuer_locations (
  report_id UUID PRIMARY KEY REFERENCES public.sos_reports(id) ON DELETE CASCADE,
  volunteer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  latitude DOUBLE PRECISION NOT NULL CHECK (latitude BETWEEN -90 AND 90),
  longitude DOUBLE PRECISION NOT NULL CHECK (longitude BETWEEN -180 AND 180),
  accuracy_m INTEGER CHECK (accuracy_m IS NULL OR accuracy_m BETWEEN 0 AND 100000),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
ALTER TABLE public.rescuer_locations ENABLE ROW LEVEL SECURITY;
-- No policies on purpose: nobody reads or writes the table directly.
REVOKE ALL ON public.rescuer_locations FROM PUBLIC, anon, authenticated;

-- The position goes away as soon as the claim ends or changes hands
CREATE OR REPLACE FUNCTION public.clear_rescuer_location()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.state IS DISTINCT FROM 'claimed' OR NEW.claimed_by IS DISTINCT FROM OLD.claimed_by THEN
    DELETE FROM public.rescuer_locations WHERE report_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS sos_reports_clear_rescuer_location ON public.sos_reports;
CREATE TRIGGER sos_reports_clear_rescuer_location
  AFTER UPDATE OF state, claimed_by ON public.sos_reports
  FOR EACH ROW EXECUTE FUNCTION public.clear_rescuer_location();

-- The claiming volunteer shares their position (the app calls this every few seconds while the case is theirs)
CREATE OR REPLACE FUNCTION public.share_rescuer_location(
  p_report_id UUID, p_latitude DOUBLE PRECISION, p_longitude DOUBLE PRECISION, p_accuracy_m INTEGER DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid UUID := (SELECT auth.uid());
  v_report RECORD;
  v_last TIMESTAMPTZ;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sign in required');
  END IF;
  SELECT state, claimed_by, checkin_kind INTO v_report FROM public.sos_reports WHERE id = p_report_id;
  IF NOT FOUND OR v_report.state <> 'claimed' OR v_report.claimed_by IS DISTINCT FROM v_uid THEN
    RETURN jsonb_build_object('success', false, 'error', 'You can share your location only on a case you claimed');
  END IF;
  IF v_report.checkin_kind IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Tap On my way first. Your location is shared from then on.');
  END IF;
  IF p_latitude IS NULL OR p_longitude IS NULL OR p_latitude NOT BETWEEN -90 AND 90 OR p_longitude NOT BETWEEN -180 AND 180 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid position');
  END IF;
  SELECT updated_at INTO v_last FROM public.rescuer_locations WHERE report_id = p_report_id;
  IF v_last IS NOT NULL AND v_last > clock_timestamp() - interval '3 seconds' THEN
    RETURN jsonb_build_object('success', true, 'throttled', true);
  END IF;
  INSERT INTO public.rescuer_locations (report_id, volunteer_id, latitude, longitude, accuracy_m, updated_at)
  VALUES (p_report_id, v_uid, p_latitude, p_longitude, p_accuracy_m, clock_timestamp())
  ON CONFLICT (report_id) DO UPDATE
    SET volunteer_id = EXCLUDED.volunteer_id, latitude = EXCLUDED.latitude, longitude = EXCLUDED.longitude,
        accuracy_m = EXCLUDED.accuracy_m, updated_at = EXCLUDED.updated_at;
  RETURN jsonb_build_object('success', true);
END;
$$;
REVOKE ALL ON FUNCTION public.share_rescuer_location(UUID, DOUBLE PRECISION, DOUBLE PRECISION, INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.share_rescuer_location(UUID, DOUBLE PRECISION, DOUBLE PRECISION, INTEGER) TO authenticated;

-- The reporter (or an admin) asks who claimed their case and where that person is
CREATE OR REPLACE FUNCTION public.get_rescuer_info(p_report_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid UUID := (SELECT auth.uid());
  v_report RECORD;
  v_profile RECORD;
  v_loc RECORD;
  v_helped INTEGER;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sign in required');
  END IF;
  SELECT reporter_id, state, claimed_by, claimed_at, checkin_kind INTO v_report FROM public.sos_reports WHERE id = p_report_id;
  IF NOT FOUND OR NOT (v_report.reporter_id = v_uid OR public.is_admin()) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only the person who reported this case can see the volunteer');
  END IF;
  -- Not claimed, or claimed but the volunteer has not tapped On my way yet: nothing to show
  IF v_report.state <> 'claimed' OR v_report.claimed_by IS NULL OR v_report.checkin_kind IS NULL THEN
    RETURN jsonb_build_object('success', true, 'claimed', false);
  END IF;

  SELECT full_name, role, created_at INTO v_profile FROM public.profiles WHERE id = v_report.claimed_by;
  SELECT count(*) INTO v_helped FROM public.sos_reports
    WHERE claimed_by = v_report.claimed_by AND state IN ('admitted', 'healing', 'resolved');
  SELECT latitude, longitude, accuracy_m, updated_at INTO v_loc FROM public.rescuer_locations
    WHERE report_id = p_report_id AND volunteer_id = v_report.claimed_by AND updated_at > clock_timestamp() - interval '10 minutes';

  RETURN jsonb_build_object(
    'success', true,
    'claimed', true,
    'arrived', v_report.checkin_kind = 'arrived',
    'claimed_at', v_report.claimed_at,
    'name', COALESCE(NULLIF(btrim(v_profile.full_name), ''), 'A KupKop volunteer'),
    'role', v_profile.role,
    'member_since', v_profile.created_at,
    'animals_helped', v_helped,
    'location', CASE WHEN v_loc.latitude IS NULL THEN NULL ELSE jsonb_build_object(
      'latitude', v_loc.latitude, 'longitude', v_loc.longitude, 'accuracy_m', v_loc.accuracy_m, 'updated_at', v_loc.updated_at
    ) END
  );
END;
$$;
REVOKE ALL ON FUNCTION public.get_rescuer_info(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_rescuer_info(UUID) TO authenticated;

-- The clinic that said it is expecting the volunteer asks who is coming and where they are
CREATE OR REPLACE FUNCTION public.get_incoming_volunteer(p_report_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid UUID := (SELECT auth.uid());
  v_report RECORD;
  v_profile RECORD;
  v_loc RECORD;
  v_helped INTEGER;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sign in required');
  END IF;
  SELECT state, claimed_by, claimed_at, checkin_kind, heads_up_facility_id, heads_up_response, clinic_received_at
    INTO v_report FROM public.sos_reports WHERE id = p_report_id;
  IF NOT FOUND OR v_report.heads_up_facility_id IS NULL OR NOT public.is_case_clinic_staff(v_report.heads_up_facility_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only staff of the clinic that was told can track the volunteer');
  END IF;
  -- Only once this clinic said it is expecting them, and only while they are still on the way
  IF v_report.state <> 'claimed' OR v_report.claimed_by IS NULL OR v_report.checkin_kind IS NULL
     OR v_report.heads_up_response IS DISTINCT FROM 'expecting' THEN
    RETURN jsonb_build_object('success', true, 'claimed', false);
  END IF;

  SELECT full_name, created_at INTO v_profile FROM public.profiles WHERE id = v_report.claimed_by;
  SELECT count(*) INTO v_helped FROM public.sos_reports
    WHERE claimed_by = v_report.claimed_by AND state IN ('admitted', 'healing', 'resolved');
  SELECT latitude, longitude, accuracy_m, updated_at INTO v_loc FROM public.rescuer_locations
    WHERE report_id = p_report_id AND volunteer_id = v_report.claimed_by AND updated_at > clock_timestamp() - interval '10 minutes';

  RETURN jsonb_build_object(
    'success', true,
    'claimed', true,
    -- For the clinic "arrived" means the clinic itself confirmed the animal is there
    'arrived', v_report.clinic_received_at IS NOT NULL,
    'name', COALESCE(NULLIF(btrim(v_profile.full_name), ''), 'A KupKop volunteer'),
    'role', 'volunteer',
    'member_since', v_profile.created_at,
    'animals_helped', v_helped,
    'location', CASE WHEN v_loc.latitude IS NULL THEN NULL ELSE jsonb_build_object(
      'latitude', v_loc.latitude, 'longitude', v_loc.longitude, 'accuracy_m', v_loc.accuracy_m, 'updated_at', v_loc.updated_at
    ) END
  );
END;
$$;
REVOKE ALL ON FUNCTION public.get_incoming_volunteer(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_incoming_volunteer(UUID) TO authenticated;
