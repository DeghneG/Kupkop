-- ==============================================================================
-- KupKop: Volunteer / Facility role applications (admin-approved)
-- Users apply; only an admin can approve or reject. Users never write profiles.role.
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.role_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  requested_role user_role NOT NULL CHECK (requested_role IN ('volunteer', 'facility')),
  note TEXT NOT NULL CHECK (char_length(note) BETWEEN 10 AND 500),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL
);

-- One open application per user
CREATE UNIQUE INDEX IF NOT EXISTS role_applications_one_pending_per_user
  ON public.role_applications (user_id) WHERE status = 'pending';

ALTER TABLE public.role_applications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own applications, admins read all" ON public.role_applications;
CREATE POLICY "Users read own applications, admins read all"
  ON public.role_applications FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = user_id OR public.is_admin());

DROP POLICY IF EXISTS "Users submit own pending application" ON public.role_applications;
CREATE POLICY "Users submit own pending application"
  ON public.role_applications FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT auth.uid()) = user_id
    AND status = 'pending'
    AND reviewed_at IS NULL
    AND reviewed_by IS NULL
    -- only citizens apply
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (SELECT auth.uid()) AND p.role = 'citizen'
    )
  );

-- No UPDATE / DELETE policies: review happens only through review_role_application().

CREATE OR REPLACE FUNCTION public.review_role_application(
  p_application_id UUID,
  p_approve BOOLEAN
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_app RECORD;
  v_now TIMESTAMPTZ := clock_timestamp();
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Admins only');
  END IF;

  SELECT * INTO v_app FROM public.role_applications WHERE id = p_application_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Application not found');
  END IF;
  IF v_app.status <> 'pending' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Application already reviewed');
  END IF;

  UPDATE public.role_applications
  SET status = CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END,
      reviewed_at = v_now,
      reviewed_by = (SELECT auth.uid())
  WHERE id = p_application_id;

  IF p_approve THEN
    -- Allowed by prevent_role_tampering because the caller is an admin
    UPDATE public.profiles
    SET role = v_app.requested_role, updated_at = v_now
    WHERE id = v_app.user_id;
  END IF;

  RETURN jsonb_build_object('success', true, 'approved', p_approve);
END;
$$;

REVOKE ALL ON FUNCTION public.review_role_application(UUID, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.review_role_application(UUID, BOOLEAN) TO authenticated;
