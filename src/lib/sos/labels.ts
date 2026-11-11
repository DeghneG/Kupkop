// Display labels for case fields. Pure: shared by web and the mobile app.
// Feed filters match on these strings, so change them together with matchesChannel.

/** Plain-text name for an "other" animal, or null when it is not usable. Mirrors sos_reports_animal_other_check in SQL. */
export function cleanAnimalOther(value?: string | null): string | null {
  const v = (value ?? '').trim().replace(/\s+/g, ' ');
  return v.length >= 2 && v.length <= 30 && !/[<>]/.test(v) ? v : null;
}

/** "Injured Dog", or for an "other" animal the reporter named: "Injured Guinea Pig". */
export function animalLabel(animalType?: string | null, animalOther?: string | null): string {
  if (animalType === 'dog') return 'Injured Dog';
  if (animalType === 'cat') return 'Injured Cat';
  const named = animalType === 'other' ? cleanAnimalOther(animalOther) : null;
  if (named) return `Injured ${named.replace(/(^|\s)\p{L}/gu, (m) => m.toUpperCase())}`;
  return 'Injured Animal';
}

export function emergencyLabel(emergencyType?: string | null): string {
  switch (emergencyType) {
    case 'hit_and_run':
      return 'Hit-and-run · Critical';
    case 'bleeding':
      return 'Bleeding · Critical';
    case 'fracture':
      return 'Fracture / Limping';
    case 'trapped_abused':
      return 'Trapped / Abused';
    case 'sick_mange':
      return 'Sick / Severe Mange';
    default:
      return 'Emergency';
  }
}

export const CARE_STATE_LABELS = {
  admitted: 'Admitted',
  healing: 'Healing',
  resolved: 'Released / resolved',
} as const;

export const FLAG_REASON_LABELS = {
  fake: 'Fake or prank report',
  duplicate: 'Duplicate of another case',
  abuse: 'Abusive photo or text',
  other: 'Something else',
} as const;

/** A date with its time, so every step of a story shows when it happened: "Nov 11, 2026 · 2:35 PM" (year optional). */
export function formatWhen(iso: string, withYear = true): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const day = d.toLocaleDateString(undefined, withYear ? { month: 'short', day: 'numeric', year: 'numeric' } : { month: 'short', day: 'numeric' });
  const time = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  return `${day} · ${time}`;
}
