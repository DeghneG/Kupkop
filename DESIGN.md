---
name: KupKop
description: "Street animal emergency network, woven: every case is a mat of five cells that fill from Reported to Resolved."
colors:
  page: "#ECEFF6"
  surface: "#FFFFFF"
  surface-muted: "#E1E5F2"
  hairline: "#D3D8E8"
  ink: "#151A33"
  ink-muted: "#4A5273"
  emergency-red: "#D92D20"
  on-emergency: "#FFFFFF"
  indigo-shell: "#232D69"
  on-shell: "#FFFFFF"
  shell-muted: "#C9CFEA"
  link-indigo: "#2B3796"
  leaf: "#2F7D4F"
  ochre: "#D9A21B"
  straw: "#EADFB9"
  reported-tint: "#FDECEA"
  reported-ink: "#B42318"
  claimed-tint: "#FFF4D6"
  claimed-ink: "#7A5200"
  healing-tint: "#E4F2EA"
  healing-ink: "#1F6B43"
  resolved-tint: "#E3E7F6"
  resolved-ink: "#2B3796"
  banner-tint: "#FFF3C4"
  banner-ink: "#4A3600"
  dark-page: "#0D1226"
  dark-surface: "#151B38"
  dark-surface-muted: "#1D2547"
  dark-hairline: "#2B3461"
  dark-ink: "#EEF0FA"
  dark-ink-muted: "#A5AED3"
  dark-action: "#AEB9FF"
  dark-shell: "#2A367F"
  dark-weave-indigo: "#6B7BE0"
  dark-ochre: "#E3B23C"
  dark-leaf: "#3DA874"
  dark-straw: "#53597F"
typography:
  title:
    fontFamily: "Atkinson Hyperlegible, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "22px"
    fontWeight: 700
    lineHeight: 1
  headline:
    fontFamily: "Atkinson Hyperlegible, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 600
    lineHeight: 1.375
  body:
    fontFamily: "Atkinson Hyperlegible, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.375
  label:
    fontFamily: "Atkinson Hyperlegible, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.25
rounded:
  weave-cell: "1px"
  control: "12px"
  dock: "16px"
  sheet: "24px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  weave-gap: "3px"
  day-gap: "2px"
components:
  header-band:
    backgroundColor: "{colors.indigo-shell}"
    textColor: "{colors.on-shell}"
    typography: "{typography.title}"
    padding: "12px 16px"
  selvedge:
    height: "8px"
  feed-row:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    padding: "12px 16px"
  feed-row-needs-rescuer:
    backgroundColor: "{colors.reported-tint}"
    textColor: "{colors.ink}"
  button-primary:
    backgroundColor: "{colors.indigo-shell}"
    textColor: "{colors.on-shell}"
    rounded: "{rounded.control}"
    height: "48px"
  button-sos:
    backgroundColor: "{colors.emergency-red}"
    textColor: "{colors.on-emergency}"
    rounded: "{rounded.control}"
    height: "48px"
  button-claim:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    height: "44px"
    padding: "0 16px"
  dock:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.dock}"
    padding: "6px 8px"
  dock-sos:
    backgroundColor: "{colors.emergency-red}"
    textColor: "{colors.on-emergency}"
    rounded: "{rounded.full}"
    size: "56px"
  test-mode-banner:
    backgroundColor: "{colors.banner-tint}"
    textColor: "{colors.banner-ink}"
    padding: "8px 16px"
---

# Design System: KupKop

## Overview

**Creative North Star: "The Woven Mat" (Banig)**

KupKop is one woven mat. Indigo is the warp that holds the shell together; ochre and leaf are the weft that shows progress; the emergency red is the single warm thread reserved for the moment something needs a rescuer. The form comes from banig, the woven sleeping mats of Samar and Tawi-Tawi. It shows up as diagonal twill cells and a striped selvedge, never as folk ornament or patterned backgrounds.

This is an operate-mode app: a bystander in sun or rain with one hand free, a volunteer scanning for open cases, clinic staff and admins who scan, act and confirm. It lives in a single mobile column (448px max), with a cool periwinkle-grey ground, white rows divided by hairlines, and no cards in the feed. Surfaces are flat. Status is told twice, in words and in weave, so nobody has to trust colour alone. Atkinson Hyperlegible carries every word, chosen for low-vision legibility outdoors.

It rejects the category default: pill badges in a rounded-card feed on a green-teal ground. Status is coloured text plus a weave strip, not a filled pill.

**Key Characteristics:**
- Cool indigo shell, periwinkle-grey ground, white rows on hairlines.
- One signature: the five-cell stage weave on every case, the 14-cell recovery clock, the selvedge stripe under every screen header.
- Emergency red only for SOS and the Reported status.
- Flat surfaces; floating elements (dock, SOS) carry one soft shadow, nothing glows.
- Light, dark (class or `data-theme`), and system-follow themes share one token set.

## Colors

A cool indigo-and-paper palette with three woven strand colours (indigo, ochre, leaf), straw as the highlight thread, and one warm red used sparingly. Frontmatter values are light; the `dark-` tokens are the indigo-night equivalents applied by the dark theme (the red is identical in both).

### Primary
- **Indigo Shell** (`indigo-shell`): header bands, primary buttons, the first weave strand. The dark theme lifts the shell to `dark-shell` and primary actions and links to `dark-action`.
- **Link Indigo** (`link-indigo`): inline text actions and the Resolved ink.

### Secondary
- **Emergency Red** (`emergency-red`): the SOS dock button, the SOS submit and welcome report buttons, and the red twill of a Reported case. Nothing else.
- **Leaf** (`leaf`): Rafa the guide, and the leaf twill for Admitted, Healing, Resolved and on-time recovery days.

### Tertiary
- **Ochre** (`ochre`): the second strand in Claimed twill and the "update due soon" days 11-13. Its text counterpart is `claimed-ink` (dark ochre).
- **Straw** (`straw`): the highlight thread in leaf twill and the last band of the selvedge.

### Neutral
- **Mat Ground** (`page`), **White Row** (`surface`), **Inset Wash** (`surface-muted`), **Hairline** (`hairline`): ground, rows and sheets, inset blocks and active tab fill, rules.
- **Indigo Ink** (`ink`) and **Slate Ink** (`ink-muted`): primary and secondary text.
- **Shell Muted** (`shell-muted`): subtitles on the indigo band.
- **Status tints and inks** (`reported-*`, `claimed-*`, `healing-*`, `resolved-*`): status is coloured ink text; only Reported also tints the whole row (`reported-tint`). `banner-*` is the amber TEST MODE strip.

### Named Rules
**The One Red Thread Rule.** Red marks SOS and Reported only. It never means overdue, error, or delete. The recovery clock goes ochre, then dark ochre, never red.
**The Two Fills Rule.** At most two saturated filled elements per screen (for example the indigo header plus the raised SOS). Everything else is tinted, outlined, or text.
**The Tokens-Only Rule.** Components read the CSS variables (through Tailwind `bg-surface`, `text-fg`, and the like); no hex in components.

## Typography

**Font:** Atkinson Hyperlegible (weights 400 and 700 loaded, variable `--font-atkinson`) with system-ui and Segoe UI fallback. One family for everything, no display face.

**Character:** Plain, open, unmistakable letterforms; hierarchy comes from size and weight, not from a second typeface.

### Hierarchy
- **Title** (700, 22px, line-height 1): screen header titles and case sheet titles.
- **Headline** (semibold, 16px, snug): feed row animal name, section headings, summary counts.
- **Body** (400, 14px, snug): locations and form text; buttons use the same size in semibold.
- **Label** (400 to 700, 12px): timestamps, status line, tab labels, banners, weave stage names. 12px is the floor.

### Named Rules
**The Twelve Floor Rule.** No text under 12px. Numerals that change (times, distances, counts) use tabular figures.
**The Two Weights Rule.** Only 400 and 700 are loaded. Components ask for `font-semibold`, which the browser resolves to the loaded 700, so treat semibold and bold as one emphasis weight.

## Layout

Mobile column, `max-w-md` (448px), centred with side hairlines on wider screens. Page gutter 16px; feed rows run edge to edge with 12px vertical padding. The column's bottom padding (7rem) clears the floating dock. A sticky TEST MODE banner sits at the top of every page, and the role-preview strip sits under it when active. Screens open with the indigo header band and selvedge, then content. The Feed adds a three-column summary strip divided by hairlines, then horizontally scrolling filter tabs (44px high, active tab underlined 2px in indigo) with a fade at the right edge. Rhythm is a 4px base: 4, 8, 12, 16. The SOS screen hides the dock.

## Elevation & Depth

Flat and tonal. Depth is ground, white row, inset wash, with hairlines as separators. Only things that float get a shadow, and it is soft and short.

### Shadow Vocabulary
- **Dock** (`shadow-md` at 10% black): the floating tab bar.
- **SOS beacon** (`shadow-md` at 20% black, 2px surface-coloured ring): the raised SOS button.
- **Sheet** (`shadow-2xl` over a 60% black scrim with slight blur): the case detail bottom sheet. Built this way; see the drift note in the handoff report.

### Named Rules
**The Flat Mat Rule.** Rows, headers and cards never get shadows. No glows, and no gradients except the woven twill and selvedge, whose stops are hard.

## Shapes

Mostly square-edged surfaces with soft 12px controls. Feed rows are unrounded full-width strips. Buttons, Claim and thumbnails use 12px; the dock 16px; the bottom sheet 24px at the top; SOS and avatar chips are circles. Weave cells are nearly square (1px radius) with a 1.5px indigo (or strand-coloured) border and a diagonal 45-degree twill fill, 8px tall. Thumbnails are 64px squares, blurred until the case is opened.

## Components

### Buttons
- **Shape:** 12px radius; primary 48px minimum height, secondary and Claim 44px.
- **Primary:** indigo fill, white text, 14px semibold. Emergency-submitting actions (SOS, welcome report) use the red fill instead.
- **Claim:** white fill, hairline border, ink text; it sits at the right of an open case row, outside the row's own click target (siblings, never nested).
- **States:** hover is opacity or inset wash; focus is a 2px action-colour outline with 2px offset; disabled is 50-60% opacity.

### Navigation
Floating white dock, 16px radius, hairline border, five destinations: Feed, Rafa AI, raised SOS, Clinics, Settings. Tabs are 56 by 46px minimum, 16px icon over a 12px label; active is indigo bold on an inset wash. The SOS is a 56px red circle lifted 16px above the dock with a camera icon and the word SOS. Hidden on /sos and /welcome.

### Cards / Containers
There are no cards in the feed. Sheets and settings groups are white on the ground with hairline borders. Never nest a bordered card inside a card.

### Header band
Indigo band, 12px by 16px padding, 22px bold white title, optional 12px shell-muted subtitle, right slot for actions, then the 8px selvedge. The Feed header adds the mark in a white 40px rounded square.

### Signature: Stage Weave
Five cells (Reported, Claimed, Admitted, Healing, Resolved), 3px gap. Cells up to and including the current stage fill: red twill while Reported (red over dark red), indigo/ochre twill when Claimed, leaf/straw twill for Admitted, Healing and Resolved. Unreached cells show the bare mat, a faint 16% indigo twill. Under feed rows it carries no labels (the status line does); on the case sheet it shows 12px stage names with the current one bold. It is exposed as an image with text "Stage N of 5".

### Signature: Day Weave
Fourteen cells, 2px gap, the recovery clock. Leaf twill days 1-10, ochre twill 11-13, dark-ochre twill from day 14. Never red. Image label "Day N of 14".

### Signature: Selvedge
An 8px band of hard-stop 12px stripes (ochre, indigo, leaf, straw) under every screen header.

### Banners and previews
TEST MODE strip: banner tint, 12px text, sticky, on every page. Clinics are labelled "Listed", never "Verified". Role previews (Citizen, Volunteer, Clinic staff, Admin) show a muted strip "Previewing as ..." with a 4-up role switcher (44px-tall options) and an Exit link. They are display only: Clinic care and Admin render sample data inside a disabled fieldset, whose controls drop to 55% opacity with a not-allowed cursor.

### Motion
Transform and opacity only, 150-200ms; honours `prefers-reduced-motion` (durations collapse to 0.01ms). The SOS camera screen has no animation except the shutter flash.

## Do's and Don'ts

### Do:
- **Do** show status in words and weave together on every case.
- **Do** keep SOS one tap away on every main screen via the raised dock button.
- **Do** put primary buttons at 48px, secondary at 44px, tap targets at least 44px.
- **Do** use ochre, then dark ochre, for approaching and overdue recovery updates.
- **Do** colour status as ink text on the row; tint the whole row only for Reported.
- **Do** end every main screen header with the selvedge.

### Don't:
- **Don't** use red for anything but SOS and Reported.
- **Don't** use filled pill badges for status, or nest a card in a card.
- **Don't** add glows or gradients other than the hard-stop twill and selvedge.
- **Don't** hardcode hex in components or use text under 12px.
- **Don't** label a clinic "Verified"; it is "Listed".
- **Don't** treat `mobile/` as part of this system: it is a parked Expo app still carrying the old sage-and-teal tokens.

## Brand details (added 2026-11-09)

- **Wordmark:** `Wordmark.tsx`. "Kup" in the header's ink, "Kop" in the ochre strand (`text-weave-b` on the shell; ink and indigo on the pale ground), over a 3px woven underline. Atkinson Hyperlegible 700, no second face.
- **Mark and app icon:** a woven 3x3 plait in the strand colours (`KupkopMark` in `icons/TriageGlyph.tsx`; the icon route `/pwa-icon` draws the same plait in straw, ochre and leaf on the indigo tile). The old paw-and-arch glyph is retired.
- **Texture:** `.selvedge-thin` (4px) edges the tab bar and the case sheet; a finished mat (all five cells) closes the feed list; a blank mat (`StageWeave blank`) marks empty states (no cases of a type, no Listed clinics, no animals in care). The Report sent screen shows the case's first cell, static.
- **Motion:** one authored moment. When a case advances, the newly reached cells weave in once (`weave-in`, 520ms, `cubic-bezier(0.16, 1, 0.3, 1)`, left to right, 110ms apart, opacity and scale only). It never plays on first paint, only on a real stage change; reduced motion collapses it to an instant change. No animation on the SOS camera screen.

- **Case photo (`CasePhoto.tsx`):** the evidence photo in the case sheet. Blurred by default behind a clear "Sensitive photo / Graphic injury · Tap to view" card (white text on a 70% black pill, so contrast never depends on the photo). Once shown, it is left clean: no dimming, no label on the subject. A "Live camera · time" stamp (the report's server timestamp) sits bottom-left; Expand and Blur-again buttons (44px, round, dark) sit top-right; tapping the photo opens a full-screen viewer on black. The blur is a crossfade between two image layers, so only opacity animates. 16:10 frame, at most 240px tall.

- **Case row (`IncidentCard.tsx`):** while a case needs a rescuer, its tier shows as a small-caps tag beside the animal ("Critical" in the emergency red, "Urgent" in ochre; moderate shows none) and its age is bold ink, the strongest fact on the right; once claimed or admitted, the tag disappears and the age goes quiet. Rows that need a rescuer sit on the `open-bg` wash (soft pink in light, soft plum in dark). Empty filters show no count. At the end of the list the emergency action leads: an outlined red "Report an emergency", then "Ask Rafa for first aid".
