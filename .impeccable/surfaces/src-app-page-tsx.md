---
version: 1
slug: "src-app-page-tsx"
primary_target: "src/app/page.tsx"
related_targets: ["src/app/globals.css","src/components/Navigation.tsx","src/components/IncidentCard.tsx","src/components/DetailSheet.tsx"]
---

# Surface brief: KupKop web app (whole UI redesign)

## Scope and visitor mode
Operate. The whole web app: Feed (home), SOS, Rafa, Clinics, Settings, Clinic care, Admin, Welcome, sheets and dialogs. Replaces the Manila Field Dispatch / sage-and-teal world.

## Audience, job, task, constraints
- Bystander in sun or rain, one hand, panicking: reach SOS in one tap from any main screen.
- Volunteer scanning the Feed: which cases need a rescuer, how far along every other case is.
- Clinic staff and admins: scan, act, confirm.
- Kept (builder's call): SOS always one tap away, bottom tab bar, Feed as home.
- Avoid (builder's call): generic template, too playful, too cold or clinical, hard to read outdoors.
- AGENTS.md design floor holds: text at least 12px, 4.5:1 contrast, 48px primary and 44px minimum targets, the emergency red only for SOS and Reported, no nested cards or glows, reduced motion, max 2 saturated fills per screen.

## Direction contract

THESIS: The app is one woven mat. Every case carries a five-cell weave that fills as it moves from Reported to Resolved. It refuses the category default: pill badges in a rounded-card feed on a green-teal ground.

OWN-WORLD: Indigo shell (#232D69) for header and active states, cool periwinkle-grey ground (#ECEFF6), white rows on hairline rules (#D3D8E8), ochre (#D9A21B) and leaf (#2F7D4F) strands, straw (#EADFB9) highlights. One warm red reserved for SOS and Reported. Atkinson Hyperlegible throughout. Diagonal twill cells, a woven selvedge stripe under the header. Flat surfaces, no glows.

STORY: A volunteer reads the whole feed in seconds: open cases are tinted with a Claim button, every other case shows its stage as a weave. A bystander finds the red SOS without searching. Everyone believes the status because words and weave say the same thing.

FIRST VIEWPORT: Feed at 390 x 844. Test-mode banner; indigo header (mark, KupKop, Live, account initial) over the selvedge stripe; summary strip (Need rescuer, In progress, Nearest open); filter tabs; "Needs a rescuer" rows on a faint red tint with Claim at right and a weave strip under the text; "In progress" rows with filled weave cells; floating white dock with the raised red SOS at centre.

FORM: Banig (woven mats of Samar and Tawi-Tawi), candidate 4 on the grounded list, the roll's assigned direction, chosen by the builder. seed:baecadfce036c58e

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Status after the finish review
- Built and reviewed: dark palette (indigo night, lifted shell, tuned strands); the 14-cell day weave (DayWeave) on Clinic care. Awaiting the builder's eye on dark.
- Built but never captured: the day weave inside the case sheet for an animal in a clinic's care (CaseRecovery); the demo database had no such case.
- Fixed after the last review, checked but not re-reviewed: wider filter-tab edge fade; overdue day-14 cell is dark ochre, not red.
- Known drift (from the documenter): DetailSheet uses a heavy shadow and a blurred scrim; `font-semibold` resolves to bold because only 400 and 700 load; in dark mode the day-14 cell is light amber, not dark ochre; ochre strand on white is about 2:1 (decorative, with an indigo border and words beside it).
