// Display labels for case fields. Pure: shared by web and the mobile app.
// Feed filters match on these strings, so change them together with matchesChannel.

export function animalLabel(animalType?: string | null): string {
  if (animalType === 'dog') return 'Injured Dog';
  if (animalType === 'cat') return 'Injured Cat';
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
      return 'Trapped in storm drain';
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
