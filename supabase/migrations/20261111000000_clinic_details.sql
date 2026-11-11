-- Clinic staff can edit their own clinic's public details: address, phone, opening hours, a short note.
-- Name, map position and listing status stay admin-only: the position drives routing and "Listed" is KupKop's call.
ALTER TABLE public.facilities ADD COLUMN IF NOT EXISTS hours TEXT;
ALTER TABLE public.facilities ADD COLUMN IF NOT EXISTS about TEXT;
ALTER TABLE public.facilities DROP CONSTRAINT IF EXISTS facilities_hours_check;
ALTER TABLE public.facilities ADD CONSTRAINT facilities_hours_check CHECK (hours IS NULL OR char_length(hours) <= 200);
ALTER TABLE public.facilities DROP CONSTRAINT IF EXISTS facilities_about_check;
ALTER TABLE public.facilities ADD CONSTRAINT facilities_about_check CHECK (about IS NULL OR char_length(about) <= 500);

CREATE OR REPLACE FUNCTION public.update_clinic_details(
  p_facility_id UUID, p_address TEXT, p_phone TEXT, p_hours TEXT, p_about TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid UUID := (SELECT auth.uid());
  v_address TEXT := btrim(coalesce(p_address, ''));
  v_phone TEXT := btrim(coalesce(p_phone, ''));
  v_hours TEXT := btrim(coalesce(p_hours, ''));
  v_about TEXT := btrim(coalesce(p_about, ''));
BEGIN
  IF v_uid IS NULL OR NOT public.is_case_clinic_staff(p_facility_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only staff of this clinic can edit its details');
  END IF;
  IF char_length(v_address) < 3 OR char_length(v_address) > 200 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Address must be 3 to 200 characters');
  END IF;
  IF char_length(v_phone) > 30 OR v_phone ~ '[<>]' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Phone number is too long');
  END IF;
  IF char_length(v_hours) > 200 OR v_hours ~ '[<>]' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Hours must be up to 200 characters, no < or >');
  END IF;
  IF char_length(v_about) > 500 OR v_about ~ '[<>]' THEN
    RETURN jsonb_build_object('success', false, 'error', 'The note must be up to 500 characters, no < or >');
  END IF;
  UPDATE public.facilities
  SET address = v_address, phone = v_phone, hours = nullif(v_hours, ''), about = nullif(v_about, '')
  WHERE id = p_facility_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Clinic not found');
  END IF;
  RETURN jsonb_build_object('success', true);
END;
$$;
REVOKE ALL ON FUNCTION public.update_clinic_details(UUID, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_clinic_details(UUID, TEXT, TEXT, TEXT, TEXT) TO authenticated;
