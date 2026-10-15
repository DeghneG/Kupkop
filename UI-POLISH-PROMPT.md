# UI polish for the Phase 0 shell

Read AGENTS.md and .agents/rules/grounding-rules.md first.

This is a BIG change: do NOT edit anything yet. First reply with a PLAN and
wait for my approval. Ask me questions one at a time if anything is unclear.
Do not run terminal commands or install packages without asking. Do not touch
the database, Supabase, auth, or API routes. Mock data only. No new features.

If you have already edited any file in this task, tell me now and list the
files before doing anything else.

GOAL: make the current screens compact, balanced, honest, and themeable
(light + dark with a toggle).

CHECK FIRST: the installed Tailwind version in package.json, and write
syntax that matches it. If unsure, ask me.

## 1) THEME SYSTEM

- Semantic tokens as CSS variables (surface, surface-muted, border, fg,
  fg-muted, accent, accent-fg, plus status colors). Components use tokens,
  not hard-coded colors and not scattered dark: classes.
- Light: page zinc-50, cards white, border zinc-200, text zinc-900, muted
  zinc-600. Dark: page zinc-950, cards zinc-900, border zinc-800, text zinc-50,
  muted zinc-400.
- Accent red: red-600 filled with white label in both themes; red text uses
  red-700 (light) and red-400 (dark).
- Status pills = tinted background + readable text + icon, in both themes:
  Reported red, Claimed amber (yellow family), Admitted/Healing blue,
  Resolved green.
- Toggle: a 44px icon button in the header (sun/moon, with aria-label).
  Default follows the system setting until I choose; save my choice in
  localStorage inside try/catch. Set the theme with a small inline script
  before first paint so there is no flash. Set color-scheme per theme.
- No new dependency (do not add next-themes) unless I approve it.
- Every text/background pair must be at least 4.5:1 in BOTH themes. Tell me
  any pair you cannot verify.

## 2) DESIGN RULES

- Spacing only 8/12/16/24. Screen gutter 16, card padding 16, gap between
  cards 12, between sections 24.
- Type: 12 meta, 14 body, 16 card title, 22 headline; weights 400/600 only;
  never below 12px.
- Radius: cards rounded-2xl, buttons rounded-xl, chips rounded-full.
- No nested cards, no glows, no heavy gradients. Depth = 1px border + soft
  shadow.
- Color budget: red = emergency action + Reported status only; teal = Rafa
  icon only; max 1 saturated filled element per card and 2 per screen.
- Primary buttons 48px filled; secondary 40-44px outline or ghost.

## 3) LAYOUT FIXES

- TEST MODE banner: thin, must wrap so the full text shows (not connected to
  911 or real responders). Keep the PHASE badge.
- TEST ROLE dropdown: keep, label it "DEV ONLY (mock role)", comment in code
  that it must be removed before real auth/RLS. Do not wire it to any real
  role logic.
- SOS hero: about 120px tall: headline + the report button + one plain line:
  "Take a live photo. We add your location and time automatically." Remove
  "3 Taps", "~15s", and "alerts responders immediately".
- Rafa: one collapsed row; first-aid chips: bleeding, scared/aggressive dog,
  moving safely. Remove "Claim lock rules" and heatstroke.
- Feed card, compact: ~80px blurred thumbnail (tap to reveal), neutral
  outlined triage tag with icon, status pill, location, distance, time, then
  one button row. Primary: "Claim Rescue" (hidden for the Citizen role; show a
  small "Become a volunteer to claim" link instead; UI only, RLS enforces it
  later). Secondary: Call.
- In TEST MODE the Call buttons must not dial. Disable the tel link and show
  "Test mode: calls disabled."
- Claimed card: "Claimed by a volunteer" (no name, no Track link). Replace the
  "[Live Camera Snap - Authenticated]" placeholder with a neutral placeholder.
- Facilities: rename to "Test Clinic A" etc. Remove the "RULE: LABELED LISTED
  ONLY" text; keep the "Listed Facility" chip.
- Remove "GPS Active" and "Real-time sync" unless they reflect real state.
  Do not hard-code a city; show "Location not set" for now.
- Bottom nav: labels 12px or more, safe-area bottom padding, last content
  clears the nav. Keep the tabs Feed / SOS / Rafa / Clinics.
- Icons: SVG only (no emoji). Use icons already installed or inline SVG; ask
  before adding a package.
- Any transition respects prefers-reduced-motion.

## 4) PROCESS

a) Reply with: files you will change and why, the token structure, how the
   theme toggle will work, and any questions. Wait for my approval.
b) After approval, implement, then report using the end-of-task format in
   grounding-rules.md.
c) Add to DECISIONS.md: light + dark with toggle; tags neutral and status
   colored; Claimed is amber; tabs are Feed/SOS/Rafa/Clinics; test-role
   dropdown is dev-only.
d) Also add the token and design rules above to AGENTS.md (replace any older
   color or theme lines).

END OF PROMPT. If you reached this line, you read all of it. Say so in your
plan.
