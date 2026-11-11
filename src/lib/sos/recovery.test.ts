import { describe, expect, it } from 'vitest';
import { detailLines, detailsError } from './recovery';

describe('recovery documentation', () => {
  it('lists only the details that were filled in', () => {
    expect(detailLines({})).toEqual([]);
    const lines = detailLines({ treatment: ' Cast on left leg ', medication: '', weight_kg: '7.5', next_checkup_on: null });
    expect(lines).toEqual([
      { label: 'Treatment', value: 'Cast on left leg' },
      { label: 'Weight', value: '7.5 kg' },
    ]);
  });

  it('refuses markup, absurd weights and check-ups in the past or too far ahead', () => {
    const today = new Date(2026, 10, 11);
    expect(detailsError({ treatment: '<b>x</b>' }, today)).not.toBeNull();
    expect(detailsError({ weight_kg: 0 }, today)).not.toBeNull();
    expect(detailsError({ weight_kg: 500 }, today)).not.toBeNull();
    expect(detailsError({ next_checkup_on: '2026-11-10' }, today)).not.toBeNull();
    expect(detailsError({ next_checkup_on: '2028-01-01' }, today)).not.toBeNull();
    expect(detailsError({ treatment: 'Cast', weight_kg: 7.5, next_checkup_on: '2026-11-18' }, today)).toBeNull();
    expect(detailsError({}, today)).toBeNull();
  });
});
