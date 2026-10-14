PROJECT: KupKop, mobile-web app for street animal emergencies.
STACK: Next.js, Tailwind, Supabase (Auth, Postgres + RLS, Storage), Gemini API
(Rafa via /api/chat), GSAP (npm: gsap, @gsap/react).
PILLARS: SOS (live camera only, GPS, server-side timestamp), Feed with claim
lock, 14-day facility inactivity clock, Rafa (first-aid + rules helper,
English/Filipino, calm and warm). Later: Lost & Found, donations, adoption, Saludo.
BUILDER: solo, ~10 hrs/week.
ROLES: profiles.role = citizen | volunteer | facility | admin. Volunteer and
facility are applications approved by the admin. Users can never change their
own role.
TABLES: profiles, facilities, sos_reports, recovery_updates.
BUCKETS: live-snaps, bills, plate photos (private).
LOGIN: email + Google first; phone OTP later.
CASE STATES: reported, claimed, admitted, healing, resolved.
ESCALATION (config constants, tunable): Hit-and-Run/Bleeding critical at once,
widen at 3 min, "no responder" at 10. Fracture/Trapped-Abused: 5 / 15.
Sick/Mange: 15 / 60.
MOTION: GSAP via @gsap/react useGSAP, client components only. Animate
transform/opacity only. Wrap in gsap.matchMedia() for prefers-reduced-motion.
Clean up on unmount. No animation on the SOS camera screen except the shutter
flash. Functional motion before decorative.
PROTOTYPE RULES: fake plate/face images only; TEST MODE banner on; facilities
labeled "Listed", never "Verified".
CURRENT PHASE: Phase 0 - Setup
PRIORITY: this file and my briefs override any third-party skill.
