-- KupKop: Expo push tokens, so volunteers hear about new SOS reports.
-- Each phone registers its token after sign-in. Users manage only their own rows;
-- the server (service role, /api/push/new-report on Vercel) reads them to send.

CREATE TABLE IF NOT EXISTS public.push_tokens (
  token TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('android', 'ios')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS push_tokens_user_id_idx ON public.push_tokens (user_id);

ALTER TABLE public.push_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own push tokens" ON public.push_tokens;
CREATE POLICY "Users read own push tokens"
  ON public.push_tokens FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users add own push tokens" ON public.push_tokens;
CREATE POLICY "Users add own push tokens"
  ON public.push_tokens FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users update own push tokens" ON public.push_tokens;
CREATE POLICY "Users update own push tokens"
  ON public.push_tokens FOR UPDATE
  TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users remove own push tokens" ON public.push_tokens;
CREATE POLICY "Users remove own push tokens"
  ON public.push_tokens FOR DELETE
  TO authenticated
  USING ((SELECT auth.uid()) = user_id);
