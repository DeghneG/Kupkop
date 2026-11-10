# Play the whole KupKop flow yourself

This script walks one animal from "reported" to "resolved". Every case, clinic and name is made up.

## Start (30 seconds, no database, no SQL)

1. Open **Settings** and tap **Turn on demo mode**.
2. Go back to the **Feed**. Sample cases appear in every stage.

That is all. Demo mode runs in your browser only: nothing is read from or written to the database, so it cannot
break anything real. A banner at the top reminds you it is on. **Start over** puts the samples back to the
beginning; **Turn off** returns to the real app.

One person plays every role. Use the grey bar under the banner to switch between **Volunteer**, **Clinic staff**
and **Admin**. Clinic care and Admin are under **Settings**, not on the bottom bar.

## What you get

| Case | What it is | Use it for |
|---|---|---|
| KK-F01 | Critical dog, reported 1 min ago | The main walkthrough |
| KK-F02 | Urgent cat, reported 6 min ago | "Can't take it now" and picking another clinic |
| KK-F03 | Moderate dog, reported 20 min ago | The 60-minute lock |
| KK-F04 | Critical cat, reported 12 min ago | Admin > No responder |
| KK-F06 / F07 / F08 | Three more injured dogs: trapped in a pipe (urgent), a deep cut (critical), a broken leg (urgent) | Extra cases to claim, route and rescue |
| KK-F05 | Critical dog, claimed by another volunteer | Standby (its 15-minute lock ends about a minute after you start) |
| KK-C01 / C02 | Max (healing) and a cat waiting for the clinic | Clinic care |
| KK-C03 | Daisy, resolved 10 hours ago | A finished story |

Clinics: **Marikina** is Open, **Makati** is Open, **Pasig** is Full.

## The flow

**1. Find a case (Volunteer).** On the **Feed**, open cases are at the top. The oldest one leads in a large card.

**2. Claim.** Tap **Claim**. A sheet asks "Claim case #…?". The confirm button stays off for a moment, then turns
on. Confirm. The **active case bar** appears with a **15 minute** lock (critical). A fractured case locks for 30,
a mange case for 60.

**3. On my way.** On the bar tap **On my way**. The lock restarts. Later tap **I've arrived**, which restarts it
once more. Each works only once.

**4. Tell a clinic.** Tap **Tell a clinic I'm coming**. Clinics are listed nearest first, the nearest open one
is marked, and **Pasig** is greyed out as Full. Pick **Marikina**, choose how far away you are, confirm.

**5. The clinic answers (switch to Clinic staff).** Open **Settings**, then **Clinic care**. Under **On their way to
you** the case shows. Tap **Expecting it** and confirm. Switch back to **Volunteer**: the bar now says "Marikina is
expecting you." For the other answer, claim **KK-F02**, tell **Makati**, then as Clinic staff tap **Can't take it
now**. The volunteer sees "Choose another clinic".

**6. Admit (Volunteer).** On the bar tap **Admit**, pick the clinic, **Confirm admission**, confirm again. The
case is **Admitted**.

**7. Confirm arrival (Clinic staff).** In **Clinic care** the case is under **Waiting for intake**. Tap **Animal
arrived** and confirm. The 14-day clock starts.

**8. Care and finish.**
- Tap **Give it a name** ("Bob"), then **Open Bob's page** to see the whole story.
- Tap **Post recovery update**, write a note, keep **Healing**. Post another and choose **Resolved** to finish.
- Resolved cases stay on the Feed for 24 hours, then leave.

**9. Standby (Volunteer).** Open **KK-F05** quickly after starting (or after **Start over**) and tap **I'm available
if the lock ends**. A note with **Undo** appears. When the lock ends, the Claim button for everyone else becomes
**Held** for two minutes while you, first in line, can claim.

**10. Admin: no responder.** Switch to **Admin**, then **Settings > Admin > No responder**. Old open cases are
listed with the nearest clinics that are not full and their phone numbers. Tap **Assign** (you are the demo
volunteer) or **Close as false report**, and confirm.

**11. Clinic status.** As **Clinic staff**, in **Clinic care**, under **Can you take animals right now?** set the
clinic to **Full** and confirm. Back as Volunteer, that clinic is greyed out and cannot be told.

## What to look for

- Every serious button asks first, and the confirm button waits a moment.
- A claim never lets two volunteers hold one case; one active rescue at a time.
- A Full clinic cannot be told someone is coming.
- Each person sees what they need: the rescuer, the clinic, the admin.

## What demo mode does not do

- It does not send notifications or use the camera: **SOS** still goes to the real app.
- Admin tabs other than **No responder** stay a read-only preview.
- The sample data lives in this browser. Clearing site data or **Start over** resets it.

## Using the real database instead

To play the same flow against a real Supabase project, run the migrations, then
`supabase/setup/flow_sample.sql` (it creates the same cases). Make your account an admin using the commented line
in that file, tap **Exit** on the preview bar, and follow the steps above. Notifications need alerts turned on in
Settings and the scheduler set up (`supabase/setup/cron_tick.sql`).
