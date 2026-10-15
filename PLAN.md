# KupKop Development Plan

## Current Status
- **Current Phase:** Phase 0 - Setup
- **Weekly Capacity:** Max 10 hrs/week
- **Testing Rule:** Every task must have a "done when" testable on a real phone.

---

## Kanban Board

### Doing (Max 2 cards)
- [ ] Configure Supabase project (Auth with email + Google, storage buckets: `live-snaps`, `bills`, private `plate photos`).
  - *Done when:* Supabase client connects and authenticated session round-trip passes.

### To Do (Phase 0 - Setup)
- [ ] Setup initial database schema & RLS policies for `profiles`, `facilities`, `sos_reports`, `recovery_updates`.
  - *Done when:* RLS policies block anonymous writes and prevent users from modifying `profiles.role`.
- [ ] Configure Gemini API integration scaffold (`/api/chat` with rate limit and spend cap guardrails).
  - *Done when:* Test POST to `/api/chat` returns a calm, warm Rafa response.
- [ ] Configure GSAP and `@gsap/react` motion setup with `prefers-reduced-motion` helper.
  - *Done when:* Sample transition respects reduced-motion toggle.

### Done
- [x] Initialize repository structure and development toolchain (Next.js, Tailwind, Supabase integration).
  - *Result:* App compiles with Turbopack, loads locally on port 3000, and displays TEST MODE banner and mobile layout.
- [x] Create project agent specification (`AGENTS.md`) with Phase 0 setup context.
- [x] Configure KupKop helper agents and skills (`ui-ux-reviewer`, `schema-security-reviewer`, `weekly-review`).
- [x] Import reference skills (`ui-ux-pro-max`, `supabase`).

### Later (Backlog / Deferred)
- Phase 1: SOS (live camera only, GPS, server-side timestamp)
- Phase 2: Feed with claim lock & case escalation engine
- Phase 3: Facility view & 14-day inactivity clock
- Phase 4: Rafa first-aid & rules assistant (English/Filipino)
- Phase 5: Bystander / admin / AI flag
- Phase 6: Polish, security audits, and field test
- Post-Launch: Lost & Found, donations, adoption, Saludo, Phone OTP

---

## Phases Overview
1. **Phase 0:** Setup (Tooling, Supabase Auth/RLS/Storage, Gemini route, GSAP)
2. **Phase 1:** SOS Flow (Live camera capture, GPS coordinates, server timestamp, 3 taps / 15s)
3. **Phase 2:** Feed & Claim Lock (Realtime list, claim lock, escalation tiers)
4. **Phase 3:** Facility Dashboard & 14-Day Clock (Admitted/healing tracking, inactivity warnings)
5. **Phase 4:** Rafa Assistant (First aid triage, rules helper, English & Filipino)
6. **Phase 5:** Bystander & Admin Flagging (Handoffs, abuse reports, manual role approvals)
7. **Phase 6:** Polish & Test (Real-phone outdoor testing, accessibility 4.5:1, motion polish)
