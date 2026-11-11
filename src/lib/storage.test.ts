import { describe, expect, it } from 'vitest';
import { resolveViewAs } from './storage';

describe('resolveViewAs', () => {
  it('a pane of the three-screen demo keeps its own role over the shared preview role', () => {
    expect(resolveViewAs('citizen', 'admin')).toBe('citizen');
    expect(resolveViewAs('facility', null)).toBe('facility');
  });
  it('falls back to the shared preview role, and to no preview', () => {
    expect(resolveViewAs(null, 'volunteer')).toBe('volunteer');
    expect(resolveViewAs('nonsense', 'admin')).toBe('admin');
    expect(resolveViewAs(null, 'nonsense')).toBeNull();
    expect(resolveViewAs(null, null)).toBeNull();
  });
});
