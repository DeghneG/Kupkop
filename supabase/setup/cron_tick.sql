-- ==============================================================================
-- KupKop scheduler: calls /api/cron/tick every minute (escalation alerts, 14-day check,
-- "can't accept" alerts, AI photo checks). Run ONCE in the Supabase SQL Editor after the
-- migrations. Not a migration: it holds your site address and secret, so never commit the
-- filled-in version.
--
-- Before running, replace the two placeholders:
--   YOUR_SITE    your Vercel address, e.g. kupkop.vercel.app (no https://, no trailing slash)
--   YOUR_SECRET  the CRON_SECRET value from .env.local (the same value goes in Vercel)
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Re-running replaces the old job instead of adding a second one
SELECT cron.unschedule('kupkop-tick') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'kupkop-tick');

SELECT cron.schedule(
  'kupkop-tick',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://YOUR_SITE/api/cron/tick',
    headers := jsonb_build_object('content-type', 'application/json', 'x-cron-secret', 'YOUR_SECRET'),
    body := '{}'::jsonb,
    timeout_milliseconds := 25000
  );
  $$
);

-- Check it: the last few runs and what the site answered
-- SELECT status_code, content, created FROM net._http_response ORDER BY created DESC LIMIT 5;
-- Stop it:  SELECT cron.unschedule('kupkop-tick');
