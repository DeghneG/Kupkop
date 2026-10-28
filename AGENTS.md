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
DESIGN SOURCE: Claude Design project "KupKop" (https://claude.ai/design/p/8a049058-372f-400f-9aa3-bf6c53b2771d). Local reference
copies: DESIGN.md (tokens, type, spacing, dock) and PRODUCT.md (users, purpose).
Tokens live in src/app/globals.css; components use tokens, not hardcoded colors.
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
