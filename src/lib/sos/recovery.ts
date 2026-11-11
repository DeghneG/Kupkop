/**
 * Recovery documentation: the optional details a clinic attaches to an update.
 * Pure logic, shared by the web app, the demo and tests. No DOM imports.
 */

export interface UpdateDetails {
  treatment?: string | null;
  medication?: string | null;
  weight_kg?: number | string | null;
  next_checkup_on?: string | null;
}

export const RECOVERY_LIMITS = { text: 200, weightMaxKg: 120, checkupDays: 365 } as const;

/** Labelled lines to show under an update; empty ones are skipped. */
export function detailLines(d: UpdateDetails): { label: string; value: string }[] {
  const lines: { label: string; value: string }[] = [];
  if (d.treatment?.trim()) lines.push({ label: 'Treatment', value: d.treatment.trim() });
  if (d.medication?.trim()) lines.push({ label: 'Medication', value: d.medication.trim() });
  const weight = d.weight_kg == null || d.weight_kg === '' ? null : Number(d.weight_kg);
  if (weight != null && Number.isFinite(weight) && weight > 0) lines.push({ label: 'Weight', value: `${+weight.toFixed(2)} kg` });
  if (d.next_checkup_on) {
    const when = new Date(`${d.next_checkup_on}T00:00:00`);
    if (!Number.isNaN(when.getTime())) {
      lines.push({ label: 'Next check-up', value: when.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) });
    }
  }
  return lines;
}

/** Why the details are not acceptable, or null when they are fine. Mirrors post_recovery_update() in SQL. */
export function detailsError(d: UpdateDetails, today: Date = new Date()): string | null {
  const { text, weightMaxKg, checkupDays } = RECOVERY_LIMITS;
  for (const v of [d.treatment, d.medication]) {
    if (v && (v.trim().length > text || /[<>]/.test(v))) return `Treatment and medication: up to ${text} characters, no < or >`;
  }
  if (d.weight_kg != null && d.weight_kg !== '') {
    const w = Number(d.weight_kg);
    if (!Number.isFinite(w) || w <= 0 || w > weightMaxKg) return `Weight must be between 0 and ${weightMaxKg} kg`;
  }
  if (d.next_checkup_on) {
    const when = new Date(`${d.next_checkup_on}T00:00:00`);
    const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const last = new Date(start.getTime() + checkupDays * 86_400_000);
    if (Number.isNaN(when.getTime()) || when < start || when > last) return 'The next check-up must be within the next year';
  }
  return null;
}
