-- A recovery update must be documented: a photo, what treatment was given, what medication (write "None" if none) and the weight.
-- The next check-up stays optional. This replaces the version from 20261111000001, where all of it was optional.
--   * the photo must already be in the recovery-photos bucket, inside this case's own folder (the app only offers the camera, no gallery;
--     the server cannot prove a picture is live, but it can refuse an update whose photo was never uploaded)

CREATE OR REPLACE FUNCTION public.post_recovery_update(
  p_report_id UUID,
  p_notes TEXT,
  p_state case_state,
  p_photo_path TEXT DEFAULT NULL,
  p_treatment TEXT DEFAULT NULL,
  p_medication TEXT DEFAULT NULL,
  p_weight_kg NUMERIC DEFAULT NULL,
  p_next_checkup_on DATE DEFAULT NULL
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
  v_treatment TEXT := NULLIF(btrim(COALESCE(p_treatment, '')), '');
  v_medication TEXT := NULLIF(btrim(COALESCE(p_medication, '')), '');
  v_photo TEXT := NULLIF(btrim(COALESCE(p_photo_path, '')), '');
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

  -- Documentation is required
  IF v_photo IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Take a photo of the animal with the camera. Photos from the gallery are not accepted.');
  END IF;
  IF v_treatment IS NULL OR char_length(v_treatment) < 2 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Say what treatment was given.');
  END IF;
  IF v_medication IS NULL OR char_length(v_medication) < 2 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Write the medication, or "None" if there was none.');
  END IF;
  IF p_weight_kg IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Enter the animal''s weight in kg.');
  END IF;

  IF char_length(v_treatment) > 200 OR char_length(v_medication) > 200 OR v_treatment ~ '[<>]' OR v_medication ~ '[<>]' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Treatment and medication: up to 200 characters, no < or >');
  END IF;
  IF p_weight_kg <= 0 OR p_weight_kg > 120 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Weight must be between 0 and 120 kg');
  END IF;
  IF p_next_checkup_on IS NOT NULL AND (p_next_checkup_on < current_date OR p_next_checkup_on > current_date + 365) THEN
    RETURN jsonb_build_object('success', false, 'error', 'The next check-up must be within the next year');
  END IF;

  -- The photo must be in this case's own folder and really uploaded
  IF v_photo !~ ('^' || p_report_id::text || '/[A-Za-z0-9_-]+\.(jpg|jpeg|webp|png)$')
     OR NOT EXISTS (SELECT 1 FROM storage.objects o WHERE o.bucket_id = 'recovery-photos' AND o.name = v_photo) THEN
    RETURN jsonb_build_object('success', false, 'error', 'That photo was not uploaded for this case. Take it again.');
  END IF;

  INSERT INTO public.recovery_updates
    (report_id, author_id, notes, state, created_at, photo_url, treatment, medication, weight_kg, next_checkup_on)
  VALUES
    (p_report_id, v_uid, v_notes, p_state, v_now, v_photo, v_treatment, v_medication, p_weight_kg, p_next_checkup_on);

  UPDATE public.sos_reports
  SET state = p_state, intake_confirmed_at = COALESCE(intake_confirmed_at, v_now), updated_at = v_now
  WHERE id = p_report_id;
  UPDATE public.facilities SET last_active_at = v_now WHERE id = v_report.facility_id;

  RETURN jsonb_build_object('success', true, 'report_id', p_report_id, 'state', p_state, 'posted_at', v_now);
END;
$$;
REVOKE ALL ON FUNCTION public.post_recovery_update(UUID, TEXT, case_state, TEXT, TEXT, TEXT, NUMERIC, DATE) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.post_recovery_update(UUID, TEXT, case_state, TEXT, TEXT, TEXT, NUMERIC, DATE) TO authenticated;
