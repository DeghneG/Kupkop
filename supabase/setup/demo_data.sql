-- ==============================================================================
-- KupKop DEMO DATA (fake cases for screenshots, demos and testing). Run in the Supabase SQL Editor.
--
-- Run it AFTER every migration, including 20261110000000_clinic_status_standby_headsup.sql.
-- You need at least one profile, so sign in to KupKop once before running it.
--
-- What it adds (all case IDs start with KK-D1, no photos, fake locations in Metro Manila):
--   4 cases waiting for a rescuer (critical, critical, urgent, moderate), 1 claimed,
--   1 admitted and waiting for the clinic to confirm, 1 healing on day 3, 1 healing with an
--   update due in 2 days, 1 overdue (day 15), 1 resolved, plus the four test clinics if missing.
--
-- NOTE: the overdue case makes the scheduler pause Test Clinic C (the 14-day rule working as
-- designed). List it again in Admin > Clinics.
--
-- Run it again any time: it replaces its own cases first. To remove them completely:
--   DELETE FROM public.sos_reports WHERE short_id LIKE 'KK-D1%';
--
-- Untested against your database: it switches two safety triggers off for the duration of the
-- insert (so ages can be backdated) and back on in the same transaction. If anything fails, the
-- whole thing rolls back and the triggers stay on.
-- ==============================================================================

DO $$
DECLARE
  v_user UUID;
  v_a UUID;
  v_b UUID;
  v_c UUID;
  r UUID;
BEGIN
  SELECT id INTO v_user FROM public.profiles ORDER BY created_at LIMIT 1;
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Sign in to KupKop once first, so there is a profile to report from.';
  END IF;

  -- The test clinics (only added if their names are missing)
  INSERT INTO public.facilities (name, address, phone, latitude, longitude, status, last_active_at)
  SELECT v.name, v.address, v.phone, v.latitude, v.longitude, 'Listed', now() - v.idle
  FROM (
    VALUES
      ('Test Clinic A (Katipunan)',   'Katipunan Ave, Quezon City',       '0000-000-0001', 14.6391, 121.0766, interval '2 hours'),
      ('Test Clinic B (New Manila)',  'E. Rodriguez Sr. Ave, New Manila', '0000-000-0002', 14.6225, 121.0331, interval '4 days'),
      ('Test Clinic C (Aurora Blvd)', 'Aurora Blvd near Broadway',        '0000-000-0003', 14.6128, 121.0287, interval '12 days'),
      ('Test Shelter D (Kamias)',     'Kamias Rd near Anonas',            '0000-000-0004', 14.6262, 121.0546, interval '15 days')
  ) AS v(name, address, phone, latitude, longitude, idle)
  WHERE NOT EXISTS (SELECT 1 FROM public.facilities f WHERE f.name = v.name);

  SELECT id INTO v_a FROM public.facilities WHERE name = 'Test Clinic A (Katipunan)';
  SELECT id INTO v_b FROM public.facilities WHERE name = 'Test Clinic B (New Manila)';
  SELECT id INTO v_c FROM public.facilities WHERE name = 'Test Clinic C (Aurora Blvd)';

  -- Backdating ages needs these two triggers off while we insert (they run again afterwards)
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_enforce_sos_server_timestamp' AND tgrelid = 'public.sos_reports'::regclass) THEN
    ALTER TABLE public.sos_reports DISABLE TRIGGER trg_enforce_sos_server_timestamp;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_sanitize_new_sos_report' AND tgrelid = 'public.sos_reports'::regclass) THEN
    ALTER TABLE public.sos_reports DISABLE TRIGGER trg_sanitize_new_sos_report;
  END IF;

  DELETE FROM public.sos_reports WHERE short_id LIKE 'KK-D1%';

  -- ---- Waiting for a rescuer ----
  INSERT INTO public.sos_reports (short_id, reporter_id, animal_type, emergency_type, urgency, state, photo_url, latitude, longitude, location_name, description, created_at, updated_at, server_timestamp)
  VALUES
    ('KK-D101', v_user, 'dog', 'hit_and_run',  'critical', 'reported', '', 14.6198, 121.0526, 'Aurora Blvd near EDSA, Cubao',      'Lying beside the jeepney stop, front leg bent.',        now() - interval '4 minutes',  now() - interval '4 minutes',  now() - interval '4 minutes'),
    ('KK-D102', v_user, 'cat', 'bleeding',     'critical', 'reported', '', 14.6225, 121.0331, 'E. Rodriguez Sr. Ave, New Manila', 'Cut on the hind leg, hiding under a parked car.',        now() - interval '11 minutes', now() - interval '11 minutes', now() - interval '11 minutes'),
    ('KK-D103', v_user, 'dog', 'fracture',     'urgent',   'reported', '', 14.6305, 121.0366, 'Kamuning Rd near Tomas Morato',    'A puppy, limping and crying on the sidewalk.',          now() - interval '35 minutes', now() - interval '35 minutes', now() - interval '35 minutes'),
    ('KK-D104', v_user, 'dog', 'sick_mange',   'moderate', 'reported', '', 14.6262, 121.0546, 'Kamias Rd near Anonas',            'Severe mange, very thin, stays near the market stalls.', now() - interval '3 hours',    now() - interval '3 hours',    now() - interval '3 hours');

  -- ---- Claimed 12 minutes ago (the 60-minute lock is running) ----
  INSERT INTO public.sos_reports (short_id, reporter_id, animal_type, emergency_type, urgency, state, photo_url, latitude, longitude, location_name, description, claimed_by, claimed_at, created_at, updated_at, server_timestamp)
  VALUES ('KK-D105', v_user, 'cat', 'trapped_abused', 'urgent', 'claimed', '', 14.6339, 121.0348, 'Tomas Morato Ave, Quezon City', 'A kitten stuck in a storm drain.', v_user, now() - interval '12 minutes', now() - interval '25 minutes', now() - interval '12 minutes', now() - interval '25 minutes');

  -- ---- Admitted at Test Clinic A, the clinic has not confirmed yet ----
  INSERT INTO public.sos_reports (short_id, reporter_id, animal_type, emergency_type, urgency, state, photo_url, latitude, longitude, location_name, description, claimed_by, claimed_at, facility_id, intake_confirmed_at, created_at, updated_at, server_timestamp)
  VALUES ('KK-D106', v_user, 'dog', 'hit_and_run', 'critical', 'admitted', '', 14.6391, 121.0766, 'Katipunan Ave, Quezon City', 'Hit by a motorcycle, a rescuer carried it in a towel.', v_user, now() - interval '40 minutes', v_a, NULL, now() - interval '50 minutes', now() - interval '8 minutes', now() - interval '50 minutes')
  RETURNING id INTO r;
  INSERT INTO public.recovery_updates (report_id, author_id, notes, state, created_at)
  VALUES (r, v_user, 'Brought to Test Clinic A (Katipunan). Waiting for the clinic to confirm.', 'admitted', now() - interval '8 minutes');

  -- ---- Healing, day 3 ----
  INSERT INTO public.sos_reports (short_id, reporter_id, animal_type, emergency_type, urgency, state, photo_url, latitude, longitude, location_name, description, claimed_by, claimed_at, facility_id, intake_confirmed_at, created_at, updated_at, server_timestamp)
  VALUES ('KK-D107', v_user, 'cat', 'fracture', 'urgent', 'healing', '', 14.6391, 121.0766, 'Katipunan Ave, Quezon City', 'Broken front leg.', v_user, now() - interval '3 days', v_a, now() - interval '3 days' + interval '1 hour', now() - interval '3 days', now() - interval '2 days', now() - interval '3 days')
  RETURNING id INTO r;
  INSERT INTO public.recovery_updates (report_id, author_id, notes, state, created_at) VALUES
    (r, v_user, 'Brought to Test Clinic A (Katipunan). Waiting for the clinic to confirm.', 'admitted', now() - interval '3 days'),
    (r, v_user, 'The clinic confirmed the animal arrived.',                                  'admitted', now() - interval '3 days' + interval '1 hour'),
    (r, v_user, 'Splint on, eating well.',                                                   'healing',  now() - interval '2 days');

  -- ---- Healing, last update 12 days ago: an update is due in 2 days ----
  INSERT INTO public.sos_reports (short_id, reporter_id, animal_type, emergency_type, urgency, state, photo_url, latitude, longitude, location_name, description, claimed_by, claimed_at, facility_id, intake_confirmed_at, created_at, updated_at, server_timestamp)
  VALUES ('KK-D108', v_user, 'dog', 'sick_mange', 'moderate', 'healing', '', 14.6225, 121.0331, 'E. Rodriguez Sr. Ave, New Manila', 'Mange treatment started.', v_user, now() - interval '14 days', v_b, now() - interval '14 days' + interval '1 hour', now() - interval '14 days', now() - interval '12 days', now() - interval '14 days')
  RETURNING id INTO r;
  INSERT INTO public.recovery_updates (report_id, author_id, notes, state, created_at) VALUES
    (r, v_user, 'Brought to Test Clinic B (New Manila). Waiting for the clinic to confirm.', 'admitted', now() - interval '14 days'),
    (r, v_user, 'Started treatment, needs rechecking.',                                       'healing',  now() - interval '12 days');

  -- ---- Admitted, last update 15 days ago: overdue ----
  INSERT INTO public.sos_reports (short_id, reporter_id, animal_type, emergency_type, urgency, state, photo_url, latitude, longitude, location_name, description, claimed_by, claimed_at, facility_id, intake_confirmed_at, created_at, updated_at, server_timestamp)
  VALUES ('KK-D109', v_user, 'cat', 'bleeding', 'critical', 'admitted', '', 14.6128, 121.0287, 'Aurora Blvd near Broadway', 'Deep cut on the side.', v_user, now() - interval '20 days', v_c, now() - interval '20 days' + interval '1 hour', now() - interval '20 days', now() - interval '15 days', now() - interval '20 days')
  RETURNING id INTO r;
  INSERT INTO public.recovery_updates (report_id, author_id, notes, state, created_at) VALUES
    (r, v_user, 'Brought to Test Clinic C (Aurora Blvd). Waiting for the clinic to confirm.', 'admitted', now() - interval '20 days'),
    (r, v_user, 'Wound cleaned and stitched, weak but stable.',                                'admitted', now() - interval '15 days');

  -- ---- Resolved ----
  INSERT INTO public.sos_reports (short_id, reporter_id, animal_type, emergency_type, urgency, state, photo_url, latitude, longitude, location_name, description, claimed_by, claimed_at, facility_id, intake_confirmed_at, created_at, updated_at, server_timestamp)
  VALUES ('KK-D110', v_user, 'dog', 'fracture', 'urgent', 'resolved', '', 14.6391, 121.0766, 'Katipunan Ave, Quezon City', 'Limping on a hind leg.', v_user, now() - interval '6 days', v_a, now() - interval '6 days' + interval '1 hour', now() - interval '6 days', now() - interval '20 hours', now() - interval '6 days')
  RETURNING id INTO r;
  INSERT INTO public.recovery_updates (report_id, author_id, notes, state, created_at) VALUES
    (r, v_user, 'Brought to Test Clinic A (Katipunan). Waiting for the clinic to confirm.', 'admitted', now() - interval '6 days'),
    (r, v_user, 'Healing well, walking again.',                                              'healing',  now() - interval '5 days'),
    (r, v_user, 'Recovered and returned to the street.',                                     'resolved', now() - interval '20 hours');

  -- ---- D-042 extras: clinic status, a heads-up waiting for an answer, two named animals ----
  UPDATE public.facilities SET availability = 'open',    availability_set_at = now() - interval '20 minutes' WHERE name = 'Test Clinic A (Katipunan)';
  UPDATE public.facilities SET availability = 'full',    availability_set_at = now() - interval '1 hour'     WHERE name = 'Test Clinic B (New Manila)';
  UPDATE public.facilities SET availability = 'limited', availability_set_at = now() - interval '2 hours'    WHERE name = 'Test Clinic C (Aurora Blvd)';
  -- KK-D105 (claimed) has told Test Clinic A it is coming and is waiting for the answer
  UPDATE public.sos_reports
  SET heads_up_facility_id = v_a, heads_up_eta_minutes = 10, heads_up_at = now() - interval '3 minutes'
  WHERE short_id = 'KK-D105';
  UPDATE public.sos_reports SET animal_name = 'Bob'  WHERE short_id = 'KK-D107';
  UPDATE public.sos_reports SET animal_name = 'Luna' WHERE short_id = 'KK-D110';

  -- Safety triggers back on
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_enforce_sos_server_timestamp' AND tgrelid = 'public.sos_reports'::regclass) THEN
    ALTER TABLE public.sos_reports ENABLE TRIGGER trg_enforce_sos_server_timestamp;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_sanitize_new_sos_report' AND tgrelid = 'public.sos_reports'::regclass) THEN
    ALTER TABLE public.sos_reports ENABLE TRIGGER trg_sanitize_new_sos_report;
  END IF;
END $$;
