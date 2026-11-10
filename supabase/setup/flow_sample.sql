-- ==============================================================================
-- KupKop FLOW SAMPLE: fresh cases at the START of the flow, so you can play the whole thing yourself.
-- Pair it with DEMO_FLOW.md (the tap-by-tap script). Run in the Supabase SQL Editor AFTER every
-- migration, including 20261110000000_clinic_status_standby_headsup.sql. Sign in to KupKop once first.
--
-- What it creates (all case IDs start with KK-F, fake locations in Metro Manila, no photos):
--   KK-F01  critical, hit-and-run dog, reported 1 minute ago     the main walkthrough case
--   KK-F02  urgent, fractured cat, reported 6 minutes ago        for "Can't take it now" and rerouting
--   KK-F03  moderate, mangy dog, reported 20 minutes ago         for the 60-minute lock
--   KK-F04  critical, bleeding cat, reported 12 minutes ago      past "no responder": shows in Admin > No responder
--   KK-F05  critical, hit-and-run dog, claimed by ANOTHER account 14 minutes ago
--           (its 15-minute lock ends in about a minute: try "I'm available", then watch it open up).
--           Only created when a second account exists; otherwise skipped.
-- It also makes sure the three Sample clinics exist and are Listed: Marikina Open, Makati Open,
-- Pasig Full (so you can see a full clinic refuse a heads-up).
--
-- One account can play every role if it is an admin (an admin can claim, tell a clinic, admit, confirm
-- intake, answer a heads-up and post updates). To make your account an admin, put your email in the
-- line below and remove the two dashes in front of it. Do not commit your email.
--
-- UPDATE public.profiles SET role = 'admin' WHERE email = 'PUT-YOUR-EMAIL-HERE';
--
-- Run it again any time to start over: it deletes its own KK-F cases first.
--   Remove them: DELETE FROM public.sos_reports WHERE short_id LIKE 'KK-F%';
-- Untested against your database. Two safety triggers are switched off while it inserts (so the ages
-- can be backdated) and back on in the same transaction; if anything fails everything rolls back.
-- ==============================================================================

DO $$
DECLARE
  v_user UUID;
  v_other UUID;
  v_marikina UUID;
  v_makati UUID;
  v_pasig UUID;
BEGIN
  SELECT id INTO v_user FROM public.profiles ORDER BY created_at LIMIT 1;
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Sign in to KupKop once first, so there is a profile to report from.';
  END IF;
  SELECT id INTO v_other FROM public.profiles WHERE id <> v_user ORDER BY created_at LIMIT 1;

  -- The three sample clinics, Listed, with a status each
  INSERT INTO public.facilities (name, address, phone, latitude, longitude, status, last_active_at)
  SELECT v.name, v.address, v.phone, v.latitude, v.longitude, 'Listed', now()
  FROM (
    VALUES
      ('Sample Animal Clinic (Marikina)', 'Marcos Highway, Marikina City',        '0000-100-0001', 14.6330, 121.1020),
      ('Sample Vet Hospital (Makati)',    'Pasong Tamo Extension, Makati City',   '0000-100-0002', 14.5547, 121.0244),
      ('Sample Rescue Shelter (Pasig)',   'Ortigas Avenue Extension, Pasig City', '0000-100-0003', 14.5866, 121.0830)
  ) AS v(name, address, phone, latitude, longitude)
  WHERE NOT EXISTS (SELECT 1 FROM public.facilities f WHERE f.name = v.name);

  SELECT id INTO v_marikina FROM public.facilities WHERE name = 'Sample Animal Clinic (Marikina)';
  SELECT id INTO v_makati   FROM public.facilities WHERE name = 'Sample Vet Hospital (Makati)';
  SELECT id INTO v_pasig    FROM public.facilities WHERE name = 'Sample Rescue Shelter (Pasig)';
  UPDATE public.facilities SET status = 'Listed', paused_reason = NULL, paused_at = NULL, last_active_at = now(),
         availability = 'open', availability_set_at = now() WHERE id IN (v_marikina, v_makati);
  UPDATE public.facilities SET status = 'Listed', paused_reason = NULL, paused_at = NULL, last_active_at = now(),
         availability = 'full', availability_set_at = now() WHERE id = v_pasig;

  -- Backdating ages needs these two triggers off while we insert (they run again afterwards)
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_enforce_sos_server_timestamp' AND tgrelid = 'public.sos_reports'::regclass) THEN
    ALTER TABLE public.sos_reports DISABLE TRIGGER trg_enforce_sos_server_timestamp;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_sanitize_new_sos_report' AND tgrelid = 'public.sos_reports'::regclass) THEN
    ALTER TABLE public.sos_reports DISABLE TRIGGER trg_sanitize_new_sos_report;
  END IF;

  DELETE FROM public.sos_reports WHERE short_id LIKE 'KK-F%';

  -- ---- Four cases waiting for a rescuer ----
  INSERT INTO public.sos_reports (short_id, reporter_id, animal_type, emergency_type, urgency, state, photo_url, latitude, longitude, location_name, description, created_at, updated_at, server_timestamp)
  VALUES
    ('KK-F01', v_user, 'dog', 'hit_and_run', 'critical', 'reported', '', 14.6385, 121.0990, 'Sumulong Highway, Marikina',  'Brown dog lying beside the road after a motorcycle hit it.',  now() - interval '1 minute',   now() - interval '1 minute',   now() - interval '1 minute'),
    ('KK-F02', v_user, 'cat', 'fracture',    'urgent',   'reported', '', 14.5575, 121.0210, 'Chino Roces Ave, Makati',     'Grey cat holding up a front leg, hiding under a tricycle.',    now() - interval '6 minutes',  now() - interval '6 minutes',  now() - interval '6 minutes'),
    ('KK-F03', v_user, 'dog', 'sick_mange',  'moderate', 'reported', '', 14.5870, 121.0845, 'Kapitolyo, Pasig',            'Thin dog with bald, crusty skin near the food stalls.',        now() - interval '20 minutes', now() - interval '20 minutes', now() - interval '20 minutes'),
    ('KK-F04', v_user, 'cat', 'bleeding',    'critical', 'reported', '', 14.6320, 121.1040, 'Marcos Hwy near SM Marikina', 'Cat with a bleeding ear and a cut on its side, very weak.',    now() - interval '12 minutes', now() - interval '12 minutes', now() - interval '12 minutes');

  -- ---- One claimed by someone else, lock about to end (needs a second account) ----
  IF v_other IS NOT NULL THEN
    INSERT INTO public.sos_reports (short_id, reporter_id, animal_type, emergency_type, urgency, state, photo_url, latitude, longitude, location_name, description, claimed_by, claimed_at, created_at, updated_at, server_timestamp)
    VALUES ('KK-F05', v_user, 'dog', 'hit_and_run', 'critical', 'claimed', '', 14.5600, 121.0215, 'EDSA Buendia flyover, Makati', 'Dog dragging its back legs across the lane.', v_other, now() - interval '14 minutes', now() - interval '16 minutes', now() - interval '14 minutes', now() - interval '16 minutes');
  END IF;

  -- Safety triggers back on
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_enforce_sos_server_timestamp' AND tgrelid = 'public.sos_reports'::regclass) THEN
    ALTER TABLE public.sos_reports ENABLE TRIGGER trg_enforce_sos_server_timestamp;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_sanitize_new_sos_report' AND tgrelid = 'public.sos_reports'::regclass) THEN
    ALTER TABLE public.sos_reports ENABLE TRIGGER trg_sanitize_new_sos_report;
  END IF;
END $$;
