-- ==============================================================================
-- KupKop Tier 1 Security Hardening Migration
-- 1. Tamper-proof server timestamp trigger on sos_reports
-- 2. Database-level trigger preventing role escalation on profiles
-- 3. Mask email & phone from public scraping via RLS & public_profiles view
-- ==============================================================================

-- 1. Tamper-Proof Server Timestamp Trigger
-- Guarantees that even if a client sends a fake server_timestamp or created_at,
-- PostgreSQL forcibly overwrites it with the true atomic clock time.
CREATE OR REPLACE FUNCTION public.enforce_sos_server_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.server_timestamp = clock_timestamp();
  NEW.created_at = clock_timestamp();
  NEW.updated_at = clock_timestamp();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_sos_server_timestamp ON public.sos_reports;
CREATE TRIGGER trg_enforce_sos_server_timestamp
  BEFORE INSERT ON public.sos_reports
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_sos_server_timestamp();

-- 2. Hard Role-Tampering Protection Trigger
-- Extra database layer defense: Even if an RLS policy were misconfigured in the future,
-- this trigger aborts any transaction attempting to modify `role` without admin rights.
CREATE OR REPLACE FUNCTION public.prevent_role_tampering()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (NEW.role IS DISTINCT FROM OLD.role) AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Role modification denied: Users cannot alter their own role.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_role_tampering ON public.profiles;
CREATE TRIGGER trg_prevent_role_tampering
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_role_tampering();

-- 3. Profile Privacy Hardening
-- Prevents public/anonymous scraping of citizen emails and phone numbers.
-- Users can only read their own full profile; Admins can read all.
DROP POLICY IF EXISTS "Profiles are viewable by authenticated users" ON public.profiles;
DROP POLICY IF EXISTS "Profiles basic viewable by anon" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own full profile or admin" ON public.profiles;

CREATE POLICY "Users can view own full profile or admin"
  ON public.profiles FOR SELECT
  TO anon, authenticated
  USING (
    (SELECT auth.uid()) = id
    OR public.is_admin()
  );

-- Create a secure public view that only exposes safe non-sensitive identity info
-- (id, full_name, role, is_verified, created_at) with NO email or phone.
CREATE OR REPLACE VIEW public.public_profiles AS
  SELECT 
    id, 
    full_name, 
    role, 
    is_verified, 
    created_at
  FROM public.profiles;

GRANT SELECT ON public.public_profiles TO anon, authenticated;
