-- ==============================================================================
-- KupKop SAMPLE CLINICS: 3 made-up clinics with data (fake names, fake phone numbers).
-- Run in the Supabase SQL Editor AFTER every migration, including
-- 20261110000000_clinic_status_standby_headsup.sql. You need one profile: sign in once first.
--
-- Each clinic gets a status, a location in Metro Manila, and animals in its care with a recovery history:
--   1. Sample Animal Clinic (Marikina)   Open               2 animals: healing (Max), waiting for intake
--   2. Sample Vet Hospital (Makati)      Emergencies only   1 animal: healing (Misty)
--   3. Sample Rescue Shelter (Pasig)     Full               2 animals: update due soon (Rocky), resolved (Daisy)
--
-- It also adds four cases outside the clinics so every new screen has something to show:
--   KK-C106, KK-C107  waiting past their "no responder" time (Admin > No responder)
--   KK-C108           on the way, clinic told and answered "expecting", with a volunteer on standby
--                     (standby needs a second account; it is skipped when only one exists)
--   KK-C109           a claim that ran out, so it is waiting for a rescuer again
--
-- Run it again any time: it replaces its own cases first (their IDs start with KK-C1).
-- To remove the cases:    DELETE FROM public.sos_reports WHERE short_id LIKE 'KK-C1%';
-- To remove the clinics:  DELETE FROM public.facilities WHERE name LIKE 'Sample %';
-- To let someone work at a clinic: Admin > Users, set the role to Clinic staff and pick the clinic.
--
-- Untested against your database. It switches two safety triggers off for the insert (so ages can be
-- backdated) and back on in the same transaction; if anything fails everything rolls back.
-- ==============================================================================

DO $$
DECLARE
  v_user UUID;
  v_marikina UUID;
  v_makati UUID;
  v_pasig UUID;
  v_other UUID;
  r UUID;
BEGIN
  SELECT id INTO v_user FROM public.profiles ORDER BY created_at LIMIT 1;
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Sign in to KupKop once first, so there is a profile to report from.';
  END IF;

  -- The clinics (added only if their names are missing), then their status
  INSERT INTO public.facilities (name, address, phone, latitude, longitude, status, last_active_at)
  SELECT v.name, v.address, v.phone, v.latitude, v.longitude, 'Listed', now() - v.idle
  FROM (
    VALUES
      ('Sample Animal Clinic (Marikina)', 'Marcos Highway, Marikina City',       '0000-100-0001', 14.6330, 121.1020, interval '1 day'),
      ('Sample Vet Hospital (Makati)',    'Pasong Tamo Extension, Makati City',  '0000-100-0002', 14.5547, 121.0244, interval '6 days'),
      ('Sample Rescue Shelter (Pasig)',   'Ortigas Avenue Extension, Pasig City', '0000-100-0003', 14.5866, 121.0830, interval '9 days')
  ) AS v(name, address, phone, latitude, longitude, idle)
  WHERE NOT EXISTS (SELECT 1 FROM public.facilities f WHERE f.name = v.name);

  SELECT id INTO v_marikina FROM public.facilities WHERE name = 'Sample Animal Clinic (Marikina)';
  SELECT id INTO v_makati   FROM public.facilities WHERE name = 'Sample Vet Hospital (Makati)';
  SELECT id INTO v_pasig    FROM public.facilities WHERE name = 'Sample Rescue Shelter (Pasig)';

  UPDATE public.facilities SET status = 'Listed', paused_reason = NULL, paused_at = NULL,
         availability = 'open',    availability_set_at = now() - interval '30 minutes' WHERE id = v_marikina;
  UPDATE public.facilities SET status = 'Listed', paused_reason = NULL, paused_at = NULL,
         availability = 'limited', availability_set_at = now() - interval '3 hours'    WHERE id = v_makati;
  UPDATE public.facilities SET status = 'Listed', paused_reason = NULL, paused_at = NULL,
         availability = 'full',    availability_set_at = now() - interval '1 hour'     WHERE id = v_pasig;

  -- Backdating ages needs these two triggers off while we insert (they run again afterwards)
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_enforce_sos_server_timestamp' AND tgrelid = 'public.sos_reports'::regclass) THEN
    ALTER TABLE public.sos_reports DISABLE TRIGGER trg_enforce_sos_server_timestamp;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_sanitize_new_sos_report' AND tgrelid = 'public.sos_reports'::regclass) THEN
    ALTER TABLE public.sos_reports DISABLE TRIGGER trg_sanitize_new_sos_report;
  END IF;

  DELETE FROM public.sos_reports WHERE short_id LIKE 'KK-C1%';

  -- ---- Marikina: Max, a dog with a broken leg, healing on day 2 ----
  INSERT INTO public.sos_reports (short_id, reporter_id, animal_type, emergency_type, urgency, state, photo_url, latitude, longitude, location_name, description, claimed_by, claimed_at, facility_id, intake_confirmed_at, created_at, updated_at, server_timestamp)
  VALUES ('KK-C101', v_user, 'dog', 'fracture', 'urgent', 'healing', '', 14.6401, 121.0985, 'Sumulong Highway, Marikina', 'Brown dog dragging a hind leg near the market.', v_user, now() - interval '2 days', v_marikina, now() - interval '2 days' + interval '40 minutes', now() - interval '2 days' - interval '20 minutes', now() - interval '1 day', now() - interval '2 days' - interval '20 minutes')
  RETURNING id INTO r;
  INSERT INTO public.recovery_updates (report_id, author_id, notes, state, created_at) VALUES
    (r, v_user, 'Brought to Sample Animal Clinic (Marikina). Waiting for the clinic to confirm.', 'admitted', now() - interval '2 days'),
    (r, v_user, 'The clinic confirmed the animal arrived.',                                       'admitted', now() - interval '2 days' + interval '40 minutes'),
    (r, v_user, 'X-ray shows a clean break. Cast on, eating and drinking well.',                  'healing',  now() - interval '1 day');

  -- ---- Marikina: a cat just brought in, the clinic has not confirmed yet ----
  INSERT INTO public.sos_reports (short_id, reporter_id, animal_type, emergency_type, urgency, state, photo_url, latitude, longitude, location_name, description, claimed_by, claimed_at, facility_id, intake_confirmed_at, created_at, updated_at, server_timestamp)
  VALUES ('KK-C102', v_user, 'cat', 'sick_mange', 'moderate', 'admitted', '', 14.6288, 121.0950, 'Gil Fernando Ave, Marikina', 'Thin grey cat with bald patches, sneezing.', v_user, now() - interval '35 minutes', v_marikina, NULL, now() - interval '50 minutes', now() - interval '6 minutes', now() - interval '50 minutes')
  RETURNING id INTO r;
  INSERT INTO public.recovery_updates (report_id, author_id, notes, state, created_at)
  VALUES (r, v_user, 'Brought to Sample Animal Clinic (Marikina). Waiting for the clinic to confirm.', 'admitted', now() - interval '6 minutes');

  -- ---- Makati: Misty, a cat with a deep cut, healing on day 5 ----
  INSERT INTO public.sos_reports (short_id, reporter_id, animal_type, emergency_type, urgency, state, photo_url, latitude, longitude, location_name, description, claimed_by, claimed_at, facility_id, intake_confirmed_at, created_at, updated_at, server_timestamp)
  VALUES ('KK-C103', v_user, 'cat', 'bleeding', 'critical', 'healing', '', 14.5571, 121.0198, 'Chino Roces Ave, Makati', 'White cat with a cut along the side, hiding under a stall.', v_user, now() - interval '5 days', v_makati, now() - interval '5 days' + interval '30 minutes', now() - interval '5 days' - interval '15 minutes', now() - interval '2 days', now() - interval '5 days' - interval '15 minutes')
  RETURNING id INTO r;
  INSERT INTO public.recovery_updates (report_id, author_id, notes, state, created_at) VALUES
    (r, v_user, 'Brought to Sample Vet Hospital (Makati). Waiting for the clinic to confirm.', 'admitted', now() - interval '5 days'),
    (r, v_user, 'The clinic confirmed the animal arrived.',                                     'admitted', now() - interval '5 days' + interval '30 minutes'),
    (r, v_user, 'Wound cleaned and stitched. Weak but stable, on fluids.',                      'admitted', now() - interval '4 days'),
    (r, v_user, 'Stitches holding, walking and eating. Staying for observation.',               'healing',  now() - interval '2 days');

  -- ---- Pasig: Rocky, a dog hit by a motorcycle, last update 12 days ago (update due in 2 days) ----
  INSERT INTO public.sos_reports (short_id, reporter_id, animal_type, emergency_type, urgency, state, photo_url, latitude, longitude, location_name, description, claimed_by, claimed_at, facility_id, intake_confirmed_at, created_at, updated_at, server_timestamp)
  VALUES ('KK-C104', v_user, 'dog', 'hit_and_run', 'critical', 'healing', '', 14.5902, 121.0791, 'Ortigas Ave near Rosario, Pasig', 'Dog hit by a motorcycle, could not stand.', v_user, now() - interval '16 days', v_pasig, now() - interval '16 days' + interval '1 hour', now() - interval '16 days' - interval '10 minutes', now() - interval '12 days', now() - interval '16 days' - interval '10 minutes')
  RETURNING id INTO r;
  INSERT INTO public.recovery_updates (report_id, author_id, notes, state, created_at) VALUES
    (r, v_user, 'Brought to Sample Rescue Shelter (Pasig). Waiting for the clinic to confirm.', 'admitted', now() - interval '16 days'),
    (r, v_user, 'The clinic confirmed the animal arrived.',                                      'admitted', now() - interval '16 days' + interval '1 hour'),
    (r, v_user, 'Surgery on the front leg went well. Walking with support.',                     'healing',  now() - interval '12 days');

  -- ---- Pasig: Daisy, resolved 10 hours ago ----
  INSERT INTO public.sos_reports (short_id, reporter_id, animal_type, emergency_type, urgency, state, photo_url, latitude, longitude, location_name, description, claimed_by, claimed_at, facility_id, intake_confirmed_at, created_at, updated_at, server_timestamp)
  VALUES ('KK-C105', v_user, 'dog', 'trapped_abused', 'urgent', 'resolved', '', 14.5840, 121.0870, 'Shaw Blvd near Kapitolyo, Pasig', 'Puppy tied up behind a shop with a rope cutting into its neck.', v_user, now() - interval '9 days', v_pasig, now() - interval '9 days' + interval '45 minutes', now() - interval '9 days' - interval '5 minutes', now() - interval '10 hours', now() - interval '9 days' - interval '5 minutes')
  RETURNING id INTO r;
  INSERT INTO public.recovery_updates (report_id, author_id, notes, state, created_at) VALUES
    (r, v_user, 'Brought to Sample Rescue Shelter (Pasig). Waiting for the clinic to confirm.', 'admitted', now() - interval '9 days'),
    (r, v_user, 'The clinic confirmed the animal arrived.',                                      'admitted', now() - interval '9 days' + interval '45 minutes'),
    (r, v_user, 'Neck wound treated, vaccinated, gaining weight.',                               'healing',  now() - interval '6 days'),
    (r, v_user, 'Healthy and friendly. Adopted by a family nearby.',                             'resolved', now() - interval '10 hours');

  -- ---- Waiting for a rescuer: both have passed their "no responder" time, so they show in Admin > No responder ----
  INSERT INTO public.sos_reports (short_id, reporter_id, animal_type, emergency_type, urgency, state, photo_url, latitude, longitude, location_name, description, created_at, updated_at, server_timestamp)
  VALUES
    ('KK-C106', v_user, 'dog', 'bleeding',  'critical', 'reported', '', 14.6355, 121.1010, 'Marcos Hwy near SM Marikina', 'Dog with a bleeding paw, limping along the highway shoulder.', now() - interval '14 minutes', now() - interval '14 minutes', now() - interval '14 minutes'),
    ('KK-C107', v_user, 'cat', 'fracture',  'urgent',   'reported', '', 14.5560, 121.0230, 'Pasong Tamo near Buendia',     'Cat that cannot put weight on a front leg, under a parked car.', now() - interval '40 minutes', now() - interval '40 minutes', now() - interval '40 minutes');

  -- ---- On the way: claimed 8 minutes ago, has told Sample Vet Hospital (Makati), which answered "expecting" ----
  INSERT INTO public.sos_reports (short_id, reporter_id, animal_type, emergency_type, urgency, state, photo_url, latitude, longitude, location_name, description, claimed_by, claimed_at, created_at, updated_at, server_timestamp)
  VALUES ('KK-C108', v_user, 'dog', 'hit_and_run', 'critical', 'claimed', '', 14.5600, 121.0215, 'EDSA Buendia flyover, Makati', 'Dog hit by a jeepney, conscious but cannot stand.', v_user, now() - interval '8 minutes', now() - interval '12 minutes', now() - interval '2 minutes', now() - interval '12 minutes');
  UPDATE public.sos_reports
  SET checkin_kind = 'on_my_way', checkin_at = now() - interval '8 minutes',
      heads_up_facility_id = v_makati, heads_up_eta_minutes = 12, heads_up_at = now() - interval '5 minutes',
      heads_up_response = 'expecting', heads_up_response_at = now() - interval '2 minutes'
  WHERE short_id = 'KK-C108';

  -- Someone else on standby for it, when there is a second account (standby needs a different person)
  SELECT id INTO v_other FROM public.profiles WHERE id <> v_user ORDER BY created_at LIMIT 1;
  IF v_other IS NOT NULL THEN
    INSERT INTO public.claim_standby (report_id, volunteer_id, created_at)
    SELECT id, v_other, now() - interval '4 minutes' FROM public.sos_reports WHERE short_id = 'KK-C108';
  END IF;

  -- ---- A claim that ran out: claimed 70 minutes ago (moderate lock is 60), so it is waiting again ----
  INSERT INTO public.sos_reports (short_id, reporter_id, animal_type, emergency_type, urgency, state, photo_url, latitude, longitude, location_name, description, claimed_by, claimed_at, created_at, updated_at, server_timestamp)
  VALUES ('KK-C109', v_user, 'cat', 'sick_mange', 'moderate', 'claimed', '', 14.5880, 121.0850, 'Kapitolyo, Pasig', 'Kitten with crusty eyes and a swollen belly, sleeping by a gate.', v_user, now() - interval '70 minutes', now() - interval '80 minutes', now() - interval '70 minutes', now() - interval '80 minutes');

  -- Names
  UPDATE public.sos_reports SET animal_name = 'Max'   WHERE short_id = 'KK-C101';
  UPDATE public.sos_reports SET animal_name = 'Misty' WHERE short_id = 'KK-C103';
  UPDATE public.sos_reports SET animal_name = 'Rocky' WHERE short_id = 'KK-C104';
  UPDATE public.sos_reports SET animal_name = 'Daisy' WHERE short_id = 'KK-C105';

  -- Safety triggers back on
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_enforce_sos_server_timestamp' AND tgrelid = 'public.sos_reports'::regclass) THEN
    ALTER TABLE public.sos_reports ENABLE TRIGGER trg_enforce_sos_server_timestamp;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_sanitize_new_sos_report' AND tgrelid = 'public.sos_reports'::regclass) THEN
    ALTER TABLE public.sos_reports ENABLE TRIGGER trg_sanitize_new_sos_report;
  END IF;
END $$;
