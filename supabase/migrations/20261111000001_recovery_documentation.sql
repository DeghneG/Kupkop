-- Recovery updates are documented: an optional photo and structured details (treatment, medication,
-- weight, next check-up) next to the free-text note.
--   * photos live in the public 'recovery-photos' bucket (the animal's story is public, like live-snaps);
--     only staff of the clinic caring for the case can upload, into a folder named after the case id
--   * nothing can be edited or deleted afterwards: there is no UPDATE or DELETE policy
--   * post_recovery_update() gets five optional arguments; old callers keep working

ALTER TABLE public.recovery_updates ADD COLUMN IF NOT EXISTS treatment TEXT;
ALTER TABLE public.recovery_updates ADD COLUMN IF NOT EXISTS medication TEXT;
ALTER TABLE public.recovery_updates ADD COLUMN IF NOT EXISTS weight_kg NUMERIC(5, 2);
ALTER TABLE public.recovery_updates ADD COLUMN IF NOT EXISTS next_checkup_on DATE;

ALTER TABLE public.recovery_updates DROP CONSTRAINT IF EXISTS recovery_updates_details_check;
ALTER TABLE public.recovery_updates ADD CONSTRAINT recovery_updates_details_check CHECK (
  (treatment IS NULL OR char_length(treatment) <= 200)
  AND (medication IS NULL OR char_length(medication) <= 200)
  AND (weight_kg IS NULL OR (weight_kg > 0 AND weight_kg <= 120))
);

-- Photo bucket ---------------------------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('recovery-photos', 'recovery-photos', true, 2097152, ARRAY['image/jpeg', 'image/webp', 'image/png'])
ON CONFLICT (id) DO UPDATE
  SET public = true, file_size_limit = 2097152, allowed_mime_types = ARRAY['image/jpeg', 'image/webp', 'image/png'];

-- True when the signed-in user is staff (or admin) of the clinic caring for the case named by the first
-- folder of the object path. SECURITY DEFINER so the storage policy does not depend on sos_reports RLS.
CREATE OR REPLACE FUNCTION public.can_upload_recovery_photo(p_object_name TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.sos_reports r
    WHERE r.id::text = (storage.foldername(p_object_name))[1]
      AND r.state IN ('admitted', 'healing')
      AND public.is_case_clinic_staff(r.facility_id)
  );
$$;
REVOKE ALL ON FUNCTION public.can_upload_recovery_photo(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_upload_recovery_photo(TEXT) TO authenticated;

DROP POLICY IF EXISTS "Recovery photos are viewable by everyone" ON storage.objects;
CREATE POLICY "Recovery photos are viewable by everyone"
  ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'recovery-photos');

DROP POLICY IF EXISTS "Clinic staff can upload recovery photos" ON storage.objects;
CREATE POLICY "Clinic staff can upload recovery photos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'recovery-photos' AND public.can_upload_recovery_photo(name));

-- Posting an update ------------------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.post_recovery_update(UUID, TEXT, case_state);

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
  IF char_length(COALESCE(v_treatment, '')) > 200 OR char_length(COALESCE(v_medication, '')) > 200
     OR COALESCE(v_treatment, '') ~ '[<>]' OR COALESCE(v_medication, '') ~ '[<>]' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Treatment and medication: up to 200 characters, no < or >');
  END IF;
  IF p_weight_kg IS NOT NULL AND (p_weight_kg <= 0 OR p_weight_kg > 120) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Weight must be between 0 and 120 kg');
  END IF;
  IF p_next_checkup_on IS NOT NULL AND (p_next_checkup_on < current_date OR p_next_checkup_on > current_date + 365) THEN
    RETURN jsonb_build_object('success', false, 'error', 'The next check-up must be within the next year');
  END IF;
  -- A photo must be one uploaded into this case's own folder
  IF v_photo IS NOT NULL AND v_photo !~ ('^' || p_report_id::text || '/[A-Za-z0-9_-]+\.(jpg|jpeg|webp|png)$') THEN
    RETURN jsonb_build_object('success', false, 'error', 'That photo does not belong to this case');
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
