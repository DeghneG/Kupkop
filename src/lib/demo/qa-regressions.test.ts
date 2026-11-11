import { beforeEach, describe, expect, it } from 'vitest';
import { claimLockEndsAt } from '@/lib/sos/escalation';
import { demoRpc, setDemoOn, type DemoData } from './demo';

function installBrowser() {
  const store = new Map<string, string>();
  const g = globalThis as unknown as Record<string, unknown>;
  g.window = { dispatchEvent: () => true, addEventListener: () => {}, removeEventListener: () => {} };
  g.localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  };
}

const read = () => JSON.parse(localStorage.getItem('kupkop-demo-data')!) as DemoData;
const minutesHeld = (id: string) => {
  const r = read().reports.find((x) => x.id === id)!;
  return ((claimLockEndsAt(r.claimed_at, r.emergency_type, r.checkin_kind, r.heads_up_response === 'expecting') ?? 0) - Date.now()) / 60_000;
};
const newCase = () => {
  const res = demoRpc('create_report', { p_animal_type: 'dog', p_emergency_type: 'hit_and_run', p_latitude: 14.63, p_longitude: 121.1 });
  expect(res.data?.success).toBe(true);
  return res.data!.report_id as string;
};

// QA review (D-056): a case handed back to a rescuer must not land in the one-minute "tap On my way" window
describe('assigned and sent-back cases hold on the severity lock', () => {
  beforeEach(() => {
    installBrowser();
    setDemoOn(true);
  });

  it('an admin-assigned volunteer has the full 15-minute lock, not one minute', () => {
    const id = newCase();
    expect(demoRpc('admin_assign_claim', { p_report_id: id, p_volunteer_id: 'demo-user' }).data?.success).toBe(true);
    expect(minutesHeld(id)).toBeGreaterThan(14);
  });

  it('a rescuer sent back by the clinic keeps the case on the full lock', () => {
    const id = newCase();
    // An admin admits directly (the path that still waits for the clinic's intake confirmation), then the clinic declines
    localStorage.setItem('kupkop-view-as', 'admin');
    expect(demoRpc('claim_sos_report', { p_report_id: id }).data?.success).toBe(true);
    const clinic = read().clinics[0].id;
    expect(demoRpc('admit_to_facility', { p_report_id: id, p_facility_id: clinic }).data?.success).toBe(true);
    expect(demoRpc('decline_admission', { p_report_id: id, p_reason: 'No space in the ward' }).data?.success).toBe(true);
    expect(read().reports.find((r) => r.id === id)!.state).toBe('claimed');
    expect(minutesHeld(id)).toBeGreaterThan(14);
  });
});
