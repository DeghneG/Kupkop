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
