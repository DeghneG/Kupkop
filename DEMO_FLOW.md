# Play the whole KupKop flow yourself

This script walks one animal from "reported" to "resolved". Every clinic and name is made up, and the demo starts with
**no cases**: you file the first one yourself.

## Start (30 seconds, no database, no SQL)

1. Open **Settings** and tap **Open the three-screen demo** (or **Turn on demo mode** to play one role at a time).
2. The Feed is empty: "Nothing needs a rescuer right now". The three clinics are there.

Demo mode runs in your browser only: nothing is read from or written to the database, so it cannot break anything real. **Start over**
clears every case and keeps the clinics; **Turn off** returns to the real app.

In single-screen mode one person plays every role: use the grey bar under the banner to switch between **Volunteer**,
**Clinic staff** and **Admin**. Clinic care and Admin are under **Settings**, not on the bottom bar.

## Three screens at once (no role switching)

Open **Settings > Open the three-screen demo** (or go to `/demo`). You get the Citizen, the Volunteer and the Clinic staff
side by side. Each screen is locked to its role and they share the same demo data, so an action in one shows up in the others.

1. **Citizen:** choose the animal and emergency, tap the shutter, then Send. The camera and location are faked in the demo.
2. **Volunteer:** the new case is at the top of the Feed. Claim it, tap On my way, tell a clinic, then Admit.
3. **Clinic staff:** answer the heads-up, tap Animal arrived, post a recovery update (with a photo and details if you like).
4. **Citizen:** a live tracker appears when the volunteer taps On my way: an arrival time, the distance, and a small map where the volunteer's marker moves toward the animal (sample data: about three minutes). **Volunteer details** shows their name and record. Tap Follow this case to watch every step appear.

On a narrow window one screen shows at a time (tabs), and all three keep in step.

Clinics: **Marikina** is Open, **Makati** is Open, **Pasig** is Full. File a second report if you want to try "Can't take it now".

## The flow

**1. Report a case (Citizen).** In the three-screen demo, use the Citizen screen: choose the animal and emergency, tap the shutter, then Dispatch. In single-screen mode open **SOS**; the camera and location are faked in the demo. The case appears on the **Feed**.

**1b. Find it (Volunteer).** On the **Feed**, open cases are at the top.

**2. Claim.** Tap **Claim**. A sheet asks "Claim case #…?". The confirm button stays off for a moment, then turns
on. Confirm. The **active case bar** appears with a **15 minute** lock (critical). A fractured case locks for 30,
a mange case for 60.

**3. Follow the steps.** You have **one minute** after claiming to tap **On my way** (or **I’m already at the animal**); if you do not, the claim ends and the case opens for others. The bar counts down from 1:00. The citizen sees the volunteer card only after that tap. The bar shows one step at a time, with a short progress line (On my way, Arrived, Clinic told, Clinic confirms, Admitted).
Tap **On my way**: the lock restarts and the person who reported it is told. Then **I’ve arrived**: it restarts once more and they are told
again. Each works only once. **Skip this step** is offered for Arrived only.

**4. Tell a clinic (required).** Tap **Tell a clinic I’m coming**. Clinics are listed nearest first, the nearest open one is marked, and **Pasig** is greyed out as
Full. Pick **Marikina**, choose how far away you are, confirm. The citizen is told you are taking it there.

**5. The clinic answers and confirms (switch to Clinic staff).** Open **Settings**, then **Clinic care**. Under **On their way to you** the case shows. Tap **Expecting
it** and confirm (the volunteer sees "Marikina is expecting you"). For the other answer, file and claim a second case, tell **Makati**, then as Clinic staff tap
**Can't take it now**: the volunteer sees "Choose another clinic". When the animal is really there, tap **Animal arrived** and confirm.

**6. Admit (Volunteer).** Until the clinic confirms, **Admit (locked)** is greyed out. When it unlocks it reads **Admit to Marikina**: tap it and confirm. The case is
**Admitted**, the citizen is told, and the clinic's 14-day clock starts from its own confirmation. There is nothing left for the clinic to confirm.

**7. Intake (only for an admin's direct admit).** If an admin admitted the case without the clinic's confirmation, it shows under **Waiting for intake** in Clinic care: tap **Animal arrived**.

**8. Care and finish.**
- Tap **Give it a name** ("Bob"), then **Open Bob's page** to see the whole story.
- Tap **Post recovery update**. Every update needs a photo taken now with the camera (no gallery), the treatment, the medication ("None" is fine) and the weight. In the demo, **Demo only: use a demo photo** stands in for the camera. Post another and choose **Resolved** to finish.
- A finished case moves to **Past cases** on the clinic dashboard, with a link to its story.
- Resolved cases stay on the Feed for 24 hours, then leave.

**9. Admin: no responder.** Switch to **Admin**, then **Settings > Admin > No responder**. A case nobody has taken for long enough
(10 minutes for a critical one) is listed with the nearest clinics that are not full and their phone numbers. Tap **Assign** (you are
the demo volunteer) or **Close as false report**, and confirm.

**10. Standby.** Not playable in the demo now: it needs a second volunteer holding a claim. It works against the real database.

**11. Clinic status.** As **Clinic staff**, in **Clinic care**, under **Can you take animals right now?** set the
clinic to **Full** and confirm. Back as Volunteer, that clinic is greyed out and cannot be told.

## What to look for

- Every serious button asks first, and the confirm button waits a moment.
- A claim never lets two volunteers hold one case; one active rescue at a time.
- A Full clinic cannot be told someone is coming.
- Each person sees what they need: the rescuer, the clinic, the admin.

## What demo mode does not do

- It does not send notifications. The camera and location are faked; the real **SOS** (live camera, real GPS) is unchanged.
- Admin tabs other than **No responder** stay a read-only preview.
- The demo data lives in this browser. Clearing site data or **Start over** resets it. If you used an older version, **Start over** once to clear the old sample cases.

## Using the real database instead

To play the same flow against a real Supabase project, run the migrations, then
`supabase/setup/flow_sample.sql` (it creates the same cases). Make your account an admin using the commented line
in that file, tap **Exit** on the preview bar, and follow the steps above. Notifications need alerts turned on in
Settings and the scheduler set up (`supabase/setup/cron_tick.sql`).
