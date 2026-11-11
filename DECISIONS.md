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

### D-026: Feed rework, Active Case Bar, SOS GPS guard, landing page
- **Date:** 2026-10-28
- **Decision:**
  1. **Active Case Bar** (from Claude Design file "KupKop Active Case Bar.html"): floats above the dock while the signed-in user holds a claim; countdown uses the shared 60-minute lock; Release / Admit, then Dismiss / Claim again once expired.
  2. **Feed:** flat rows (no cards), status as colored text, filter tabs with counts (sticky under the banner), summary strip (Need rescuer / In progress / Nearest open), groups sorted by escalation, faint tint on "Needs a rescuer" rows, end-of-list note, pull-to-refresh and "Updated Xm ago", header label follows the realtime channel (Connecting / Live / Reconnecting). Responders get a quick "Claim" on open rows. Details in DESIGN.md "Feed".
  3. **SOS never sends without a real GPS fix.** The hard-coded Quezon City fallback coordinates were removed; Dispatch stays disabled until GPS locks, with distinct "blocked" and "no fix" states (QA blocker 1).
  4. **Landing page `/welcome`:** shown once per device to signed-out visitors; "Report an emergency now" sits above sign-in so reporting is never blocked. Sign-in is shared (`AuthPanel`) between the landing page and `AuthModal`: email link (log in / create account), Google, and **Facebook (new; AGENTS.md said email + Google first)**. Social buttons read Supabase's enabled providers and say "not set up yet" instead of failing on Supabase's error page.
  5. `AuthModal` now calls `onSuccess` once a session exists (auth event, or on returning to the tab after opening the email link), so SOS sends the staged report after sign-in. An OAuth round trip reloads the page, so the photo must be retaken there.
- **Open:**
  - Google and Facebook are **not enabled in Supabase** (observed via `/auth/v1/settings`: only email). Enable both in Authentication → Providers and add the `/auth/callback` redirect URLs.
  - Rafa runs on the rule-based fallback (`GEMINI_API_KEY` is the placeholder); the fallback misses Filipino word forms ("kinagat", "nagdurugo"). QA blockers 2 and 3.
  - Design source conflict: D-025 removed Impeccable in favour of Claude Design, but Impeccable was restored and used for the feed. Decide which one governs.

### D-027: Rafa live on Gemini, scope rule, QA fixes
- **Date:** 2026-10-29
- **Decision:**
  1. **Rafa on Gemini 2.5 Flash** (real `GEMINI_API_KEY` in `.env.local`). Hidden thinking is turned off and the reply cap raised from 350 to 700 tokens; before that, replies stopped mid-sentence (Filipino replies run longer).
  2. **Scope rule (system prompt section K):** Rafa only answers about injured or endangered street dogs and cats, first aid, rescuer safety and KupKop; anything else gets a one-line refusal that points to SOS or a vet. Prompt-level only, so not guaranteed against a determined user.
  3. **Fallback replies rewritten to word-boundary patterns** (QA blocker 2). Filipino affixed forms now match ("nagdurugo", "kinagat", "nasagasaan"); "scared" no longer hits the hit-by-car reply; "my dog was bitten" gets wound care instead of the human-bite reply; "baka" ("maybe") no longer reads as cow. A Filipino message gets a Filipino reply even with the toggle on EN.
  4. **Offline label** (QA blocker 3): the route returns `isMock: true` whenever the built-in replies answered, including after a Gemini failure, and the chat marks those replies "Offline answer, basic guidance only".
  5. **Minor QA:** Rafa language toggle and chips are 44px; SOS retries a duplicate Case ID up to 3 times; "Update GPS" replaces its location watcher instead of stacking a new one (and the watcher stops when leaving SOS).
  6. **Missing Supabase settings are now visible:** a build without `NEXT_PUBLIC_SUPABASE_*` shows "KupKop is not connected to its database" on the feed and logs one console error, instead of retrying a fake host.
  7. **Feed recovers from a stale sign-in token:** on PGRST301/303 it refreshes the session once, else signs out locally, then retries.
- **Open:**
  - Hosted deploy needs `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` and `GEMINI_API_KEY`, then a rebuild; the hosted address must be added to Supabase redirect URLs.
  - Google and Facebook still not enabled in Supabase.
  - The Gemini key was shared in a chat session: rotate it and set a spend cap in Google Cloud.
  - Phase 1 real-phone test not run yet.

### D-028: Move to React Native (Expo); keep the web app as backup and backend
- **Date:** 2026-10-29
- **Decision (approved by the builder):**
  1. New Expo app in `mobile/` (SDK 58, Expo Router, React Native). Android first; the same code runs on iPhone in Expo Go. Real iPhone builds wait for the Apple Developer Program ($99/yr).
  2. The Next.js app stays deployed on Vercel. It is the backup UI and the app's backend: `/api/chat` (Rafa; the Gemini key stays server-side), `/api/geocode/reverse`, `/api/auth/validate-email`. Same Supabase project, so reports from either show up in both.
  3. Pure logic is shared, not copied: `src/lib/sos/escalation.ts`, new `src/lib/sos/geo.ts` (split out of `utils.ts`, which re-exports it), `src/types/database.ts`. Metro watches those folders; aliases `@shared/*`, `@shared-types/*`.
  4. Motion: Reanimated replaces GSAP in the app (same rules; only the shutter flash on the camera screen). AGENTS.md updated.
  5. Styling: plain StyleSheet with `mobile/src/theme/tokens.ts`, identical to `globals.css`, instead of NativeWind (fewer build parts; tokens stay the single source per platform).
  6. Sign-in in the app is email + 6-digit code only (no link), so it never signs in "somewhere else". Session kept with expo-sqlite localStorage per the Expo Supabase guide.
  7. Ported screens: Feed (realtime, groups, filters, distances, pull to refresh, claim, detail sheet, Active Case Bar), SOS (expo-camera live only, expo-location quick fix + GPS watch, compression, upload, Case ID retry, sign-in before send), Rafa, Clinics, Settings (theme, volunteer application), Welcome.
- **Not ported yet:** admin "View as", Google/Facebook sign-in, recovery updates, facility picker on admit (still first Listed facility, same as web), push notifications.
- **Checks run:** `tsc`, `expo lint`, `expo export --platform android` (bundle builds), `expo-doctor` 20/20. Not yet run on a phone.

### D-029: Clinic picker, Google sign-in in the app, push alerts for new SOS
- **Date:** 2026-10-29
- **Decision:**
  1. **Clinic picker (web and app):** Admit asks which Listed clinic took the animal (nearest first when location is on, inactivity warnings shown) instead of using the first Listed clinic. The database had no clinics, so `20261029000000_seed_test_facilities.sql` adds four test clinics (fake names and phones, "Listed").
  2. **Google sign-in in the app:** in-app browser to Google, back to `kupkop://auth/callback` with a PKCE code (`flowType: 'pkce'`). A callback route finishes sign-in because Android also routes the return link. Button says "not set up yet" while Google is off in Supabase.
  3. **Push alerts:** `push_tokens` table (RLS: own rows only). App registers after sign-in and removes its token on sign-out. Supabase Database Webhook → `POST /api/push/new-report` (shared secret, service role key server-side only) → Expo push to volunteers and admins except the reporter; dead tokens removed. Tap opens the case. Alerts go to all responders for now (no radius: volunteer locations are not stored).
- **Needs the builder:** run the two migrations; enable Google in Supabase and add `kupkop://**` and `exp://**` to Redirect URLs; for push: `eas init`, Firebase FCM key, Vercel `SUPABASE_SERVICE_ROLE_KEY` + `PUSH_WEBHOOK_SECRET`, the webhook, and a development build (Expo Go on Android has no push).
- **Checks:** web `tsc` and eslint; app `tsc`, `expo lint`, Android export bundle, `expo-doctor` 20/20; push route answers 503 until configured. Nothing tested on a phone yet.

### D-030: Web first; clinic care dashboard (Phase 3), admin review and report flags (Phase 4)
- **Date:** 2026-10-29
- **Decision:**
  1. **Web first:** new features are built and tested on the web app (GitHub + Vercel). The Expo app catches up once the web app is complete; EAS setup waits until then.
  2. **Clinic staff belong to a clinic:** `profiles.facility_id`, set only by an admin (the role-tampering trigger now guards it too). Clinic staff apply in Settings and pick their Listed clinic; approving sets role and clinic together.
  3. **Clinic care (`/care`):** staff see animals admitted to their clinic (admins see all), most overdue first, and post recovery updates through `post_recovery_update()`: admitted → healing → resolved, never healing → admitted, note 5–500 characters. Each update restarts that case's 14-day clock and the clinic's `last_active_at`. Direct inserts into `recovery_updates` are closed; the old policy let any facility user post on any clinic's case.
  4. **Case sheet:** shows the recovery timeline and the clock from the newest update (it was wrongly counting from the claim time).
  5. **Admin (`/admin`):** approve or reject applications, review flagged reports, add Listed clinics. Every action is a database function or RLS-checked insert that requires `is_admin()`.
  6. **Report flags:** signed-in users flag a case as fake, duplicate, abusive or other (one flag per person per case). Nothing is hidden automatically; an admin hides it (`sos_reports.hidden_at`, kept for the record) or dismisses the flags. Hidden reports are visible only to their reporter and admins.
- **Not done (needs a brief):** "bystander handoff" and an AI flag from the Phase 4 backlog line are not defined anywhere yet.
- **Mobile port later:** clinic-staff option in the application form, recovery timeline, flag button, care and admin screens. The database changes don't break the current app.
- **Checks:** `tsc`, eslint, `next build`; escalation and care-clock thresholds checked against AGENTS.md (13/13). Migration `20261029000002_facility_care_and_flags.sql` not run yet; nothing tested with real accounts yet.

### D-031: QA audit fixes (blockers, major, minor)
- **Date:** 2026-10-29
- **Database (`20261029000003_qa_fixes.sql`, run after `…000002`):** new reports always start open and unclaimed, urgency follows the emergency type, and the photo must be a `live-snaps` upload in the reporter's own folder; 5 reports per 10 minutes per user. `live-snaps` uploads limited to own folder, images, 2 MB. `bills` private to uploader and admins. `email` and `is_verified` are admin-only like `role` (SQL editor and service role exempt). One active claim per volunteer. Volunteers may apply as clinic staff.
- **Expired claims:** a claim older than 60 minutes counts as open (`needsRescuer()` in `escalation.ts`); other volunteers see Claim. Admit and Release show only to the claimer or an admin.
- **Honest copy:** no "broadcast widened" (nothing is sent); waiting time is shown instead. Rafa no longer claims delisting, donations, plate handoff, or that facilities admit. SOS shows the server's timestamp. Map says "Reported location".
- **SOS:** all five emergency types; photo kept if sending fails after sign-in; "Report another" starts clean; street text follows GPS until edited.
- **Clinics page:** 14-day status comes from each animal in care; a clinic with none shows no clock. Only Listed clinics; an error state replaces fake samples.
- **Other:** failed sign-in links explained; rate limits on address and email routes; Rafa sends each message once, keeps the chat across tabs, page text in Filipino; theme set before first paint; focus stays inside dialogs; spinners respect reduced motion; tap targets ≥ 44px; overdue badges amber instead of coral.
- **Checks:** `tsc`, eslint (0 errors), `next build`; escalation and expired-claim rules 17/17. Not tested on a phone or against the database yet.

### D-032: Finishing the web app (M1-M6)
- **Date:** 2026-11-09
- **Decision (builder said "finish it" on the plan's recommendations):**
  1. **Alerts are web push** (`web-push`, `public/sw.js`, VAPID keys). Android Chrome works directly; iPhone needs the site added to the Home Screen. The Expo push route stays for the phone app.
  2. **Escalation runs on a scheduler:** Supabase pg_cron + pg_net call `/api/cron/tick` every minute with `CRON_SECRET`. Stages: responders whose saved area (place + 1-10 km) covers the report at once; every other volunteer and admin at the widen time; admins at "no responder". `sos_alert_log` makes each stage happen once; a late tick sends only the newest stage.
  3. **Intake:** after admit, the clinic confirms "Animal arrived" or "Can't accept" (case returns to the rescuer with a fresh 60-minute lock; the rescuer gets an alert). A recovery update also confirms intake.
  4. **14-day rule enforced:** the scheduler marks a case overdue, sets the clinic to `Paused` (hidden from the picker and Clinics page), and alerts clinic staff and admins. Admins list it again in Admin → Clinics.
  5. **AI flag:** the scheduler sends new report photos to Gemini; no animal or a photo of a screen opens an admin flag (source `ai`); graphic photos are labeled before reveal. A failed check never blocks a report.
  6. **Bystander handoff:** reporter or rescuer records who took the animal, with a live plate photo in the private `plate-photos` bucket, readable by the reporter, the photographer and admins.
  7. **Admin tools:** Users (change roles, never your own; removing a volunteer releases their claim), Clinics (pause / list), Handoffs.
  8. **Profile and polish:** display name shown as first name on claimed cases; errors in neutral text with an amber icon; Facebook sign-in removed; report photos must come from this project's own storage host.
  9. **Tests:** `npm test` (vitest, 30 tests on escalation, alerts, claim lock, care clock, geo); `supabase/tests/permissions.sql` checks 15 database rules and always rolls back.
- **Not done:** Filipino for the whole app (only Rafa is bilingual); vet bill upload (with donations, Later); Lost & Found, donations, adoption, Saludo, phone sign-in (Later); phone app port.
- **Needs the builder:** `docs/go-live-setup.md` (migrations, Vercel variables, scheduler, test).

### D-033: Role preview for everyone
- **Date:** 2026-11-09
- **Decision (builder's request):** Settings has a "Preview a role" card (Citizen, Volunteer, Clinic staff, Admin) open to every visitor, replacing the admin-only "View as". While a preview is on, a banner on every page repeats the switcher and has Exit preview. The choice is kept in this browser (`kupkop-view-as`).
- **Display only:** the preview changes which screens, buttons and links show. It grants nothing: RLS and the database functions still enforce the real account, so a preview role's saving buttons fail with the database's own message.
- **Clinic care and Admin pages** show made-up sample data inside a disabled `<fieldset>` while previewing (the real data stays behind the real role). Picking your own real role keeps the banner but uses real data.
- **Also:** waiting times read "7m / 3h / 15d" (`formatWaited`); disabled controls in a preview are dimmed.

### D-034: Redesign to "Banig" (whole web UI)
- **Date:** 2026-11-09
- **Decision (builder picked one of five directions):** Banig, after the woven banig mats of Samar and Tawi-Tawi. Indigo shell, cool pale ground, white rows on hairlines, one warm red reserved for SOS and Reported. Atkinson Hyperlegible replaces Inter and Bricolage Grotesque (a face designed for low vision, for outdoor reading). Kept by the builder: SOS one tap away, bottom tab bar, Feed as home.
- **Signature:** every case carries a five-cell weave (`StageWeave`: red twill Reported, indigo/ochre Claimed, leaf Admitted to Resolved); recovery days are a 14-cell weave (`DayWeave`: leaf 1-10, ochre 11-13, dark ochre 14+, never red); a woven selvedge stripe sits under every screen header (`ScreenHeader`).
- **Where:** tokens and the weave CSS in `src/app/globals.css` (light, dark, system-dark); fonts in `layout.tsx`; app icons and manifest follow the shell colour. Settings, Facilities and role sections are flat hairline bands, not shadowed cards. The role-preview bar is one compact strip.
- **Process:** direction roll and five sketches, then a fresh finish review (fix), eight fixes, a verdict pass (seven resolved, one partial), then two last fixes (wider tab-edge fade, overdue cell no longer red). Those last two were checked by the builder's assistant, not re-reviewed.
- **Open:** the recovery clock inside the case sheet for an animal in clinic care was never captured (the demo database has no such case). The `mobile/` Expo app is parked and still carries the old tokens. Dark palette awaits the builder's eye.
- **Checks:** `tsc`, eslint (0 errors), 36 unit tests, production build, detector with no findings, screenshots at 390 and 1440 wide in light and dark.

### D-035: Brand details on the Banig design
- **Date:** 2026-11-09
- **Decision (builder said "ok go" to the first round of customization):** a two-strand wordmark with a woven underline; a woven 3x3 plait mark and app icon in place of the paw glyph; the selvedge on the tab bar and case sheet; finished and blank mats for list ends and empty states; one animation, where newly reached weave cells weave in when a case advances a stage (never on first paint).
- **Checks:** `tsc`, eslint (0 errors), 36 unit tests, production build, screenshots of Feed, case sheet, Clinics, Welcome and dark Feed. The animation's computed style was checked (`weave-in`, 0.52s); it was not watched playing on a real stage change.
- **Not yet done from the menu:** drawn animal illustrations, Filipino wording, first-run welcome flow, Sun mode, strand palette choice.

### D-036: Phone layout refinements
- **Date:** 2026-11-09
- **Decision (builder said "go on"):** the Feed's first case starts about 70px higher (refresh moved into the header's Live control, the "Nearby cases" heading row became screen-reader-only, summary strip tightened); the case sheet's main action is pinned to the bottom of the sheet and its photo is shorter (160px); case rows show animal and type without truncation, and only the location shortens.
- **Not done:** a compact row mode for volunteers, grouping Settings (Account, Alerts, Appearance, Demo tools), and the desktop two-pane layout with a side rail (needs its own plan).
- **Checks:** `tsc`, eslint (0 errors), 36 unit tests, production build; first row top measured at 305px (was about 375px) and the pinned Claim button at 645-693px of 844px.

### D-037: Case photo card, preview-bar minimize
- **Date:** 2026-11-10
- **Decision (builder asked for a professional redesign of the photo card, and a minimize button for the role preview bar):** `CasePhoto` replaces the old whole-surface reveal button. Why: the old card put "Tap to blur" over the subject of a revealed photo, kept a 30% dark layer on it, cropped it to 160px, offered no larger view, carried no evidence stamp, relied on drop-shadow text over arbitrary photos, and animated the blur filter (against the transform/opacity-only rule). The role preview bar can shrink to one slim row (remembered on the device).
- **Checks:** `tsc`, eslint (0 errors), 36 unit tests, production build; hidden, shown and full-screen states captured at 390px; Escape closes only the viewer first.
- **Not covered:** pinch-zoom in the viewer, and the AI "graphic" label was not seen on a real flagged photo (the demo data has none).

### D-038: Case row redesign (urgency, age, dark wash, CTA order)
- **Date:** 2026-11-10
- **Decision (builder shared a dark-mode Feed screenshot and asked for the same professional pass as the photo card):** urgency tier is visible on open rows (Critical / Urgent tag); the waiting age is the strongest element on open rows and quiet otherwise; the dark-mode row wash is a soft plum (`--open-bg`) instead of a heavy maroon band; filter tabs omit zero counts (the font's slashed zero read as a broken "Ø"); "Report an emergency" leads the end-of-list actions as an outlined red button.
- **Checks:** `tsc`, eslint (0 errors), 36 unit tests, production build; dark and light Feed captured at 390px; Claim buttons still render for a volunteer preview.
- **Not changed:** the summary strip still shows the slashed zero for "In progress 0"; the row's "Pinned location" fallback is unchanged (the street name comes from the report).

### D-039: Light only
- **Date:** 2026-11-10
- **Decision (builder's call):** the app is light only. The dark and system themes, the Appearance switcher in Settings, the theme script in the layout, `ThemeInit` and the `useThemeMode` hook are removed; the app ignores the phone's dark setting. The stale `kupkop-theme` value in a browser's storage is harmless.
- **Why it matters for design:** every colour choice now needs only one theme, so bolder colour is possible without a dark twin.
- **Checks:** `tsc`, eslint (0 errors). The mobile app is parked and unaffected.

### D-040: A less basic Feed (focal point, drawn animals, demo data)
- **Date:** 2026-11-10
- **Decision (builder said "ok" to the suggested first round A, B, D and a start on C):** big counts in the header band; a featured first case with the largest card on the screen and a direct Claim; drawn dog, cat and paw tiles instead of blurred grey photo tiles; the tier tag moved to the type line so the animal name never truncates; `supabase/setup/demo_data.sql` seeds fake cases at every stage, an overdue clinic case, and a full recovery history.
- **Why:** the screens read as basic: one flat family of white rows, no focal point, the only image hidden, timid type, and almost no data.
- **Checks:** `tsc`, eslint (0 errors), 36 unit tests, production build; Feed captured as a visitor and as a Volunteer preview, Welcome captured.
- **Not done:** the demo-data script has not been run (it needs the builder's database) and has never been tested against Postgres; bolder colour blocks and the Welcome hero illustration (rest of C and E); the desktop two-pane layout (F).

### D-041: Cases leave the Feed after 24 hours
- **Date:** 2026-11-10
- **Decision (builder, on seeing two 15-day-old open cases on the Feed):** the live Feed shows a case for 24 hours when nobody has claimed it (an expired claim counts as unclaimed) and for 24 hours after it is resolved. Cases in care stay visible while the animal is looked after, because the 14-day recovery clock and recovery updates depend on it (and they remain in Clinic care). The builder can widen the rule to cover cases in care too.
- **How:** `isOnLiveFeed()` (shared pure logic, `ESCALATION_CONFIG.feedWindowHours = 24`) filters the Feed on the client; the data is not deleted and Admin and Clinic care still see it. An empty Feed says "Nothing needs a rescuer right now" instead of showing sample cases.
- **Also corrected:** the "plain zero" for the big header numbers did not work (Atkinson's zero is slashed with no alternative), so it was removed; the slashed zero stays.
- **Checks:** 40 unit tests (4 new for the rule); verified in the browser that the two 15-day-old reports no longer appear.

### D-042: Clinic status, routing, heads-up, fairer lock, standby, admin actions, animal pages
- **Date:** 2026-11-10
- **Decision (builder, after the "what will be built" page):** build all six changes plus two more the builder asked for, and drop adoption from the roadmap.
  1. **Clinic status.** Clinic staff set Open / Emergencies only / Full on the Clinic care screen. It is trusted for 12 hours, then shows as "not reported". It is self-reported, shown as "reported by the clinic", never "verified". A paused clinic is never routed to.
  2. **Smart clinic choice.** The clinic picker lists clinics nearest first, marks the nearest open one, greys out Full ones (still selectable, with a warning). `rankClinics()` is shared pure logic.
  3. **Clinic heads-up.** The rescuer taps "Tell a clinic I'm coming" (with an arrival time); the clinic's staff get a push, and answer "Expecting it" or "Can't take it now". The rescuer is told right away. A clinic that reported Full cannot be told (the database refuses).
  4. **Fairer claim lock.** The lock is 15 / 30 / 60 minutes by severity (`claimLockMinutes()`, mirrored in `claim_lock_minutes()` in SQL). "On my way" and "Arrived" each restart it, once per claim. This replaces the flat 60 minutes in AGENTS.md.
  5. **Standby ("I'm available").** Any volunteer can join the list on a claimed case (max 3 cases each). When the lock ends or the rescuer releases, the first in line gets a two minute head start (push), then everyone can claim. It is a separate table, not a state, so the five case states are unchanged.
  6. **Admin "No responder" tab.** Cases nobody has taken show nearby clinics that are not full (to phone), a volunteer picker (the volunteer is notified), and "Close as false report". The reporter also gets a push at the "no responder" stage with the nearest open clinic and a pointer to Rafa.
  7. **Animal pages.** `/animal/[id]` shows a name, where the animal is, and the whole story. The rescuer, clinic or admin can name an animal.
  8. **Confirm every serious button.** One `ConfirmSheet` (not a browser dialog) names the action and what happens, and ignores touches for the first 600 ms so a ghost touch cannot pass it. Used for: Claim (Feed row, featured card, case sheet, SOS "I'll take it myself", Claim again), Release, Admit, Tell a clinic, Animal arrived, Can't accept, Expecting it, Can't take it now, clinic status, and the admin buttons (approve, reject, hide, keep, assign, close, change role, pause or list a clinic). "I'm available" uses a note with Undo instead, because it commits nothing. The SOS send button is unchanged: the photo review is already its second step.
- **Not built, still open:** the early "possible incoming" notice to clinics when a critical case is reported (the builder has not decided); a standby demo row (the demo script has one profile); clinic staff creating their own clinic page content beyond the Clinic care screen; Filipino text for the new screens.
- **Design notes:** a second foreign key from `sos_reports` to `facilities` would make the existing `facilities(name)` lookups ambiguous, so `heads_up_facility_id` is a plain column and names are read by id. Check-ins live in columns, not recovery updates, so the existing "clinic could not accept" scheduler job is never triggered by them.
- **Needs from the builder:** run `supabase/migrations/20261110000000_clinic_status_standby_headsup.sql`; re-run `supabase/setup/demo_data.sql` for sample statuses, names and a heads-up; run `supabase/tests/permissions.sql`; staff must enable alerts in Settings to receive heads-ups.
- **Layout change:** the bottom dock is wrapped in `<Suspense>` in `layout.tsx`, because it reads the current address and Next would not prerender the dynamic `/animal/[id]` page otherwise.
- **Checks:** `tsc`, eslint (no new warnings), production build (passes, `/animal/[id]` is partially prerendered), 67 unit tests (27 new: lock by severity, availability, ranking, standby phases, no-responder message); ConfirmSheet driven in a browser (button off at first, on after, runs once, cancel does nothing); admin "No responder" tab, Clinic care and the animal not-found page captured at 390px. **Not tested:** the SQL (migration, functions and the new permission checks have never run against Postgres), push delivery, and the full claim to heads-up to admit flow with real data.

### D-043: Demo mode (the whole flow, no database)
- **Date:** 2026-11-10
- **Decision (builder: "just make samples"):** an opt-in Demo mode in Settings. It seeds sample cases, three clinics and an animal in every stage into the browser's own storage, and plays the whole flow locally, so nothing needs to be run in Supabase. One person plays every role with the preview bar.
- **How:** `src/lib/demo/demo.ts` holds the sample data and a local copy of the server rules (claim lock by severity, one active rescue, check-ins, standby head start, heads-up refusal for a Full clinic, intake, recovery updates, names, clinic status, admin assign and hide). It reuses the shared pure logic, so the rules cannot drift much. `appRpc()` sends a call to the database or to the demo. The Feed, Clinic care, Clinics list, animal page, case recovery panel, clinic picker and Admin > No responder read the demo's data while it is on. The banner and the role bar say so.
- **Limits (said on screen and in `DEMO_FLOW.md`):** no notifications, SOS still uses the real app, other Admin tabs stay a read-only preview, data lives in this browser. The demo is opt-in and off by default; it never writes to the database.
- **Checks:** `tsc`, eslint (no new warnings), 75 unit tests (8 new play the entire flow through the demo engine). In a browser: Settings toggle, Feed with sample cases, claim through the confirm sheet, check-in, clinic picker with Pasig greyed out, heads-up, clinic answer, the volunteer seeing "expecting you", admit, intake, animal page. **Not run:** a production build after this change (a dev server was in use), the standby and admin tabs in the browser, and recovery updates through to Resolved in the browser (covered by the unit tests).

### D-044: Clinic pages
- **Date:** 2026-11-10
- **Decision (builder: "why can't I open a page for this clinic"):** each clinic on the Clinics list now has its own page, `/facilities/[id]`, reached from its name or a "View clinic" button. It shows the address, phone, the clinic's reported status (never "verified"), Directions, three counts (in care, update due, released), the animals in its care with their 14-day clocks (each opens that animal's page), and recently released animals. Public, like the list: no reporter or rescuer details. It also works in demo mode.
- **Not built:** staff editing the clinic's details or hours from this page; opening hours; photos. Calls stay disabled in test mode.
- **Checks:** `tsc`, eslint (no new warnings), 75 unit tests. In a browser (demo mode): the list links to each clinic, and the Marikina page shows status, counts and its two animals. Not run: a production build, and the page against a real database.

### D-045: Three-screen demo (Citizen, Volunteer, Clinic staff)
- **Date:** 2026-11-11
- **Decision (builder):** a `/demo` page that shows three phone-sized screens side by side, one per role, so the whole story can be played from the start without switching roles. The screens are iframes of the real app, each locked to a role with `?pane=`.
- **How:** each frame keeps its role in its window name (`name=` on the iframe, read before the shared preview role). Not sessionStorage: same-origin frames of one tab share it, and the three frames froze the page overwriting each other and firing each other’s storage events (`resolveViewAs()` in `src/lib/storage.ts`). Demo data stays in `localStorage`, so the browser's `storage` event keeps the three screens in step. Inside a frame the demo and role-preview banners are hidden. `X-Frame-Options` changed from DENY to SAMEORIGIN, plus `frame-ancestors 'self'`, so only our own pages can embed the app.
- **SOS in the demo:** in demo mode only, SOS uses the labelled fake lens and a fixed made-up location, skips sign-in, and files the report into the local demo through a new `create_report` rule (reporter is a separate demo citizen). The real SOS path is unchanged: live camera, real GPS, server timestamp. The success screen gained a "Follow this case" link.
- **Also:** "Start with an empty Feed" (clinics only); the Feed no longer shows "not connected to its database" while demo mode is on.
- **Checks:** `tsc`, eslint on the changed files, 83 unit tests (new: create_report, empty start, pane role), production build. **Not run:** the three screens in a real browser (no browser tool in the session), so the live sync between screens and the iframe layout still need a look.
- **Not built:** a demo notification strip for the citizen; a screen for the admin.

### D-046: Demo mode starts with no sample cases
- **Date:** 2026-11-11
- **Decision (builder):** remove the sample cases from demo mode. It starts with the three clinics and an empty Feed, and the first case is the one the citizen files. The "Start with an empty Feed" button is gone because that is now the default; Start over clears every case.
- **How:** `seedDemo()` returns no cases unless a test asks for them (`withSamples = true`); the sample cases stay in `demo.ts` only as fixtures for the unit tests. Browsers that already hold the old sample data keep it until Start over.
- **Lost:** standby (needs a second volunteer holding a claim) and the ready-made animals in every stage; Admin > No responder needs a case to age 10 minutes first.
- **Checks:** `tsc`, eslint, 83 unit tests.
