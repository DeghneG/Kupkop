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



