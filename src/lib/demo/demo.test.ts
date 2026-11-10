import { beforeEach, describe, expect, it } from 'vitest';
import { DEMO_CLINIC_ID, demoRpc, seedDemo, setDemoOn } from './demo';

// A tiny in-memory browser, so the demo engine runs under Node
function installBrowser() {
  const store = new Map<string, string>();
  const g = globalThis as unknown as Record<string, unknown>;
  g.window = { dispatchEvent: () => true, addEventListener: () => {}, removeEventListener: () => {} };
  g.localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  };
  return store;
}

const read = () => JSON.parse(localStorage.getItem('kupkop-demo-data')!) as ReturnType<typeof seedDemo>;
const report = (id: string) => read().reports.find((r) => r.id === id)!;

describe('demo mode plays the whole flow', () => {
  beforeEach(() => {
    installBrowser();
    setDemoOn(true);
  });

  it('seeds fresh cases, three clinics and an animal in every stage', () => {
    const d = read();
    expect(d.clinics).toHaveLength(3);
    expect(d.reports.filter((r) => r.state === 'reported')).toHaveLength(7);
    expect(d.reports.some((r) => r.state === 'healing')).toBe(true);
    expect(d.reports.some((r) => r.state === 'resolved')).toBe(true);
    expect(localStorage.getItem('kupkop-view-as')).toBe('volunteer');
  });

  it('claim, check in, tell a clinic, admit, confirm, update and resolve', () => {
    // Claim: a critical case locks for 15 minutes
    const claim = demoRpc('claim_sos_report', { p_report_id: 'demo-f01' });
    expect(claim.data?.success).toBe(true);
    expect(claim.data?.lock_duration_minutes).toBe(15);
    expect(report('demo-f01').state).toBe('claimed');

    // One active rescue at a time
    expect(demoRpc('claim_sos_report', { p_report_id: 'demo-f04' }).data?.success).toBe(false);

    // Check-ins restart the lock, once each
    expect(demoRpc('claim_checkin', { p_report_id: 'demo-f01', p_kind: 'on_my_way' }).data?.success).toBe(true);
    expect(demoRpc('claim_checkin', { p_report_id: 'demo-f01', p_kind: 'on_my_way' }).data?.success).toBe(false);

    // A full clinic cannot be told; an open one can, and answers
    expect(demoRpc('send_clinic_heads_up', { p_report_id: 'demo-f01', p_facility_id: 'demo-clinic-pasig', p_eta_minutes: 10 }).data?.success).toBe(false);
    expect(demoRpc('send_clinic_heads_up', { p_report_id: 'demo-f01', p_facility_id: DEMO_CLINIC_ID, p_eta_minutes: 10 }).data?.success).toBe(true);
    expect(demoRpc('respond_to_heads_up', { p_report_id: 'demo-f01', p_response: 'expecting', p_note: null }).data?.success).toBe(true);
    expect(report('demo-f01').heads_up_response).toBe('expecting');

    // Admit: the heads-up and check-in clear, the first update is recorded
    expect(demoRpc('admit_to_facility', { p_report_id: 'demo-f01', p_facility_id: DEMO_CLINIC_ID }).data?.success).toBe(true);
    const admitted = report('demo-f01');
    expect(admitted.state).toBe('admitted');
    expect(admitted.heads_up_facility_id).toBeNull();
    expect(admitted.checkin_kind).toBeNull();
    expect(read().updates.filter((u) => u.report_id === 'demo-f01')).toHaveLength(1);

    // The clinic confirms, once
    expect(demoRpc('confirm_intake', { p_report_id: 'demo-f01' }).data?.success).toBe(true);
    expect(demoRpc('confirm_intake', { p_report_id: 'demo-f01' }).data?.success).toBe(false);

    // Updates need a real note; healing never goes back to admitted
    expect(demoRpc('post_recovery_update', { p_report_id: 'demo-f01', p_notes: 'ok', p_state: 'healing' }).data?.success).toBe(false);
    expect(demoRpc('post_recovery_update', { p_report_id: 'demo-f01', p_notes: 'Eating well and walking', p_state: 'healing' }).data?.success).toBe(true);
    expect(demoRpc('post_recovery_update', { p_report_id: 'demo-f01', p_notes: 'Back to admitted?', p_state: 'admitted' }).data?.success).toBe(false);
    expect(demoRpc('post_recovery_update', { p_report_id: 'demo-f01', p_notes: 'Healthy, released today', p_state: 'resolved' }).data?.success).toBe(true);
    expect(report('demo-f01').state).toBe('resolved');
  });

  it('a clinic that cannot take the animal sends it back to the rescuer', () => {
    demoRpc('claim_sos_report', { p_report_id: 'demo-f02' });
    demoRpc('admit_to_facility', { p_report_id: 'demo-f02', p_facility_id: DEMO_CLINIC_ID });
    expect(demoRpc('decline_admission', { p_report_id: 'demo-f02', p_reason: '' }).data?.success).toBe(false);
    expect(demoRpc('decline_admission', { p_report_id: 'demo-f02', p_reason: 'No space in the ward' }).data?.success).toBe(true);
    const back = report('demo-f02');
    expect(back.state).toBe('claimed');
    expect(back.facility_id).toBeNull();
  });

  it('a clinic that sets itself Full is refused a heads-up', () => {
    demoRpc('claim_sos_report', { p_report_id: 'demo-f01' });
    expect(demoRpc('set_clinic_availability', { p_facility_id: DEMO_CLINIC_ID, p_status: 'full' }).data?.success).toBe(true);
    expect(demoRpc('send_clinic_heads_up', { p_report_id: 'demo-f01', p_facility_id: DEMO_CLINIC_ID, p_eta_minutes: 5 }).data?.success).toBe(false);
  });

  it('standby: join someone else’s claim, never your own, and leave again', () => {
    expect(demoRpc('join_standby', { p_report_id: 'demo-f05' }).data?.success).toBe(true);
    expect(read().standby).toHaveLength(1);
    expect(demoRpc('leave_standby', { p_report_id: 'demo-f05' }).data?.success).toBe(true);
    expect(read().standby).toHaveLength(0);
    demoRpc('claim_sos_report', { p_report_id: 'demo-f01' });
    expect(demoRpc('join_standby', { p_report_id: 'demo-f01' }).data?.success).toBe(false);
  });

  it('release returns the case to the list, and naming works', () => {
    demoRpc('claim_sos_report', { p_report_id: 'demo-f03' });
    expect(demoRpc('release_sos_claim', { p_report_id: 'demo-f03' }).data?.success).toBe(true);
    expect(report('demo-f03').state).toBe('reported');
    expect(demoRpc('set_animal_name', { p_report_id: 'demo-c02', p_name: 'Whiskers' }).data?.success).toBe(true);
    expect(report('demo-c02').animal_name).toBe('Whiskers');
    expect(demoRpc('set_animal_name', { p_report_id: 'demo-c02', p_name: '<b>' }).data?.success).toBe(false);
  });

  it('admin actions: assign a volunteer, close a false report', () => {
    expect(demoRpc('admin_assign_claim', { p_report_id: 'demo-f04', p_volunteer_id: 'demo-user' }).data?.success).toBe(true);
    expect(report('demo-f04').state).toBe('claimed');
    expect(demoRpc('admin_hide_report', { p_report_id: 'demo-f03' }).data?.success).toBe(true);
    expect(report('demo-f03').hidden_at).not.toBeNull();
  });

  it('anything outside the demo says so instead of failing silently', () => {
    expect(demoRpc('review_role_application', { p_application_id: 'x', p_approve: true }).data?.success).toBe(false);
  });
});
