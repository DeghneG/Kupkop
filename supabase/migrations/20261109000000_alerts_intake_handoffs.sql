-- ==============================================================================
-- KupKop D-032: alerts, clinic intake, AI photo check, bystander handoffs, admin tools
-- Run after 20261029000003_qa_fixes.sql.
--   1. Responder alert areas, web push subscriptions, alert logs (read by /api/cron/tick)
--   2. Clinics can be Paused (delisted) after a missed 14-day update
--   3. Intake: clinic confirms arrival or can't accept; paused clinics can't receive animals
--   4. AI photo check columns; AI flags in report_flags
--   5. Report photos must come from this project's own storage host
--   6. Bystander handoffs with a private plate photo
--   7. Admin role changes through admin_set_role()
-- ==============================================================================

-- 1a. Where a responder wants alerts (opt-in; one area per person)
CREATE TABLE IF NOT EXISTS public.responder_alert_prefs (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  latitude DOUBLE PRECISION NOT NULL CHECK (latitude BETWEEN -90 AND 90),
  longitude DOUBLE PRECISION NOT NULL CHECK (longitude BETWEEN -180 AND 180),
  radius_km NUMERIC NOT NULL DEFAULT 3 CHECK (radius_km BETWEEN 0.5 AND 50),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.responder_alert_prefs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Own alert area" ON public.responder_alert_prefs;
CREATE POLICY "Own alert area"
  ON public.responder_alert_prefs FOR ALL
  TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

-- 1b. Browser push subscriptions (one row per browser endpoint)
CREATE TABLE IF NOT EXISTS public.web_push_subscriptions (
  endpoint TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS web_push_subscriptions_user ON public.web_push_subscriptions (user_id);
ALTER TABLE public.web_push_subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Own push subscriptions readable" ON public.web_push_subscriptions;
CREATE POLICY "Own push subscriptions readable"
  ON public.web_push_subscriptions FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = user_id);
DROP POLICY IF EXISTS "Own push subscriptions removable" ON public.web_push_subscriptions;
CREATE POLICY "Own push subscriptions removable"
  ON public.web_push_subscriptions FOR DELETE
  TO authenticated
  USING ((SELECT auth.uid()) = user_id);

-- A browser endpoint moves to whoever is signed in on it now, so the last user stops getting alerts
CREATE OR REPLACE FUNCTION public.save_web_push_subscription(p_endpoint TEXT, p_p256dh TEXT, p_auth TEXT)
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
  IF p_endpoint IS NULL OR p_endpoint NOT LIKE 'https://%' OR char_length(p_endpoint) > 1000 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid push subscription');
  END IF;
  INSERT INTO public.web_push_subscriptions (endpoint, user_id, p256dh, auth)
  VALUES (p_endpoint, v_uid, p_p256dh, p_auth)
  ON CONFLICT (endpoint) DO UPDATE
    SET user_id = EXCLUDED.user_id, p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth, created_at = now();
  RETURN jsonb_build_object('success', true);
END;
$$;
REVOKE ALL ON FUNCTION public.save_web_push_subscription(TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_web_push_subscription(TEXT, TEXT, TEXT) TO authenticated;

-- 1c. Which escalation alerts already went out, so the scheduler never sends one twice.
--     Readable by everyone: the feed says "Alert sent to all volunteers" only once it really was.
CREATE TABLE IF NOT EXISTS public.sos_alert_log (
  report_id UUID NOT NULL REFERENCES public.sos_reports(id) ON DELETE CASCADE,
  stage TEXT NOT NULL CHECK (stage IN ('initial', 'widened', 'no_responder')),
  recipients INTEGER NOT NULL DEFAULT 0,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (report_id, stage)
);
ALTER TABLE public.sos_alert_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Alert log readable by everyone" ON public.sos_alert_log;
CREATE POLICY "Alert log readable by everyone"
  ON public.sos_alert_log FOR SELECT
  TO anon, authenticated
  USING (true);

-- 1d. Overdue-care alerts, one per case per missed update (server only)
CREATE TABLE IF NOT EXISTS public.care_alert_log (
  report_id UUID NOT NULL REFERENCES public.sos_reports(id) ON DELETE CASCADE,
  last_update_at TIMESTAMPTZ NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (report_id, last_update_at)
);
ALTER TABLE public.care_alert_log ENABLE ROW LEVEL SECURITY;

-- 2. Paused = delisted: hidden from the clinic picker and the Clinics page until an admin lists it again
ALTER TABLE public.facilities DROP CONSTRAINT IF EXISTS facilities_status_check;
ALTER TABLE public.facilities ADD CONSTRAINT facilities_status_check CHECK (status IN ('Listed', 'Pending', 'Paused'));
ALTER TABLE public.facilities ADD COLUMN IF NOT EXISTS paused_reason TEXT;
ALTER TABLE public.facilities ADD COLUMN IF NOT EXISTS paused_at TIMESTAMPTZ;

-- 3. Intake and AI check columns on reports
ALTER TABLE public.sos_reports ADD COLUMN IF NOT EXISTS intake_confirmed_at TIMESTAMPTZ;
ALTER TABLE public.sos_reports ADD COLUMN IF NOT EXISTS ai_checked_at TIMESTAMPTZ;
ALTER TABLE public.sos_reports ADD COLUMN IF NOT EXISTS ai_has_animal BOOLEAN;
ALTER TABLE public.sos_reports ADD COLUMN IF NOT EXISTS ai_graphic BOOLEAN;
ALTER TABLE public.sos_reports ADD COLUMN IF NOT EXISTS ai_note TEXT;

-- 4 + 5. New reports: server-owned fields start empty; photo must be in this project's live-snaps
CREATE OR REPLACE FUNCTION public.sanitize_new_sos_report()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_object TEXT;
  v_host TEXT;
BEGIN
  NEW.state := 'reported';
  NEW.claimed_by := NULL;
  NEW.claimed_at := NULL;
  NEW.facility_id := NULL;
  NEW.hidden_at := NULL;
  NEW.intake_confirmed_at := NULL;
  NEW.ai_checked_at := NULL;
  NEW.ai_has_animal := NULL;
  NEW.ai_graphic := NULL;
  NEW.ai_note := NULL;

  NEW.urgency := CASE
    WHEN NEW.emergency_type IN ('hit_and_run', 'bleeding') THEN 'critical'::emergency_urgency
    WHEN NEW.emergency_type IN ('fracture', 'trapped_abused') THEN 'urgent'::emergency_urgency
    ELSE 'moderate'::emergency_urgency
  END;

  v_object := split_part(split_part(COALESCE(NEW.photo_url, ''), '/storage/v1/object/public/live-snaps/', 2), '?', 1);
  IF NEW.photo_url NOT LIKE 'https://%.supabase.co/storage/v1/object/public/live-snaps/%'
     OR v_object NOT LIKE NEW.reporter_id::text || '/%'
     OR NOT EXISTS (SELECT 1 FROM storage.objects o WHERE o.bucket_id = 'live-snaps' AND o.name = v_object) THEN
    RAISE EXCEPTION 'The photo must come from the live camera upload.' USING ERRCODE = 'check_violation';
  END IF;

  -- Calls through the API carry this project's own host; the photo link must point at it.
  -- Only checked when the header really is a Supabase project host, so a gateway that rewrites
  -- the header can never block reports.
  v_host := NULLIF(current_setting('request.headers', true), '')::json ->> 'host';
  IF v_host LIKE '%.supabase.co' AND NEW.photo_url NOT LIKE 'https://' || v_host || '/storage/%' THEN
    RAISE EXCEPTION 'The photo must come from the live camera upload.' USING ERRCODE = 'check_violation';
  END IF;

  IF (SELECT count(*) FROM public.sos_reports r
      WHERE r.reporter_id = NEW.reporter_id AND r.created_at > clock_timestamp() - INTERVAL '10 minutes') >= 5 THEN
    RAISE EXCEPTION 'Too many reports in a short time. Please wait a few minutes before sending another.'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

-- Admit only to a Listed clinic (claimer or admin, only while claimed)
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
  IF v_facility.status <> 'Listed' THEN
    RETURN jsonb_build_object('success', false, 'error', 'This clinic is paused and cannot receive animals right now');
  END IF;

  UPDATE public.sos_reports
  SET facility_id = p_facility_id, state = 'admitted', intake_confirmed_at = NULL, updated_at = v_now
  WHERE id = p_report_id;

  UPDATE public.facilities SET last_active_at = v_now WHERE id = p_facility_id;

  INSERT INTO public.recovery_updates (report_id, author_id, notes, state, created_at)
  VALUES (
    p_report_id,
    v_uid,
    COALESCE(NULLIF(left(p_notes, 500), ''), 'Brought to ' || v_facility.name || '. Waiting for the clinic to confirm.'),
    'admitted',
    v_now
  );

  RETURN jsonb_build_object('success', true, 'report_id', p_report_id, 'facility_id', p_facility_id, 'state', 'admitted', 'admitted_at', v_now);
END;
$$;
REVOKE ALL ON FUNCTION public.admit_to_facility(UUID, UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admit_to_facility(UUID, UUID, TEXT) TO authenticated;

-- True when the caller is staff of the clinic caring for this report, or an admin
CREATE OR REPLACE FUNCTION public.is_case_clinic_staff(p_facility_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_admin() OR EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = (SELECT auth.uid()) AND p.role = 'facility'
      AND p.facility_id IS NOT NULL AND p.facility_id = p_facility_id
  );
$$;

-- Clinic confirms the animal arrived
CREATE OR REPLACE FUNCTION public.confirm_intake(p_report_id UUID)
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
  IF v_uid IS NULL OR NOT public.is_case_clinic_staff(v_report.facility_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only staff of this clinic can confirm intake');
  END IF;
  IF v_report.state <> 'admitted' OR v_report.intake_confirmed_at IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'This case is not waiting for intake');
  END IF;

  UPDATE public.sos_reports SET intake_confirmed_at = v_now, updated_at = v_now WHERE id = p_report_id;
  UPDATE public.facilities SET last_active_at = v_now WHERE id = v_report.facility_id;
  INSERT INTO public.recovery_updates (report_id, author_id, notes, state, created_at)
  VALUES (p_report_id, v_uid, 'The clinic confirmed the animal arrived.', 'admitted', v_now);

  RETURN jsonb_build_object('success', true);
END;
$$;
REVOKE ALL ON FUNCTION public.confirm_intake(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.confirm_intake(UUID) TO authenticated;

-- Clinic can't take the animal: back to the rescuer with a fresh 60-minute lock to pick another clinic
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

  UPDATE public.sos_reports
  SET state = 'claimed', facility_id = NULL, claimed_at = v_now, intake_confirmed_at = NULL, updated_at = v_now
  WHERE id = p_report_id;

  INSERT INTO public.recovery_updates (report_id, author_id, notes, state, created_at)
  VALUES (p_report_id, v_uid, COALESCE(v_clinic, 'The clinic') || ' could not accept the animal: ' || v_reason, 'claimed', v_now);

  RETURN jsonb_build_object('success', true, 'claimed_by', v_report.claimed_by);
END;
$$;
REVOKE ALL ON FUNCTION public.decline_admission(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.decline_admission(UUID, TEXT) TO authenticated;

-- Recovery updates: posting one also confirms intake
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
  v_report RECORD;
  v_notes TEXT := NULLIF(btrim(left(COALESCE(p_notes, ''), 500)), '');
  v_now TIMESTAMPTZ := clock_timestamp();
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sign in required');
  END IF;

  SELECT * INTO v_report FROM public.sos_reports WHERE id = p_report_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Report not found');
  END IF;
  IF NOT public.is_case_clinic_staff(v_report.facility_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only staff of the clinic caring for this animal can post updates');
  END IF;
  IF v_report.state NOT IN ('admitted', 'healing') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Updates can only be posted while the animal is in care');
  END IF;
  IF p_state NOT IN ('admitted', 'healing', 'resolved')
     OR (v_report.state = 'healing' AND p_state = 'admitted') THEN
    RETURN jsonb_build_object('success', false, 'error', 'That status change is not allowed');
  END IF;
  IF v_notes IS NULL OR char_length(v_notes) < 5 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Write a short note on how the animal is doing (5+ characters)');
  END IF;

  INSERT INTO public.recovery_updates (report_id, author_id, notes, state, created_at)
  VALUES (p_report_id, v_uid, v_notes, p_state, v_now);

  UPDATE public.sos_reports
  SET state = p_state, intake_confirmed_at = COALESCE(intake_confirmed_at, v_now), updated_at = v_now
  WHERE id = p_report_id;
  UPDATE public.facilities SET last_active_at = v_now WHERE id = v_report.facility_id;

  RETURN jsonb_build_object('success', true, 'report_id', p_report_id, 'state', p_state, 'posted_at', v_now);
END;
$$;
REVOKE ALL ON FUNCTION public.post_recovery_update(UUID, TEXT, case_state) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.post_recovery_update(UUID, TEXT, case_state) TO authenticated;

-- 4b. AI flags: written by the server with no person attached
ALTER TABLE public.report_flags ALTER COLUMN flagged_by DROP NOT NULL;
ALTER TABLE public.report_flags ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'user';
ALTER TABLE public.report_flags DROP CONSTRAINT IF EXISTS report_flags_source_check;
ALTER TABLE public.report_flags ADD CONSTRAINT report_flags_source_check
  CHECK (source IN ('user', 'ai') AND (source = 'ai' OR flagged_by IS NOT NULL));

DROP POLICY IF EXISTS "Users flag reports as themselves" ON public.report_flags;
CREATE POLICY "Users flag reports as themselves"
  ON public.report_flags FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT auth.uid()) = flagged_by
    AND source = 'user'
    AND status = 'open'
    AND reviewed_at IS NULL
    AND reviewed_by IS NULL
  );

-- 6. Bystander handoffs: the animal goes with someone else (e.g. a driver); plate photo stays private
CREATE TABLE IF NOT EXISTS public.handoffs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES public.sos_reports(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  note TEXT NOT NULL CHECK (char_length(note) BETWEEN 5 AND 300),
  plate_photo_path TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS handoffs_report ON public.handoffs (report_id);
ALTER TABLE public.handoffs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Handoffs readable by reporter, creator, claimer or admin" ON public.handoffs;
CREATE POLICY "Handoffs readable by reporter, creator, claimer or admin"
  ON public.handoffs FOR SELECT
  TO authenticated
  USING (
    (SELECT auth.uid()) = created_by
    OR public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.sos_reports r
      WHERE r.id = report_id AND ((SELECT auth.uid()) = r.reporter_id OR (SELECT auth.uid()) = r.claimed_by)
    )
  );

DROP POLICY IF EXISTS "Reporter or claimer records a handoff" ON public.handoffs;
CREATE POLICY "Reporter or claimer records a handoff"
  ON public.handoffs FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT auth.uid()) = created_by
    AND plate_photo_path LIKE (SELECT auth.uid())::text || '/%'
    AND EXISTS (
      SELECT 1 FROM public.sos_reports r
      WHERE r.id = report_id
        AND r.state IN ('reported', 'claimed')
        AND ((SELECT auth.uid()) = r.reporter_id OR (SELECT auth.uid()) = r.claimed_by)
    )
  );

-- The case's reporter may also view a plate photo taken by the rescuer
DROP POLICY IF EXISTS "Private plate photos viewable by reporter or admin" ON storage.objects;
CREATE POLICY "Private plate photos viewable by reporter or admin"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'plate-photos'
    AND (
      (storage.foldername(name))[1] = (SELECT auth.uid())::text
      OR public.is_admin()
      OR EXISTS (
        SELECT 1 FROM public.handoffs h
        JOIN public.sos_reports r ON r.id = h.report_id
        WHERE h.plate_photo_path = name AND r.reporter_id = (SELECT auth.uid())
      )
    )
  );

UPDATE storage.buckets
SET file_size_limit = 2097152,
    allowed_mime_types = ARRAY['image/webp', 'image/jpeg', 'image/png']
WHERE id = 'plate-photos';

-- 7. Admin role changes (never on yourself, so an admin can't lock everyone out)
CREATE OR REPLACE FUNCTION public.admin_set_role(p_user_id UUID, p_role user_role, p_facility_id UUID DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Admins only');
  END IF;
  IF p_user_id = (SELECT auth.uid()) THEN
    RETURN jsonb_build_object('success', false, 'error', 'You cannot change your own role');
  END IF;
  IF p_role = 'facility' AND p_facility_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Clinic staff need a clinic');
  END IF;

  UPDATE public.profiles
  SET role = p_role,
      facility_id = CASE WHEN p_role = 'facility' THEN p_facility_id ELSE NULL END,
      updated_at = clock_timestamp()
  WHERE id = p_user_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not found');
  END IF;

  -- A volunteer losing the role gives up any rescue they still hold
  IF p_role NOT IN ('volunteer', 'admin') THEN
    UPDATE public.sos_reports
    SET state = 'reported', claimed_by = NULL, claimed_at = NULL, updated_at = clock_timestamp()
    WHERE claimed_by = p_user_id AND state = 'claimed';
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$$;
REVOKE ALL ON FUNCTION public.admin_set_role(UUID, user_role, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_role(UUID, user_role, UUID) TO authenticated;

-- 8. One-off event alerts (e.g. "the clinic could not accept your animal"), sent once per key (server only)
CREATE TABLE IF NOT EXISTS public.push_event_log (
  key TEXT PRIMARY KEY,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.push_event_log ENABLE ROW LEVEL SECURITY;
