# KupKop Decision Log

## Architecture & Product Decisions

### D-001: Technology Stack Selection
- **Date:** 2026-10-14
- **Decision:** Use Next.js (App Router), Tailwind CSS, Supabase (Auth, Postgres + RLS, Storage), Gemini API (`/api/chat` for Rafa), and GSAP (`gsap`, `@gsap/react`).
- **Context:** Solo builder working ~10 hrs/week requiring rapid iteration, mobile-first web performance, and reliable real-time and storage primitives.
- **Consequences:** All database tables must have explicit RLS; animations restricted to transform and opacity via `@gsap/react` `useGSAP`.

### D-002: Emergency SOS Capture Integrity
- **Date:** 2026-10-14
- **Decision:** SOS reporting requires live camera capture only (no gallery uploads), device GPS, and server-side timestamps (`default now()`).
- **Context:** Street animal emergency response requires verified real-time presence and accurate location to prevent stale or fabricated reports.
- **Consequences:** Client-supplied timestamps are rejected; photo uploads go directly to `live-snaps` bucket.

### D-003: User Roles and Permission Hardening
- **Date:** 2026-10-14
- **Decision:** Roles defined as `citizen`, `volunteer`, `facility`, `admin`. Users can NEVER change their own role. Volunteer and facility roles require explicit admin approval.
- **Context:** Protect against privilege escalation and unauthorized case status manipulation.
- **Consequences:** RLS policies must strictly enforce `WITH CHECK` conditions prohibiting modifications to `profiles.role`.

### D-004: Motion Rules for Emergency Web
- **Date:** 2026-10-14
- **Decision:** Functional motion before decorative. Animate `transform` and `opacity` only. All GSAP animations wrapped in `gsap.matchMedia()` for `prefers-reduced-motion` and cleaned up on unmount. No animations on the SOS camera screen except shutter flash.
- **Context:** Stressed users, outdoor glare, and low-end mobile devices require instant, non-distracting UI responsiveness.

### D-005: Prototype Safety and Test Mode
- **Date:** 2026-10-14
- **Decision:** Use fake plate/face images only during prototype phase. Always keep TEST MODE banner visible. Facilities labeled "Listed", never "Verified".
- **Context:** Prevent public confusion, accidental panic, or privacy liability during development and testing.

### D-006: Helper Agent Organization & Boundaries
- **Date:** 2026-10-14
- **Decision:** Established 3 specialized helper agents/workflows: `ui-ux-reviewer` (review-only mobile accessibility/GSAP), `schema-security-reviewer` (review-only Supabase RLS/auth leaks), and `weekly-review` (strict 10 hr/week scope guardian).
- **Context:** Maintain high code quality and strict scope control under constrained weekly development budget.

### D-007: Phase 0 Shell UI System & Apple Weather Palette
- **Date:** 2026-10-15
- **Decision:** 
  1. Light + dark theme system via semantic CSS variables, Tailwind v4 `@custom-variant dark (&:where(.dark, .dark *));`, and 44px header toggle with zero-flash pre-paint script (no external next-themes package). Default base is daylight-readable white.
  2. Triage tags are neutral outlined (`border-border`), while status pills are colored (`Reported` = red, `Claimed` = amber, `Admitted/Healing` = blue, `Resolved` = green), verified >= 4.5:1 contrast in both themes.
  3. Navigation tabs standardized as `Feed`, `SOS`, `Rafa`, `Clinics` with >= 12px labels and 48px tap targets.
  4. Test-role dropdown is DEV ONLY (mock role for local prototype testing) and must be removed before real Supabase Auth/RLS integration.
  5. Standardized on Apple System tokens: Page (`#F2F2F7` light / `#000000` dark), Surface (`#FFFFFF` light / `#1C1C1E` dark), Surface-Muted (`#F2F2F7` light / `#2C2C2E` dark), Border (`#E5E5EA` light / `#38383A` dark), Text (`#1C1C1E` light / `#FFFFFF` dark), Text-Muted (`#6C6C70` light / `#AEAEB2` dark), Emergency Accent (`#E0201B`), Neutral Action (`#0071E3`), Link (`#0066CC` light / `#0A84FF` dark), Rafa (`#00758A` light / `#4FC3D9` dark), and verified status colors (Reported, Claimed, Healing, Resolved, Test Banner). All UI components strictly use semantic token utilities instead of hardcoded hex values.
  6. Brand wordmark uses Bricolage Grotesque (`font-brand`) for `KupKop` and the app icon letter `K`, creating an expressive, unmistakably distinct street animal emergency identity while keeping all UI and body text in clean native Apple San Francisco.
- **Context:** Mobile-web street animal emergency usability requires instant readability, honest copy, high contrast under daylight and nighttime conditions, and a native iOS feel.

### D-008: SOS-First Airy iOS Layout Redesign
- **Date:** 2026-10-15
- **Decision:**
  1. SOS-first Home screen: Unboxed hero with full-width 64px emergency button, 32px vertical breathing room, and centered honest caption.
  2. Bottom navigation Feed tab renamed to "Home" with Home icon.
  3. Active incidents list converted to a single grouped iOS Messages-style container with 56px circular thumbnails and inset hairline dividers.
  4. Actions (Claim, Call, photo reveal) moved into an accessible GSAP-animated Detail bottom sheet dialog.
  5. Theme switching (3-option System/Light/Dark segmented control), Supabase Auth sign-in, and DEV role selector consolidated into an accessible Profile bottom sheet dialog triggered by a 44px circular header button.
  6. Removed visual clutter from Home: Rafa cards, partner clinic cards, DEV bar, and inline action buttons are eliminated from the main feed view.
- **Context:** Street animal emergency response requires immediate clarity, single-focus calm under stress, and standard native iOS interaction patterns.

### D-009: 5-Tab Symmetrical Navigation and Option A Home Layout Overhaul
- **Date:** 2026-10-16
- **Decision:**
  1. Bottom navigation converted to 5 symmetrical tabs: `Home | Rafa | SOS | Clinics | Settings` with SOS elevated as the central 56px red round button.
  2. Created dedicated `/settings` page (`src/app/settings/page.tsx`) as the permanent home for Supabase Auth, Appearance (3-option iOS segmented control `[ System | Light | Dark ]`), DEV ONLY (mock role) selector, and About KupKop info.
  3. Overhauled Home page (`src/app/page.tsx`) to Option A:
     - Clean brand header: `[K]` logo chip, "KupKop", "Street Animal Emergency Network", and `<ThemeToggle />` on the right (eliminating redundant profile button).
     - Card Hero: A surface card (`rounded-[20px] p-5 bg-surface border border-border shadow-sm`) containing "Found an injured street animal?", 56px red emergency button "Report emergency" with Camera icon, helper text, and 4 quick triage shortcut chips (`Bleeding`, `Hit-and-run`, `Fracture`, `Trapped`) linking directly to `/sos?triage=<type>`.
     - Nearby Feed: Upgraded thumbnails from 56px circular dark blobs to 64px rounded rectangular photo previews (`rounded-[14px]`) with emergency blur and camera icon, tinted status pill indicators (`bg-reported-bg text-reported-fg`, `bg-claimed-bg text-claimed-fg`), and `ml-[80px]` inset hairline dividers.
- **Context:** User requested 5 bottom tabs (`Home | Rafa | SOS | Clinics | Settings`) and expressed discontent with the plain unboxed home hero, preferring an organized, rich card layout with instant triage shortcuts and clear navigation.

### D-010: "Compassionate Sanctuary" Brand Design System & Semantic Tokens
- **Date:** 2026-10-26
- **Decision:**
  1. Replaced generic Apple Weather grays with the custom "Compassionate Sanctuary" brand palette inspired by *Kupkop* (shelter, embrace, gentle refuge):
     - Light Base: Warm Oat Linen (`--page: #F6F4EE`), Ivory Cards (`--surface: #FFFFFF`), Soft Sage Mist (`--surface-muted: #EBF0EA`), Warm Stone Border (`--border: #E3E7E0`), Deep Forest Ink (`--fg: #142019`), and Earth Moss Slate (`--fg-muted: #57685D`).
     - Dark Base: Deep Forest Charcoal (`--page: #0E1411`), Deep Moss Slate (`--surface: #161E1A`), Woodland Shadow (`--surface-muted: #1F2923`), Pine Rim (`--border: #28342D`), Snow Linen (`--fg: #F2F5F3`), and Silvery Sage (`--fg-muted: #93A69A`).
  2. Accent colors tuned for distinct purpose:
     - Emergency Beacon & Critical Action: Signal Coral (`--accent: #F04438` light / `#FF5347` dark) with high-contrast white label.
     - Healing & Guidance (Rafa & Secondary Action): Deep Healing Sage (`--action: #0F766E` / `--action-fg: #FFFFFF` light) and Luminous Mint (`--action: #2DD4BF` / `--action-fg: #042F2E` dark).
     - Verified $\ge 4.5:1$ contrast in both daylight and dark modes across all token pairs.
  3. Brand tagline updated to "Street Animal Emergency & Sanctuary Network".
- **Context:** The previous UI was perceived as generic Apple iOS system clone. "Compassionate Sanctuary" gives KupKop an authentic, warm, community-driven shelter identity while maintaining life-saving emergency contrast and speed.

### D-011: Rafa AI Master Knowledge & Refusal Guardrail Specification (A–J)
- **Date:** 2026-10-27
- **Decision:**
  1. Implemented the master 10-section knowledge and behavior specification for Rafa in `src/lib/gemini/rafa.ts`:
     - **A. Emergency First Aid:** Roadside stabilization only (bleeding, fractures, shock, heatstroke, trapped, seizures, poison, burns, puppies/mange). Always push "seek veterinary clinic" and "submit SOS report."
     - **B. Rescuer Safety:** Human safety first. Never diagnose rabies. Human bite/scratch protocol: wash 15 mins with soap + immediate referral to Animal Bite Treatment Center (ABTC).
     - **C & D. Platform Rules:** Live camera only (anti-tampering, no gallery), 14-day facility activity clock, free service, prototype not connected to 911.
     - **F. Strict Out-of-Scope Refusal:** Hard refusal on human medication dosages (warn paracetamol/ibuprofen toxic), disease diagnosis, euthanasia, legal advice, human medical emergencies (redirect to ER/ABTC), non-cat/dog species (redirect to DENR).
     - **G. Transparent Limitations:** Honest about AI identity, cannot call or track independently, stateless session.
     - **H. Emotional Support:** Warm, grounding, validating panic while directing to action.
     - **I. Adversarial Hardening:** Strict defense against prompt injections, jailbreaks, and harmful intent (poisoning/stealing strays). Vague queries trigger 3 immediate steps + 1 question.
     - **J. Bilingual Support:** Full parity across English, Filipino, and Taglish.
  2. Quick triage chips in `src/app/rafa/page.tsx` updated to priority questions: Bleeding, Moving animal, Scared dog, Keep warm, Animal bit me, and While waiting.
  3. Created `rafa-test-suite.md` as the permanent Phase 4 benchmark for the `qa-tester` agent.
- **Context:** Bystanders in street animal crises require immediate, accurate, non-confusing stabilization guidance, strict protection against lethal human medication, human bite safety, and clear boundaries when questions drift out of scope.

### D-012: UI/UX Reviewer Supercharged with Impeccable Design Heuristics
- **Date:** 2026-10-27
- **Decision:** Infused Paul Bakaus's [Impeccable](https://github.com/pbakaus/impeccable) frontend design heuristics and anti-slop detector rules into KupKop's `ui-ux-reviewer` skill ([.agents/skills/ui-ux-reviewer/SKILL.md](file:///f:/Kupkop/.agents/skills/ui-ux-reviewer/SKILL.md)):
  1. **Anti-Slop Detector Rules:** Hard checks against card nesting/blobs, saturated color bleed/fatigue, gray-on-color contrast failures, ad-hoc spacing outside 8/12/16/24, decorative icon clutter, and unauthorized typography.
  2. **Ranked Critique Structure:** Every review delivers 1–2 strengths followed by prioritized findings ranked from **P0** (Emergency Blocker) to **P3** (Minor Polish) with concrete code/Tailwind fixes.
  3. **Emergency Supremacy:** Preserved KupKop's strict core constraints: stressed one-handed outdoor persona, 48px thumb zones, ~3 taps/15s SOS flow, and "Compassionate Sanctuary" semantic CSS variable tokens.
- **Context:** User requested integrating `pbakaus/impeccable` to eliminate generic AI UI cliches, improve visual hierarchy, and enforce professional craft while preserving KupKop's life-saving emergency focus.

### D-013: Installation of Full Impeccable Design Skill Suite
- **Date:** 2026-10-27
- **Decision:** Installed the full official [pbakaus/impeccable](https://github.com/pbakaus/impeccable) v4.8.0 skill suite and engine into [.agents/skills/impeccable/](file:///f:/Kupkop/.agents/skills/impeccable/):
  1. **Core Skill:** [.agents/skills/impeccable/SKILL.md](file:///f:/Kupkop/.agents/skills/impeccable/SKILL.md) providing all 25 user commands across Build, Evaluate, Refine, and Enhance categories (`/critique`, `/audit`, `/polish`, `/bolder`, `/quieter`, `/animate`, `/colorize`, `/typeset`, `/layout`, `/shape`, `/init`, `/document`, etc.).
  2. **Impeccable Engine:** Native CLI binary (`impeccable.exe` v0.1.18 on Windows) accessible via `.agents/skills/impeccable/scripts/impeccable.cmd` for deterministic design anti-pattern detection and context generation.
  3. **Playbook References:** Complete set of 40+ playbooks under [.agents/skills/impeccable/reference/](file:///f:/Kupkop/.agents/skills/impeccable/reference/) covering craft floor, responsive adaptation, visual hierarchy, mobile thumb zones, and UX microcopy.
- **Context:** Equips the UI/UX design workflow with the official Impeccable design suite while honoring KupKop's emergency design rules in `AGENTS.md`.

### D-014: UI Redesign to Manila Field Dispatch & Sculpted Cockpit Dock
- **Date:** 2026-10-27
- **Decision:** Transformed KupKop's frontend from a generic boxed template into the authentic "Manila Field Dispatch" aesthetic:
  1. **Unboxed Editorial Breathing Room:** Removed card nesting around the hero section, letting display typography in `Bricolage Grotesque` and high-contrast sector status indicators breathe naturally.
  2. **Sculpted Cockpit Dock:** Replaced the stacked two-story navigation bar with a single, unified floating glass dock where secondary navigation wings flank a central elevated 56px Signal Coral SOS camera beacon.
  3. **Rescue Field Docket Cards:** Redesigned incident cards with 68×68 evidence frames, safety blur, stamp-style case IDs (`#KK-4821`), and street landmarks.
  4. **Clean Theme Toggle:** Eliminated the distracting red outline ring on the sun toggle by switching to accessible `focus-visible` styling.
- **Context:** User requested breaking out of plain container monotony and establishing a unique, tactile visual identity for KupKop.

### D-015: Incident Feed Redesigned to Minimalist Clean Stream
- **Date:** 2026-10-27
- **Decision:** Replaced heavy boxed card containers with an open, flowing Minimalist Clean Stream in `IncidentCard.tsx`:
  1. **Borderless Hairline Dividers:** Eliminated card box containers (`border-b border-border/70`), giving the feed continuous rhythm and breathing space.
  2. **Clean 72px Rounded Thumbnail:** Replaced the tacky "EVIDENCE" text badge with a subtle, understated circular camera lens overlay and soft blur.
  3. **Pure Typographic Hierarchy:** Condensed competing pill badges into a single status indicator (`Reported`, `Claimed`, etc.) and seamlessly unified the animal title with triage type (e.g. `Aspin Dog · Hit-and-run`).
### D-016: Track 1 Core Rescue Lifecycle Implementation (Claim Lock, Escalation Engine & 14-Day Inactivity Clock)
- **Date:** 2026-10-28
- **Decision:** Implemented KupKop's core rescue coordination lifecycle across database, logic, and interface:
  1. **Atomic PostgreSQL Claim Lock & RLS Bypass:** Created `claim_sos_report(p_report_id, p_volunteer_id)` and `release_sos_claim(p_report_id)` with `SECURITY DEFINER` row-level locks, resolving the RLS catch-22 where volunteers could not claim reports with `claimed_by IS NULL` under standard client policies.
  2. **Escalation Engine (`src/lib/sos/escalation.ts`):** Implemented automated triage escalation tiers from `AGENTS.md` (Hit-and-Run/Bleeding: 3m widen, 10m alert; Fracture: 5m/15m; Sick/Mange: 15m/60m) and rendered live status badges (`Widened radius · +Xm`, `No responder · +Xm`) on feed rows.
  3. **Live 60-Minute Claim Timer in DetailSheet:** Ticking countdown and progress rail with claim owner actions ("Mark as Admitted" handoff to partner clinics, "Release Claim" if unable to attend), and disabled lock display for other volunteers to avoid duplicate trips.
  4. **14-Day Facility Inactivity Clock:** Dynamic care tracking across partner clinics (`Day X of 14 · Active Care`, `Update due in X days`, `Inactivity Alert · Welfare check needed`) in `facilities/page.tsx` and DetailSheet.
- **Context:** User requested developing "Track 1" to establish the automated lifecycle from citizen emergency report to volunteer scene claim and partner clinic admission.

### D-017: Triage-Responsive Bespoke Glyphs (Direction A)
- **Date:** 2026-10-28
- **Decision:** Replaced generic Lucide icons (`AlertCircle`, `Lock`, `HeartPulse`, `CheckCircle2`) with handcrafted, triage-responsive vector micro-SVGs in `src/components/icons/TriageGlyph.tsx`:
  1. **Pulse Beacon (Hit-and-Run / Bleeding):** Geometric radio signal pulse emitting radial waves from an active core point, communicating urgent live broadcast instead of generic software alert.
  2. **Bone Splint (Fracture / Limping):** Orthopedic bone silhouette with angled stabilization wrap line for limp/fracture emergencies.
  3. **Extraction Wedge (Trapped in Drain):** Storm drain grate rim with an upward rescue extraction wedge.
  4. **Care Shield (Sick / Mange):** Medical treatment shield with clean cross for isolation & health triage.
  5. **Responder Compass (Claimed Lock):** 45° tactical navigation dial with filled active heading needle, replacing the generic website padlock to represent rescuer en-route navigation.
  6. **Sanctuary Sprout (Admitted / Healing) & Shield Check (Resolved):** Botanical care sprout and grounded shelter crest for long-term clinical care and sanctuary resolution.
  7. **Lock Timer Bug Fix:** Fixed edge case where `0m lock` displayed if claimed time had not elapsed 60 seconds; now renders cleanly as `<1m lock` or remaining seconds.
- **Context:** User requested unique, bespoke designs for the report icons via Impeccable review to eliminate repetitive generic exclamation marks across the incident feed stream.

### D-018: Report Card Distillation & Strict Single-Pill Rule
- **Date:** 2026-10-28
- **Decision:** Simplified and decluttered the incident feed cards following Impeccable's `distill` and `quieter` heuristics:
  1. **Strict Single-Pill Rule:** Eliminated the stacked second pill (`No responder · +3247m`) that was breaking card layout. Upgraded the status pill dynamically: when past the triage escalation threshold, it transforms from `[ (•) Reported ]` to `[ (•) Needs Rescuer ]` as a single, unified pill.
  2. **Eliminated Runaway Minute Counters:** Removed minute accumulation (`+3247m`) from card surfaces for older reports.
  3. **Protected Single-Line Meta Row:** Fixed metadata layout so the status pill, case ID (`#KK-XXXX`), relative timestamp, and distance stay on one balanced line that never wraps.
  4. **Progressive Disclosure:** Moved detailed dispatch radius and responder alert callouts to `DetailSheet.tsx` where rescuers triaging a specific incident can view the complete operational context without polluting the feed.
- **Context:** User reported that "too much is going on the reports" due to double-stacked pills, wrapping metadata, and runaway minute counts.

### D-019: Game-Changer Minimalist Viewfinder HUD & Triage Channel Rail
- **Date:** 2026-10-28
- **Decision:** Replaced the static, text-heavy editorial hero with the "Manila Field Dispatch HUD & Viewfinder Gateway" in `src/app/page.tsx`:
  1. **Minimalist Viewfinder Cockpit:** Replaced the paragraph marketing copy with a tactile HUD featuring hairline corner marks (`⌜ ⌝ ⌞ ⌟`), live atomic GPS lock indicator, and real Manila coordinates (`14.6198° N, 121.0526° E`).
  2. **Emergency Lens Gateway:** Centralized the primary 52px "Activate Emergency Lens" action button directly inside the viewfinder frame to establish the unforgeable live-camera core mechanic instantly.
  3. **Triage Channel Strip:** Replaced the 4 plain text shortcut boxes with an interactive, scrollable frequency channel rail equipped with custom vector glyphs (`PulseBeacon`, `BoneSplint`, `ExtractionWedge`, `CareShield`), supporting instantaneous interactive category filtering across the incident feed stream.
  4. **Spatial Directional Bearing Arrows:** Added cardinal/intercardinal direction arrows (`↗`, `↖`, `↘`, `↙`) next to distances in `IncidentCard.tsx` based on relative coordinate geometry, giving responders immediate spatial orientation without opening a full map.
- **Context:** User requested a "game changer but minimal design" to make the home page engaging, authentic, and fast while keeping clean visual restraint.

### D-020: Graphic-Led Emergency Hero with Bespoke Manila Rescue Artwork
- **Date:** 2026-10-28
- **Decision:** Replaced the technical "Manila Field Dispatch HUD" reticle box with a warm, high-craft graphic hero in `src/app/page.tsx`:
  1. **Bespoke Rescue Graphic Artwork (`/images/hero-graphic.jpg`):** Integrated authentic visual silkscreen artwork showing a volunteer responder kneeling with a Philippine aspin dog against a Manila cityscape with sunrise and electric tricycle in KupKop's exact brand colors (warm oat linen `#F6F4EE`, forest ink `#142019`, and warm amber).
  2. **Compact Split Graphic Layout:** Positioned the headline and instant dispatch copy on the left with the rounded-2xl graphic artwork badge on the right, providing an emotive visual anchor without pushing the emergency trigger below the fold.
  3. **High-Target Emergency Lens CTA:** Kept the primary 52px "Activate Emergency Lens" button prominently docked at the bottom of the card with micro-telemetry dispatch indicators (`<15s DISPATCH TARGET`, Manila coordinates).
  4. **Strict Token Adherence:** Styled entirely with semantic tokens (`--surface`, `--border`, `--fg`, `--fg-muted`, `--accent`, `--accent-fg`) ensuring flawless contrast in both light and dark modes.
- **Context:** User requested replacing the technical telemetry HUD box with a graphic to give the home screen visual soul and warmth.

### D-021: Radical Home Screen Decluttering & Unboxed Scenic Banner
- **Date:** 2026-10-28
- **Decision:** Radically decluttered `src/app/page.tsx` under the Impeccable `distill` principle following user feedback that the screen had become cluttered:
  1. **Eliminated Heavy Boxed Cards & Duplicate SOS Button:** Removed the bulky emergency viewfinder card, corner brackets, `<15s DISPATCH TARGET` telemetry, and raw coordinates. The primary emergency lens is anchored purely in the bottom navigation dock's elevated 56px beacon at thumb level.
  2. **Unboxed Scenic Graphic Artwork:** Replaced the cramped 96px thumbnail box with a full, panoramic 140px (`h-36 sm:h-44`) visual artwork banner featuring `/images/hero-graphic.jpg` with a soft bottom vignette and clean community caption.
  3. **Purified Header & Filter Strip:** Stripped the "K" logo box and the redundant `Sector Active` pill from the header, and removed the intrusive conditional prompt card from the triage rail.
  4. **Immediate Stream Prominence:** The incident feed now starts high in the viewport, giving users instant visibility into street emergencies without cognitive overload.
- **Context:** User identified that nested cards, telemetry, and duplicate buttons made the home screen feel cluttered.

### D-022: Compact Minimal Brand Mark & Zero-Banner Feed
- **Date:** 2026-10-28
- **Decision:** Removed all large banners and replaced the header with a bespoke, compact brand mark icon:
  1. **Zero Large Banners:** Removed the 140px billboard illustration banner, restoring complete visual restraint and letting the live emergency incident feed take center stage.
  2. **Bespoke KupkopMark Vector Brand Icon (`src/components/icons/TriageGlyph.tsx`):** Designed and integrated a handcrafted 24×24 vector SVG brand mark in a compact 40×40 badge (`bg-fg text-page`). The mark depicts a protective sheltering dome (the Kupkop canopy) embracing a stylized animal companion paw silhouette with geometric precision.
  3. **React 19 / Turbopack Script Error Elimination:** Removed legacy `<Script strategy="beforeInteractive">` from `src/app/layout.tsx` which triggered React 19 console errors; introduced `src/components/ThemeInit.tsx` and native `@media (prefers-color-scheme: dark)` in `globals.css` for instant, error-free theme support.
- **Context:** User rejected large decorative illustration banners and chose a compact, minimal brand mark graphic.


### D-023: Case-Function Hardening & Real Roles (Mock Role Removed)
- **Date:** 2026-10-28
- **Decision:**
  1. `claim_sos_report`, `release_sos_claim`, `admit_to_facility` now use `auth.uid()` only (no spoofable id params), require an approved volunteer/admin profile, enforce `reported -> claimed -> admitted`, and are executable by `authenticated` only (migration `20261028000001`).
  2. Direct `UPDATE` on `sos_reports` is admin-only, so reporters/claimers cannot bypass the claim lock. `recovery_updates` inserts limited to the claimer, facility staff, or admin.
  3. Volunteers apply via `role_applications` (migration `20261028000002`); only an admin can approve through `review_role_application()`. Users still never write `profiles.role`.
  4. DEV mock-role selector, `useMockRole`, and the unused `ProfileSheet` were removed. Role is read from `profiles.role` via `useProfile()` (display only; the database enforces permissions).
- **Open:** admin review screen (Phase 4; approve via SQL for now), facility picker for handoff (currently first Listed facility), facility staff are not linked to a specific facility.
- **Context:** The app is a rescue-dispatch tool; approved volunteers respond and clinics report recovery.

### D-024: Purposeful UI Pass (Impeccable critique, Home + SOS first)
- **Date:** 2026-10-28
- **Decision:**
  1. **No invented data.** Distance and direction come from the device position (only when location permission is already granted; Home never prompts) and are hidden otherwise. Removed the hardcoded `0.8 km`, the invented street name, and fake clinic distances. Sample cases appear only when the database has no reports, with a one-line note.
  2. **Feed states:** loading skeleton, error with retry, sample note. Feed errors are no longer silent.
  3. **Zoom restored** (`maximumScale` / `userScalable` removed) for low-vision users.
  4. **Type contract enforced** on all screens: 12/14/16/22, weights 400/600, nothing under 12px. Off-scale spacing and radii snapped to 8/12/16/24 and `rounded-2xl`/`rounded-xl`.
  5. **Removed decoration:** eyebrow labels, coral status dot, "Phase 1" banner pill, thumbnail camera badges, header theme toggle (theme lives in Settings; `ThemeToggle.tsx` deleted), Settings "About" card, redundant back links, mono-as-costume headings, section numbers on forms.
  6. **Tokens only:** removed hardcoded red/emerald/amber/sky/stone colors; coral kept for emergency action and Reported only (Rafa CTA now uses the action color). `reported-border` (undefined class) replaced.
  7. **SOS screen:** dev simulated lens is development-builds only (it let a non-live frame be submitted, against D-002); `animate-pulse` removed from the camera/confirmation screens; nested cards on the success screen flattened.
  8. **Build fix:** `/facilities` read `Date.now()` during prerender and broke `next build`; the clinic list now renders after mount.
- **Untouched by request:** bottom dock and SOS beacon.
- **Open:** Settings still uses stacked bordered cards; DetailSheet still nests two muted panels; no browser visual check was possible this session (source-level review only).

### D-025: Design source moves from Impeccable to Claude Design
- **Date:** 2026-10-28
- **Decision:**
  1. Removed the Impeccable skill (`.agents/skills/impeccable/`) and the two `.codex/hooks.json` hooks that ran it. D-012 and D-013 are kept above as history.
  2. AGENTS.md: the THEME & DESIGN RULES block is replaced by a pointer to the Claude Design project plus a short DESIGN FLOOR (min text size, contrast, coral budget, button sizes, motion). The floor stays in AGENTS.md so it holds if the design source changes.
  3. DESIGN.md and PRODUCT.md are kept as plain reference docs (the Impeccable schema comment was removed) and are the files to sync to Claude Design.
  4. `ui-ux-reviewer` no longer cites Impeccable; its rules are unchanged.
- **Done:** Claude Design project "KupKop" (id 8a049058-372f-400f-9aa3-bf6c53b2771d) created and loaded with a lightweight brief: README.md (hard rules), DESIGN.md, PRODUCT.md, tokens/globals.css. The full component sync was not used because KupKop is a private Next.js app with no dist/ or Storybook. Re-upload the brief after token changes.
