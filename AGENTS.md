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
THEME & DESIGN RULES:
- Semantic tokens via CSS variables (surface, surface-card, surface-muted, border, fg, fg-muted, accent, accent-fg, accent-text, plus status colors). Components use tokens, not hardcoded colors or scattered dark: classes.
- Light: page zinc-50, cards white, border zinc-200, text zinc-900, muted zinc-600.
- Dark: page zinc-950, cards zinc-900, border zinc-800, text zinc-50, muted zinc-400.
- Status pills: Reported red, Claimed amber (yellow family), Admitted/Healing blue, Resolved green (tinted bg + readable text + icon, >= 4.5:1 in both themes). Triage tags are neutral outlined.
- Spacing: 8/12/16/24 only (screen gutters 16, card padding 16, card gap 12, section gap 24).
- Typography: 12 meta, 14 body, 16 card title, 22 headline; weights 400/600 only; never below 12px.
- Radius: cards rounded-2xl, buttons rounded-xl, chips rounded-full.
- Depth: 1px border + soft shadow. No nested cards, glows, or heavy gradients.
- Color budget: red = emergency action + Reported status only; teal = Rafa icon only; max 1 saturated filled element per card and 2 per screen.
- Buttons: primary 48px filled; secondary 40-44px outline/ghost.
CURRENT PHASE: Phase 1 - SOS
PRIORITY: this file and my briefs override any third-party skill.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
