# Go-live setup (one time)

Everything in the code is done; these steps switch it on. Do them in order.

## 1. Database (Supabase → SQL Editor)
Run each file's contents, oldest first. Skip any you already ran.

1. `supabase/migrations/20261029000000_seed_test_facilities.sql`
2. `supabase/migrations/20261029000001_push_tokens.sql`
3. `supabase/migrations/20261029000002_facility_care_and_flags.sql`
4. `supabase/migrations/20261029000003_qa_fixes.sql`
5. `supabase/migrations/20261109000000_alerts_intake_handoffs.sql`

Then run `supabase/tests/permissions.sql`. It ends with a red error **on purpose**; read the message:
`KUPKOP TESTS: 15/15 passed` means every permission rule works. Anything else names the rule that failed.

## 2. Vercel environment variables (Settings → Environment Variables)
Copy the values from your local `.env.local` (never paste them in chat or screenshots):

| Name | What it is |
| --- | --- |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Public key for browser alerts |
| `VAPID_PRIVATE_KEY` | Private key for browser alerts |
| `CRON_SECRET` | Password the scheduler sends to `/api/cron/tick` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API → `service_role` key (server only) |
| `NEXT_PUBLIC_SITE_URL` | Your site, e.g. `https://kupkop.vercel.app` (optional) |

Then **Redeploy** (Deployments → ⋯ → Redeploy), because `NEXT_PUBLIC_` values are fixed at build time.

## 3. Scheduler (Supabase → SQL Editor)
Open `supabase/setup/cron_tick.sql`, copy it into the editor, replace `YOUR_SITE` and `YOUR_SECRET`, and run it. **Don't save the filled-in version in the project.**

Check it after two minutes:
```sql
SELECT status_code, content, created FROM net._http_response ORDER BY created DESC LIMIT 5;
```
`200` with `"pushReady":true` means it works. `401` means the secret doesn't match Vercel's; `503` means a Vercel variable is missing.

## 4. Try it
- **Alerts:** Settings → Alerts → **Turn on alerts**, then **Send me a test alert**. On iPhone, add the site to the Home Screen first (Share → Add to Home Screen) and open it from there.
- **Full flow:** follow `docs/classmate-test-script.md` with two phones.

## 5. Still to do in dashboards
- Turn on Google sign-in (Supabase → Authentication → Providers → Google).
- Rotate the Gemini key (it was shared in a chat once) and set a spend cap in Google Cloud.
