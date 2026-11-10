# Play the whole KupKop flow yourself

This script walks one animal from "reported" to "resolved". It uses real database actions, so it needs
the sample data below. Every case is made up. Time-based steps (locks, alerts) run on real clocks.

## Set up (once, about 5 minutes)

1. In Supabase, run the migrations in order, ending with `20261110000000_clinic_status_standby_headsup.sql`.
2. Sign in to KupKop once (the dev test login is fine), so your account has a profile.
3. Open `supabase/setup/flow_sample.sql`. Put your email in the commented `UPDATE ... SET role = 'admin'` line,
   remove the two dashes in front of it, and run the whole file in the SQL Editor.
   - An **admin** can claim, tell a clinic, admit, confirm intake, answer a heads-up and post updates, so one
     account plays every role. Do not commit your email.
4. In the app, tap **Exit** on the grey "Previewing as" bar. A preview only changes what you see; the real
   role (admin) is what the database checks.
5. Optional: in Settings, turn on alerts so notifications arrive. A second account is needed only for step 9.

Re-run `flow_sample.sql` any time to start over. It rebuilds the `KK-F` cases from scratch.

## The cases you get

| Case | What it is | Use it for |
|---|---|---|
| KK-F01 | Critical dog, reported 1 min ago | The main walkthrough, steps 2 to 8 |
| KK-F02 | Urgent cat, reported 6 min ago | "Can't take it now" and picking another clinic |
| KK-F03 | Moderate dog, reported 20 min ago | The 60-minute lock |
| KK-F04 | Critical cat, reported 12 min ago | Admin > No responder (step 10) |
| KK-F05 | Critical dog claimed by another account | Standby (step 9, needs a second account) |

Clinics: **Marikina** is Open, **Makati** is Open, **Pasig** is Full.

## The flow

**1. Report (optional, a fresh case of your own).** Tap **SOS**. If there is no camera, the simulated frame
works. Send it. It appears on the Feed as "Reported". Skip this to use the seeded cases.

**2. Find it.** On the **Feed**, KK-F04 leads with "No responder yet". KK-F01 is in the list. Tap a row to see the case.

**3. Claim.** On KK-F01 tap **Claim**. A sheet asks "Claim case #KK-F01?". The confirm button stays off for
a moment, then turns on. Confirm. The **active case bar** appears with a **15 minute** lock (critical).
A fractured case locks for 30, a mange case for 60.

**4. On my way.** On the bar tap **On my way**. The lock restarts. Later tap **I've arrived**, which restarts
it once more. Each works only once.

**5. Tell a clinic.** Tap **Tell a clinic I'm coming**. The list shows clinics nearest first with the nearest
open one marked. **Pasig** is greyed out as Full. Pick **Marikina**, choose how far away you are, confirm.

**6. The clinic answers.** Open **Settings**, then **Clinic care** (as clinic staff or admin). Under **On their way to
you**, KK-F01 shows. Tap **Expecting it** and confirm. Back on the Feed the bar says "Marikina is expecting you."
Try the other answer on KK-F02: claim it, tell **Makati**, then in Care tap **Can't take it now** with a reason.
The rescuer sees "Choose another clinic" and the clinic stops showing it.

**7. Admit.** On KK-F01 tap **Admit**, pick Marikina, **Confirm admission**, confirm again. The case is
**Admitted**. In Clinic care it moves to **Waiting for intake**: tap **Animal arrived** and confirm. The 14-day clock starts.

**8. Care and finish.**
- In Clinic care tap **Give it a name** and call it "Bob". Open **Bob's page** to see the whole story.
- Tap **Post recovery update**, write a note, set **Healing**. Post another with **Resolved** to finish.
- Resolved cases stay on the Feed for 24 hours, then leave. Cases waiting for a rescuer also leave after 24 hours.

**9. Standby (needs a second account).** Sign in as the other account (a volunteer or admin). Open **KK-F05**
and tap **I'm available if the lock ends**. A note with **Undo** appears. When the 15-minute lock ends
(about a minute after you run the script), the first person on standby gets two minutes and a
notification. Everyone else sees the Claim button as **Held**, then it opens to all.

**10. Admin: no responder.** Open **Settings**, then **Admin**, then the **No responder** tab. KK-F04 is listed with the nearest clinics that
are not full and their phone numbers. Choose a volunteer and tap **Assign** (confirm). That volunteer is
notified. Or tap **Close as false report** (confirm) to remove it from the Feed.

**11. Clinic status.** In Clinic care, pick a clinic under **Clinic status (admin)**, then under **Can you take animals right now?** set it to **Full** and
confirm. Open the picker on a new claim: that clinic is greyed out and cannot be told. The status ends after 12 hours.

## What to look for

- Every serious button asks first, and the confirm button waits a moment.
- A claim never lets two volunteers hold one case.
- A Full clinic cannot be told someone is coming.
- Every step is visible to the people who need it: the rescuer, the clinic, the admin.

## Known limits

- Notifications need alerts turned on in Settings and the scheduler set up (`supabase/setup/cron_tick.sql`).
- The SQL scripts have not been run against a database by the builder yet, so tell me about anything that fails.
- "Call" buttons are disabled in test mode.
