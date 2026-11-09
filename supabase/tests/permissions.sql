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
  staff_a UUID := gen_random_uuid();
  staff_b UUID := gen_random_uuid();
  admin1 UUID := gen_random_uuid();
  clinic_a UUID;
  clinic_b UUID;
  clinic_paused UUID;
  r1 UUID;
  r2 UUID;
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
         (staff_a, 'qa-staff-a@example.test', 'authenticated', 'authenticated'),
         (staff_b, 'qa-staff-b@example.test', 'authenticated', 'authenticated'),
         (admin1, 'qa-admin@example.test', 'authenticated', 'authenticated');

  INSERT INTO facilities (name, address, phone, latitude, longitude, status)
  VALUES ('QA Clinic A', 'Test', '000', 14.6, 121.0, 'Listed') RETURNING id INTO clinic_a;
  INSERT INTO facilities (name, address, phone, latitude, longitude, status)
  VALUES ('QA Clinic B', 'Test', '000', 14.6, 121.0, 'Listed') RETURNING id INTO clinic_b;
  INSERT INTO facilities (name, address, phone, latitude, longitude, status)
  VALUES ('QA Clinic Paused', 'Test', '000', 14.6, 121.0, 'Paused') RETURNING id INTO clinic_paused;

  UPDATE profiles SET role = 'volunteer' WHERE id IN (vol1, vol2);
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

  EXECUTE 'RESET ROLE';
  RAISE EXCEPTION 'KUPKOP TESTS: %/% passed%  (rolled back, nothing was saved)', passed, total, failures;
END $$;
