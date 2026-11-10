-- ==============================================================================
-- KupKop permission tests. Run in the Supabase SQL Editor AFTER all migrations.
-- Safe: it creates throwaway users, clinics and reports, then ends with an error on purpose,
-- which rolls everything back. The error message IS the result:
--   "KUPKOP TESTS: 15/15 passed"           -> all good
--   "KUPKOP TESTS: 13/15 passed | FAIL ..." -> the named rules need fixing
-- ==============================================================================
DO $$
DECLARE
  citizen UUID := gen_random_uuid();
  vol1 UUID := gen_random_uuid();
  vol2 UUID := gen_random_uuid();
  vol3 UUID := gen_random_uuid();
  staff_a UUID := gen_random_uuid();
  staff_b UUID := gen_random_uuid();
  admin1 UUID := gen_random_uuid();
  clinic_a UUID;
  clinic_b UUID;
  clinic_paused UUID;
  r1 UUID;
  r2 UUID;
  r3 UUID;
  res JSONB;
  passed INT := 0;
  total INT := 0;
  failures TEXT := '';
  row_state TEXT;
  row_claimer UUID;
BEGIN
  -- ---------- setup (as the SQL editor user, so no app rules apply) ----------
  INSERT INTO auth.users (id, email, aud, role)
  VALUES (citizen, 'qa-citizen@example.test', 'authenticated', 'authenticated'),
         (vol1, 'qa-vol1@example.test', 'authenticated', 'authenticated'),
         (vol2, 'qa-vol2@example.test', 'authenticated', 'authenticated'),
         (vol3, 'qa-vol3@example.test', 'authenticated', 'authenticated'),
         (staff_a, 'qa-staff-a@example.test', 'authenticated', 'authenticated'),
         (staff_b, 'qa-staff-b@example.test', 'authenticated', 'authenticated'),
         (admin1, 'qa-admin@example.test', 'authenticated', 'authenticated');

  INSERT INTO facilities (name, address, phone, latitude, longitude, status)
  VALUES ('QA Clinic A', 'Test', '000', 14.6, 121.0, 'Listed') RETURNING id INTO clinic_a;
  INSERT INTO facilities (name, address, phone, latitude, longitude, status)
  VALUES ('QA Clinic B', 'Test', '000', 14.6, 121.0, 'Listed') RETURNING id INTO clinic_b;
  INSERT INTO facilities (name, address, phone, latitude, longitude, status)
  VALUES ('QA Clinic Paused', 'Test', '000', 14.6, 121.0, 'Paused') RETURNING id INTO clinic_paused;

  UPDATE profiles SET role = 'volunteer' WHERE id IN (vol1, vol2, vol3);
  UPDATE profiles SET role = 'facility', facility_id = clinic_a WHERE id = staff_a;
  UPDATE profiles SET role = 'facility', facility_id = clinic_b WHERE id = staff_b;
  UPDATE profiles SET role = 'admin' WHERE id = admin1;

  INSERT INTO storage.objects (bucket_id, name) VALUES ('live-snaps', citizen || '/qa1.webp'), ('live-snaps', citizen || '/qa2.webp');

  -- ---------- 1. role and email are admin-only ----------
  PERFORM set_config('request.jwt.claims', json_build_object('sub', citizen, 'role', 'authenticated')::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  total := total + 1;
  BEGIN
    UPDATE profiles SET role = 'admin' WHERE id = citizen;
    failures := failures || ' | FAIL citizen changed own role';
  EXCEPTION WHEN others THEN passed := passed + 1;
  END;
  total := total + 1;
  BEGIN
    UPDATE profiles SET email = 'spoof@example.test' WHERE id = citizen;
    failures := failures || ' | FAIL citizen changed own email';
  EXCEPTION WHEN others THEN passed := passed + 1;
  END;

  -- ---------- 2. new reports: server decides state; photo must be a real upload ----------
  INSERT INTO sos_reports (short_id, reporter_id, animal_type, emergency_type, urgency, state, claimed_by, photo_url, latitude, longitude)
  VALUES ('QA-0001', citizen, 'dog', 'hit_and_run', 'moderate', 'resolved', vol1,
          'https://qa.supabase.co/storage/v1/object/public/live-snaps/' || citizen || '/qa1.webp', 14.6, 121.0)
  RETURNING id INTO r1;
  EXECUTE 'RESET ROLE';
  SELECT state, claimed_by INTO row_state, row_claimer FROM sos_reports WHERE id = r1;
  total := total + 1;
  IF row_state = 'reported' AND row_claimer IS NULL AND (SELECT urgency FROM sos_reports WHERE id = r1) = 'critical' THEN
    passed := passed + 1;
  ELSE failures := failures || ' | FAIL new report kept client state/claim/urgency';
  END IF;

  EXECUTE 'SET LOCAL ROLE authenticated';
  total := total + 1;
  BEGIN
    INSERT INTO sos_reports (short_id, reporter_id, animal_type, emergency_type, urgency, photo_url, latitude, longitude)
    VALUES ('QA-0002', citizen, 'dog', 'fracture', 'urgent', 'https://example.com/gallery.jpg', 14.6, 121.0);
    failures := failures || ' | FAIL report accepted a non-upload photo';
  EXCEPTION WHEN others THEN passed := passed + 1;
  END;
  INSERT INTO sos_reports (short_id, reporter_id, animal_type, emergency_type, urgency, photo_url, latitude, longitude)
  VALUES ('QA-0003', citizen, 'cat', 'fracture', 'urgent',
          'https://qa.supabase.co/storage/v1/object/public/live-snaps/' || citizen || '/qa2.webp', 14.6, 121.0)
  RETURNING id INTO r2;

  -- ---------- 3. claims ----------
  res := claim_sos_report(r1);
  total := total + 1;
  IF NOT (res ->> 'success')::boolean THEN passed := passed + 1; ELSE failures := failures || ' | FAIL citizen claimed'; END IF;

  PERFORM set_config('request.jwt.claims', json_build_object('sub', vol1, 'role', 'authenticated')::text, true);
  res := claim_sos_report(r1);
  total := total + 1;
  IF (res ->> 'success')::boolean THEN passed := passed + 1; ELSE failures := failures || ' | FAIL volunteer could not claim: ' || (res ->> 'error'); END IF;

  res := claim_sos_report(r2);
  total := total + 1;
  IF NOT (res ->> 'success')::boolean THEN passed := passed + 1; ELSE failures := failures || ' | FAIL volunteer held two active claims'; END IF;

  PERFORM set_config('request.jwt.claims', json_build_object('sub', vol2, 'role', 'authenticated')::text, true);
  res := claim_sos_report(r1);
  total := total + 1;
  IF NOT (res ->> 'success')::boolean THEN passed := passed + 1; ELSE failures := failures || ' | FAIL second volunteer broke the claim lock'; END IF;

  -- ---------- 4. admit, intake, can't accept ----------
  PERFORM set_config('request.jwt.claims', json_build_object('sub', vol1, 'role', 'authenticated')::text, true);
  res := admit_to_facility(r1, clinic_paused, NULL);
  total := total + 1;
  IF NOT (res ->> 'success')::boolean THEN passed := passed + 1; ELSE failures := failures || ' | FAIL admitted to a paused clinic'; END IF;

  res := admit_to_facility(r1, clinic_a, NULL);
  total := total + 1;
  IF (res ->> 'success')::boolean THEN passed := passed + 1; ELSE failures := failures || ' | FAIL could not admit: ' || (res ->> 'error'); END IF;

  PERFORM set_config('request.jwt.claims', json_build_object('sub', staff_b, 'role', 'authenticated')::text, true);
  res := post_recovery_update(r1, 'Looks stable today', 'healing');
  total := total + 1;
  IF NOT (res ->> 'success')::boolean THEN passed := passed + 1; ELSE failures := failures || ' | FAIL another clinic posted an update'; END IF;

  PERFORM set_config('request.jwt.claims', json_build_object('sub', staff_a, 'role', 'authenticated')::text, true);
  res := decline_admission(r1, 'No space in the ward');
  total := total + 1;
  IF (res ->> 'success')::boolean AND (SELECT state FROM sos_reports WHERE id = r1) = 'claimed' THEN passed := passed + 1;
  ELSE failures := failures || ' | FAIL can''t accept did not return the case: ' || COALESCE(res ->> 'error', '');
  END IF;

  PERFORM set_config('request.jwt.claims', json_build_object('sub', vol1, 'role', 'authenticated')::text, true);
  PERFORM admit_to_facility(r1, clinic_a, NULL);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', staff_a, 'role', 'authenticated')::text, true);
  res := confirm_intake(r1);
  total := total + 1;
  IF (res ->> 'success')::boolean THEN passed := passed + 1; ELSE failures := failures || ' | FAIL intake not confirmed: ' || (res ->> 'error'); END IF;

  -- ---------- 5. only admins change roles ----------
  PERFORM set_config('request.jwt.claims', json_build_object('sub', citizen, 'role', 'authenticated')::text, true);
  res := admin_set_role(vol1, 'citizen', NULL);
  total := total + 1;
  IF NOT (res ->> 'success')::boolean THEN passed := passed + 1; ELSE failures := failures || ' | FAIL citizen changed someone''s role'; END IF;

  -- ---------- 6. D-042: clinic status, lock by severity, standby, heads-up, admin actions ----------
  EXECUTE 'RESET ROLE';
  INSERT INTO storage.objects (bucket_id, name) VALUES ('live-snaps', citizen || '/qa5.webp');
  INSERT INTO sos_reports (short_id, reporter_id, animal_type, emergency_type, urgency, photo_url, latitude, longitude)
  VALUES ('QA-0005', citizen, 'dog', 'hit_and_run', 'critical',
          'https://qa.supabase.co/storage/v1/object/public/live-snaps/' || citizen || '/qa5.webp', 14.6, 121.0)
  RETURNING id INTO r3;

  -- 6a. only a clinic's own staff set its status
  PERFORM set_config('request.jwt.claims', json_build_object('sub', staff_b, 'role', 'authenticated')::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  res := set_clinic_availability(clinic_a, 'full');
  total := total + 1;
  IF NOT (res ->> 'success')::boolean THEN passed := passed + 1; ELSE failures := failures || ' | FAIL another clinic changed this clinic''s status'; END IF;

  PERFORM set_config('request.jwt.claims', json_build_object('sub', staff_a, 'role', 'authenticated')::text, true);
  res := set_clinic_availability(clinic_a, 'full');
  total := total + 1;
  IF (res ->> 'success')::boolean THEN passed := passed + 1; ELSE failures := failures || ' | FAIL clinic staff could not set their own status: ' || COALESCE(res ->> 'error', ''); END IF;

  -- 6b. the claim lock follows severity (critical = 15 minutes)
  PERFORM set_config('request.jwt.claims', json_build_object('sub', vol1, 'role', 'authenticated')::text, true);
  res := claim_sos_report(r3);
  total := total + 1;
  IF (res ->> 'success')::boolean AND (res ->> 'lock_duration_minutes')::int = 15 THEN passed := passed + 1;
  ELSE failures := failures || ' | FAIL critical claim did not lock for 15 minutes: ' || COALESCE(res ->> 'error', res ->> 'lock_duration_minutes', '');
  END IF;

  -- 6c. standby: volunteers only, never the claimer
  PERFORM set_config('request.jwt.claims', json_build_object('sub', citizen, 'role', 'authenticated')::text, true);
  res := join_standby(r3);
  total := total + 1;
  IF NOT (res ->> 'success')::boolean THEN passed := passed + 1; ELSE failures := failures || ' | FAIL citizen joined standby'; END IF;

  PERFORM set_config('request.jwt.claims', json_build_object('sub', vol1, 'role', 'authenticated')::text, true);
  res := join_standby(r3);
  total := total + 1;
  IF NOT (res ->> 'success')::boolean THEN passed := passed + 1; ELSE failures := failures || ' | FAIL claimer joined standby on their own case'; END IF;

  PERFORM set_config('request.jwt.claims', json_build_object('sub', vol2, 'role', 'authenticated')::text, true);
  res := join_standby(r3);
  total := total + 1;
  IF (res ->> 'success')::boolean THEN passed := passed + 1; ELSE failures := failures || ' | FAIL volunteer could not join standby: ' || COALESCE(res ->> 'error', ''); END IF;

  -- 6d. heads-up: refused for a clinic that reported full; accepted otherwise; only that clinic answers
  PERFORM set_config('request.jwt.claims', json_build_object('sub', vol1, 'role', 'authenticated')::text, true);
  res := send_clinic_heads_up(r3, clinic_a, 10);
  total := total + 1;
  IF NOT (res ->> 'success')::boolean THEN passed := passed + 1; ELSE failures := failures || ' | FAIL heads-up went to a clinic that is full'; END IF;

  res := send_clinic_heads_up(r3, clinic_b, 10);
  total := total + 1;
  IF (res ->> 'success')::boolean THEN passed := passed + 1; ELSE failures := failures || ' | FAIL heads-up to an open clinic failed: ' || COALESCE(res ->> 'error', ''); END IF;

  PERFORM set_config('request.jwt.claims', json_build_object('sub', staff_a, 'role', 'authenticated')::text, true);
  res := respond_to_heads_up(r3, 'expecting', NULL);
  total := total + 1;
  IF NOT (res ->> 'success')::boolean THEN passed := passed + 1; ELSE failures := failures || ' | FAIL the wrong clinic answered a heads-up'; END IF;

  PERFORM set_config('request.jwt.claims', json_build_object('sub', staff_b, 'role', 'authenticated')::text, true);
  res := respond_to_heads_up(r3, 'expecting', NULL);
  total := total + 1;
  IF (res ->> 'success')::boolean THEN passed := passed + 1; ELSE failures := failures || ' | FAIL the told clinic could not answer: ' || COALESCE(res ->> 'error', ''); END IF;

  -- 6e. check-in restarts the lock, once per step
  PERFORM set_config('request.jwt.claims', json_build_object('sub', vol1, 'role', 'authenticated')::text, true);
  res := claim_checkin(r3, 'on_my_way');
  total := total + 1;
  IF (res ->> 'success')::boolean THEN passed := passed + 1; ELSE failures := failures || ' | FAIL check-in failed: ' || COALESCE(res ->> 'error', ''); END IF;
  res := claim_checkin(r3, 'on_my_way');
  total := total + 1;
  IF NOT (res ->> 'success')::boolean THEN passed := passed + 1; ELSE failures := failures || ' | FAIL the same check-in extended the lock twice'; END IF;

  -- 6f. after the lock ends the first volunteer on standby has a 2 minute head start
  EXECUTE 'RESET ROLE';
  UPDATE sos_reports SET claimed_at = clock_timestamp() - INTERVAL '16 minutes' WHERE id = r3;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', vol3, 'role', 'authenticated')::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  res := claim_sos_report(r3);
  total := total + 1;
  IF NOT (res ->> 'success')::boolean THEN passed := passed + 1; ELSE failures := failures || ' | FAIL a stranger claimed ahead of the first volunteer on standby'; END IF;

  PERFORM set_config('request.jwt.claims', json_build_object('sub', vol2, 'role', 'authenticated')::text, true);
  res := claim_sos_report(r3);
  total := total + 1;
  IF (res ->> 'success')::boolean THEN passed := passed + 1; ELSE failures := failures || ' | FAIL the first volunteer on standby could not claim: ' || COALESCE(res ->> 'error', ''); END IF;

  EXECUTE 'RESET ROLE';
  total := total + 1;
  IF NOT EXISTS (SELECT 1 FROM claim_standby WHERE volunteer_id = vol2) THEN passed := passed + 1;
  ELSE failures := failures || ' | FAIL a volunteer who took a case stayed on standby';
  END IF;

  -- 6g. names and admin actions
  PERFORM set_config('request.jwt.claims', json_build_object('sub', vol3, 'role', 'authenticated')::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  res := set_animal_name(r3, 'Rex');
  total := total + 1;
  IF NOT (res ->> 'success')::boolean THEN passed := passed + 1; ELSE failures := failures || ' | FAIL a bystander named the animal'; END IF;

  PERFORM set_config('request.jwt.claims', json_build_object('sub', vol2, 'role', 'authenticated')::text, true);
  res := set_animal_name(r3, 'Bob');
  total := total + 1;
  IF (res ->> 'success')::boolean THEN passed := passed + 1; ELSE failures := failures || ' | FAIL the rescuer could not name the animal: ' || COALESCE(res ->> 'error', ''); END IF;

  PERFORM set_config('request.jwt.claims', json_build_object('sub', vol2, 'role', 'authenticated')::text, true);
  res := admin_hide_report(r3);
  total := total + 1;
  IF NOT (res ->> 'success')::boolean THEN passed := passed + 1; ELSE failures := failures || ' | FAIL a volunteer hid a report'; END IF;

  PERFORM set_config('request.jwt.claims', json_build_object('sub', vol3, 'role', 'authenticated')::text, true);
  res := admin_assign_claim(r3, vol3);
  total := total + 1;
  IF NOT (res ->> 'success')::boolean THEN passed := passed + 1; ELSE failures := failures || ' | FAIL a volunteer assigned a case'; END IF;

  PERFORM set_config('request.jwt.claims', json_build_object('sub', admin1, 'role', 'authenticated')::text, true);
  res := admin_assign_claim(r3, vol3);
  total := total + 1;
  IF (res ->> 'success')::boolean THEN passed := passed + 1; ELSE failures := failures || ' | FAIL an admin could not assign a volunteer: ' || COALESCE(res ->> 'error', ''); END IF;

  EXECUTE 'RESET ROLE';
  RAISE EXCEPTION 'KUPKOP TESTS: %/% passed%  (rolled back, nothing was saved)', passed, total, failures;
END $$;
