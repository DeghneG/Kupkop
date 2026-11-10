-- ==============================================================================
-- KupKop D-042: clinic status, smarter routing, heads-up, fairer claim lock, standby,
--               admin "no responder" actions, animal names
-- Run after 20261109000000_alerts_intake_handoffs.sql.
--   1. Clinics set Open / Emergencies only / Full (trusted for 12 hours, then "unknown")
--   2. Claim lock by severity: 15 / 30 / 60 minutes (mirrors ESCALATION_CONFIG)
--   3. New case columns: check-in, clinic heads-up, admin assignment, animal name
--   4. Check-in ("On my way", "Arrived") restarts the lock, once each
--   5. Standby: "I'm available" on a claimed case; the first in line gets a 2 minute head start
--   6. Clinic heads-up: the rescuer tells a clinic they are coming; the clinic answers
--   7. Admins: assign a volunteer, hide a false report
--   8. Animal names (clinic staff, the rescuer or an admin)
-- Mirrors: src/lib/sos/escalation.ts, clinics.ts, standby.ts. Change both together.
-- ==============================================================================

-- 1. Clinic status ------------------------------------------------------------------------------
ALTER TABLE public.facilities ADD COLUMN IF NOT EXISTS availability TEXT;
ALTER TABLE public.facilities ADD COLUMN IF NOT EXISTS availability_set_at TIMESTAMPTZ;
ALTER TABLE public.facilities DROP CONSTRAINT IF EXISTS facilities_availability_check;
ALTER TABLE public.facilities ADD CONSTRAINT facilities_availability_check
  CHECK (availability IS NULL OR availability IN ('open', 'limited', 'full'));

CREATE OR REPLACE FUNCTION public.set_clinic_availability(p_facility_id UUID, p_status TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid UUID := (SELECT auth.uid());
BEGIN
  IF v_uid IS NULL OR NOT public.is_case_clinic_staff(p_facility_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only staff of this clinic can change its status');
  END IF;
  IF p_status IS NULL OR p_status NOT IN ('open', 'limited', 'full') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Status must be open, limited or full');
  END IF;
  UPDATE public.facilities
  SET availability = p_status, availability_set_at = clock_timestamp()
  WHERE id = p_facility_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Clinic not found');
  END IF;
  RETURN jsonb_build_object('success', true, 'availability', p_status);
END;
$$;
REVOKE ALL ON FUNCTION public.set_clinic_availability(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_clinic_availability(UUID, TEXT) TO authenticated;

-- 2. Claim lock length by severity --------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.claim_lock_minutes(p_emergency_type TEXT)
RETURNS INTEGER
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_emergency_type IN ('hit_and_run', 'bleeding') THEN 15
    WHEN p_emergency_type IN ('fracture', 'trapped_abused') THEN 30
    ELSE 60
  END;
$$;

-- 3. New case columns ---------------------------------------------------------------------------
ALTER TABLE public.sos_reports ADD COLUMN IF NOT EXISTS animal_name TEXT;
ALTER TABLE public.sos_reports ADD COLUMN IF NOT EXISTS checkin_kind TEXT;
ALTER TABLE public.sos_reports ADD COLUMN IF NOT EXISTS checkin_at TIMESTAMPTZ;
-- Deliberately NOT a foreign key: a second link from sos_reports to facilities would make the existing
-- "facilities(name)" lookups ambiguous (PostgREST PGRST201). Names are read from facilities by id instead.
ALTER TABLE public.sos_reports ADD COLUMN IF NOT EXISTS heads_up_facility_id UUID;
ALTER TABLE public.sos_reports ADD COLUMN IF NOT EXISTS heads_up_eta_minutes INTEGER;
ALTER TABLE public.sos_reports ADD COLUMN IF NOT EXISTS heads_up_at TIMESTAMPTZ;
ALTER TABLE public.sos_reports ADD COLUMN IF NOT EXISTS heads_up_response TEXT;
ALTER TABLE public.sos_reports ADD COLUMN IF NOT EXISTS heads_up_response_at TIMESTAMPTZ;
ALTER TABLE public.sos_reports ADD COLUMN IF NOT EXISTS heads_up_note TEXT;
ALTER TABLE public.sos_reports ADD COLUMN IF NOT EXISTS admin_assigned_at TIMESTAMPTZ;

ALTER TABLE public.sos_reports DROP CONSTRAINT IF EXISTS sos_reports_animal_name_check;
ALTER TABLE public.sos_reports ADD CONSTRAINT sos_reports_animal_name_check
  CHECK (animal_name IS NULL OR char_length(animal_name) BETWEEN 1 AND 40);
ALTER TABLE public.sos_reports DROP CONSTRAINT IF EXISTS sos_reports_checkin_kind_check;
ALTER TABLE public.sos_reports ADD CONSTRAINT sos_reports_checkin_kind_check
  CHECK (checkin_kind IS NULL OR checkin_kind IN ('on_my_way', 'arrived'));
ALTER TABLE public.sos_reports DROP CONSTRAINT IF EXISTS sos_reports_heads_up_response_check;
ALTER TABLE public.sos_reports ADD CONSTRAINT sos_reports_heads_up_response_check
  CHECK (heads_up_response IS NULL OR heads_up_response IN ('expecting', 'cannot'));

-- Check-ins and heads-ups belong to one claim: they clear when the case leaves 'claimed' or changes hands.
-- On insert every server-owned field starts empty, so a reporter cannot pre-fill them.
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
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_reset_claim_extras ON public.sos_reports;
CREATE TRIGGER trg_reset_claim_extras
  BEFORE INSERT OR UPDATE ON public.sos_reports
  FOR EACH ROW
  EXECUTE FUNCTION public.reset_claim_extras();

-- 5a. Standby list ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.claim_standby (
  report_id UUID NOT NULL REFERENCES public.sos_reports(id) ON DELETE CASCADE,
  volunteer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (report_id, volunteer_id)
);
CREATE INDEX IF NOT EXISTS claim_standby_volunteer ON public.claim_standby (volunteer_id);
ALTER TABLE public.claim_standby ENABLE ROW LEVEL SECURITY;

-- Responders see who is on standby; nobody writes directly (join_standby / leave_standby only)
DROP POLICY IF EXISTS "Responders read standby" ON public.claim_standby;
CREATE POLICY "Responders read standby"
  ON public.claim_standby FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (SELECT auth.uid()) AND p.role IN ('volunteer', 'admin')
    )
  );

-- The list empties itself once the animal is in a clinic's hands or the report is hidden
CREATE OR REPLACE FUNCTION public.clear_standby_when_closed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  DELETE FROM public.claim_standby WHERE report_id = NEW.id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_clear_standby_when_closed ON public.sos_reports;
CREATE TRIGGER trg_clear_standby_when_closed
  AFTER UPDATE ON public.sos_reports
  FOR EACH ROW
  WHEN (NEW.state IN ('admitted', 'healing', 'resolved') OR NEW.hidden_at IS NOT NULL)
  EXECUTE FUNCTION public.clear_standby_when_closed();

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
  IF v_report.claimed_at <= v_now - make_interval(mins => public.claim_lock_minutes(v_report.emergency_type::text)) THEN
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

CREATE OR REPLACE FUNCTION public.leave_standby(p_report_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid UUID := (SELECT auth.uid());
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sign in required');
  END IF;
  DELETE FROM public.claim_standby WHERE report_id = p_report_id AND volunteer_id = v_uid;
  RETURN jsonb_build_object('success', true);
END;
$$;
REVOKE ALL ON FUNCTION public.leave_standby(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.leave_standby(UUID) TO authenticated;

-- 2 + 5b. Claim: lock by severity, one active rescue, and the standby head start ------------------
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
      AND r.claimed_at > (v_now - make_interval(mins => public.claim_lock_minutes(r.emergency_type::text)))
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

  IF v_report.state = 'claimed'
     AND v_report.claimed_by IS NOT NULL
     AND v_report.claimed_by <> v_uid
     AND v_report.claimed_at > (v_now - make_interval(mins => v_lock)) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Already claimed by another rescuer',
      'claimed_at', v_report.claimed_at
    );
  END IF;

  -- The case is open again: the first volunteer on standby has 2 minutes before everyone else
  IF v_report.claimed_by IS DISTINCT FROM v_uid THEN
    v_opened_at := CASE WHEN v_report.state = 'claimed' THEN v_report.claimed_at + make_interval(mins => v_lock) ELSE v_report.updated_at END;
    SELECT volunteer_id INTO v_first FROM public.claim_standby WHERE report_id = p_report_id ORDER BY created_at LIMIT 1;
    IF v_first IS NOT NULL AND v_first <> v_uid AND v_now < v_opened_at + INTERVAL '2 minutes' THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'This case is held for the next volunteer in line for another ' ||
                 greatest(1, ceil(extract(epoch FROM (v_opened_at + INTERVAL '2 minutes' - v_now)) / 60)::int) || ' min.'
      );
    END IF;
  END IF;

  UPDATE public.sos_reports
  SET claimed_by = v_uid, claimed_at = v_now, state = 'claimed', updated_at = v_now, admin_assigned_at = NULL
  WHERE id = p_report_id;

  -- Whoever takes a case no longer waits for another
  DELETE FROM public.claim_standby WHERE volunteer_id = v_uid;

  RETURN jsonb_build_object(
    'success', true,
    'report_id', p_report_id,
    'claimed_by', v_uid,
    'claimed_at', v_now,
    'lock_duration_minutes', v_lock
  );
END;
$$;
REVOKE ALL ON FUNCTION public.claim_sos_report(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_sos_report(UUID) TO authenticated;

-- 4. Check-in: restarts the lock, "On my way" once and "Arrived" once per claim ---------------------
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

-- 6. Clinic heads-up ---------------------------------------------------------------------------------
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
      updated_at = v_now
  WHERE id = p_report_id;

  RETURN jsonb_build_object('success', true, 'facility_id', p_facility_id);
END;
$$;
REVOKE ALL ON FUNCTION public.send_clinic_heads_up(UUID, UUID, INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.send_clinic_heads_up(UUID, UUID, INTEGER) TO authenticated;

CREATE OR REPLACE FUNCTION public.respond_to_heads_up(p_report_id UUID, p_response TEXT, p_note TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid UUID := (SELECT auth.uid());
  v_report RECORD;
  v_note TEXT := NULLIF(btrim(left(COALESCE(p_note, ''), 300)), '');
  v_now TIMESTAMPTZ := clock_timestamp();
BEGIN
  IF p_response IS NULL OR p_response NOT IN ('expecting', 'cannot') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Answer must be expecting or cannot');
  END IF;

  SELECT * INTO v_report FROM public.sos_reports WHERE id = p_report_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Report not found');
  END IF;
  IF v_uid IS NULL OR v_report.heads_up_facility_id IS NULL OR NOT public.is_case_clinic_staff(v_report.heads_up_facility_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only staff of the clinic that was told can answer');
  END IF;
  IF v_report.state <> 'claimed' THEN
    RETURN jsonb_build_object('success', false, 'error', 'This case is no longer on the way');
  END IF;

  UPDATE public.sos_reports
  SET heads_up_response = p_response, heads_up_response_at = v_now, heads_up_note = v_note, updated_at = v_now
  WHERE id = p_report_id;

  RETURN jsonb_build_object('success', true);
END;
$$;
REVOKE ALL ON FUNCTION public.respond_to_heads_up(UUID, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.respond_to_heads_up(UUID, TEXT, TEXT) TO authenticated;

-- 7. Admin actions on a case nobody has taken ---------------------------------------------------------
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
  DELETE FROM public.claim_standby WHERE volunteer_id = p_volunteer_id;

  RETURN jsonb_build_object('success', true, 'claimed_by', p_volunteer_id);
END;
$$;
REVOKE ALL ON FUNCTION public.admin_assign_claim(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_assign_claim(UUID, UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_hide_report(p_report_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_now TIMESTAMPTZ := clock_timestamp();
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Admins only');
  END IF;
  UPDATE public.sos_reports SET hidden_at = v_now, updated_at = v_now WHERE id = p_report_id AND hidden_at IS NULL;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Report not found or already hidden');
  END IF;
  RETURN jsonb_build_object('success', true);
END;
$$;
REVOKE ALL ON FUNCTION public.admin_hide_report(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_hide_report(UUID) TO authenticated;

-- 8. Animal names -------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_animal_name(p_report_id UUID, p_name TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid UUID := (SELECT auth.uid());
  v_report RECORD;
  v_name TEXT := NULLIF(btrim(COALESCE(p_name, '')), '');
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sign in required');
  END IF;
  SELECT * INTO v_report FROM public.sos_reports WHERE id = p_report_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Report not found');
  END IF;
  IF NOT (
    public.is_admin()
    OR (v_report.state = 'claimed' AND v_report.claimed_by = v_uid)
    OR (v_report.facility_id IS NOT NULL AND public.is_case_clinic_staff(v_report.facility_id))
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only the rescuer, the clinic caring for the animal or an admin can name it');
  END IF;
  IF v_name IS NOT NULL AND (char_length(v_name) > 40 OR v_name ~ '[<>]') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Use a short name (up to 40 characters, no < or >)');
  END IF;

  UPDATE public.sos_reports SET animal_name = v_name, updated_at = clock_timestamp() WHERE id = p_report_id;
  RETURN jsonb_build_object('success', true, 'animal_name', v_name);
END;
$$;
REVOKE ALL ON FUNCTION public.set_animal_name(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_animal_name(UUID, TEXT) TO authenticated;
