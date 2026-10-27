# Design System

<!-- impeccable:design-schema 1 -->

## Visual World: Manila Field Dispatch & Organic Sanctuary

An authentic rescue field docket aesthetic tailored for high legibility under harsh sunlight, tropical rain, and street emergencies in the Philippines. Breaks away from generic "AI card slop" through unboxed editorial typography, tactile evidence frames, and an ergonomic single-tier cockpit dock.

### Color Tokens & Semantics
All components use CSS variable tokens defined in `src/app/globals.css`. Hardcoded colors and scattered `dark:` classes are forbidden.

#### Light Mode (Warm Oat Linen)
- `--page`: `#F6F4EE` (Warm Oat Linen ground)
- `--surface`: `#FFFFFF` (Ivory White Card)
- `--surface-muted`: `#EBF0EA` (Soft Sage Mist)
- `--border`: `#E3E7E0` (Warm Stone Border)
- `--fg`: `#142019` (Deep Forest Ink, 16.5:1 contrast)
- `--fg-muted`: `#57685D` (Earth Moss Slate, 5.4:1 contrast)

#### Dark Mode (Deep Forest Charcoal)
- `--page`: `#0E1411` (Deep Forest Charcoal ground)
- `--surface`: `#161E1A` (Deep Moss Slate Card)
- `--surface-muted`: `#1F2923` (Woodland Shadow)
- `--border`: `#28342D` (Pine Rim Border)
- `--fg`: `#F2F5F3` (Snow Linen Text, 16.2:1 contrast)
- `--fg-muted`: `#93A69A` (Silvery Sage, 6.8:1 contrast)

#### Color Budget
- `--accent` (Signal Coral `#F04438` / `#FF5347`): Strictly reserved for emergency dispatch trigger and "Reported" status pill.
- `--action` (Deep Healing Sage `#0F766E` / Luminous Mint `#2DD4BF`): Neutral primary actions and Rafa helper accent.
- Max 1 saturated element per card; max 2 saturated elements per screen.

### Status Pills
- **Reported:** `--reported-bg` (`#FEECEB` / `#361517`), `--reported-fg` (`#B91C1C` / `#FF9B94`) with `AlertCircle`.
- **Claimed:** `--claimed-bg` (`#FEF3C7` / `#382508`), `--claimed-fg` (`#92400E` / `#FCD34D`) with `Lock`.
- **Healing / Admitted:** `--healing-bg` (`#E6F7F0` / `#0F2E22`), `--healing-fg` (`#0D7A55` / `#6EE7B7`) with `HeartPulse`.
- **Resolved:** `--resolved-bg` (`#DCFCE7` / `#0E321C`), `--resolved-fg` (`#15803D` / `#86EFAC`) with `CheckCircle2`.

### Typography Scale
Strict scale: 12 meta, 14 body, 16 card title, 22 headline. Weights 400 and 600 only. Never below 12px.
- Display / Wordmark: `Bricolage Grotesque` (`font-brand`)
- UI / System: `-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", var(--font-inter), system-ui, sans-serif`

### Spacing & Layout
Strict 8/12/16/24 spacing scale:
- Screen gutters: 16px (`px-4`)
- Card padding: 16px (`p-4`)
- Card gap: 12px (`space-y-3` / `gap-3`)
- Section gap: 24px (`space-y-6`)

### Radii & Elevation
- Cards: `rounded-2xl` (16px)
- Buttons & Docks: `rounded-xl` (12px)
- Chips & Status Pills: `rounded-full` (9999px)
- Depth: 1px border (`border-border`) + soft shadow (`shadow-sm`). Zero nested cards or heavy neon glows.

### Navigation Architecture: Sculpted Cockpit Dock
- Unified single-tier floating frosted glass dock (`rounded-2xl`, `backdrop-blur-2xl`, 1px border).
- Central elevated 56px Coral Emergency Camera Beacon (`#nav-sos-button`) seamlessly rising from the dock contour.
- 4 balanced wing tabs (`Feed`, `Rafa AI`, `Clinics`, `Settings`) with $\ge 44\text{px}$ touch targets.

