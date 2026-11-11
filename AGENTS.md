PROJECT: KupKop, Android/iPhone app for street animal emergencies (Expo, in
mobile/), with the Next.js web app kept live as backup and as the app's backend.
STACK: Web: Next.js, Tailwind, GSAP (npm: gsap, @gsap/react). Mobile: Expo SDK 58,
Expo Router, React Native, Reanimated (see mobile/AGENTS.md and mobile/README.md).
Shared: Supabase (Auth, Postgres + RLS, Storage), Gemini API (Rafa via the web
app's /api/chat; the key never ships in the app). Pure logic shared by both lives
in src/lib/sos/escalation.ts, src/lib/sos/geo.ts, src/types/database.ts: no DOM or
React Native imports there.
PILLARS: SOS (live camera only, GPS, server-side timestamp), Feed with claim
lock, 14-day facility inactivity clock, Rafa (first-aid + rules helper,
English/Filipino, calm and warm). Later: Lost & Found, donations, Saludo (adoption dropped, 2026-11-10).
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
Sick/Mange: 15 / 60. CLAIM LOCK by severity: 15 / 30 / 60 min (D-042); "On my way"
and "Arrived" restart it once each; volunteers can stand by ("I'm available") and the
first in line gets 2 min when the lock ends. Once a clinic is EXPECTING the rescuer the
claim holds for the expected drive (distance + Manila traffic by time of day, worked out by the
database) plus 15 min, then opens again (D-057). Clinics set Open / Emergencies only / Full
(trusted 12 h, self-reported). Every serious button asks "Are you sure?" (ConfirmSheet).
MOTION: Web: GSAP via @gsap/react useGSAP, client components only, wrapped in
gsap.matchMedia() for prefers-reduced-motion. Mobile: Reanimated, respecting
useReducedMotion(). Both: animate transform/opacity only, clean up on unmount,
no animation on the SOS camera screen except the shutter flash, functional motion
before decorative.
PROTOTYPE RULES: fake plate/face images only; TEST MODE banner on; facilities
labeled "Listed", never "Verified".
DESIGN SOURCE: DESIGN.md is the source (the "Banig" redesign, 2026-11-09, chosen by the builder) with
PRODUCT.md (users, purpose); the old Claude Design project "KupKop" is retired.
Tokens live in src/app/globals.css (web). mobile/src/theme/tokens.ts still holds the OLD
tokens: the app is parked (web only for now). Components use tokens, not hardcoded colors.
DESIGN FLOOR (holds even if the design source changes):
- Text never below 12px; text and icons >= 4.5:1 contrast in light and dark.
- Coral = emergency action + Reported status only; max 2 saturated filled elements per screen.
- Primary buttons 48px, secondary 40-44px; tap targets >= 44px.
- No nested cards, glows, or heavy gradients. Animate transform/opacity only.
- Respect prefers-reduced-motion. No animation on the SOS camera screen except the shutter flash.
CURRENT PHASE: Phase 1 - SOS & Rafa AI
PRIORITY: this file and my briefs override any third-party skill.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
