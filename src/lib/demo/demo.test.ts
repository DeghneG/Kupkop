import { beforeEach, describe, expect, it } from 'vitest';
import { DEMO_CLINIC_ID, demoRpc, resetDemo, seedDemo, setDemoOn } from './demo';

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
    // The flow tests below play on the sample cases (an animal in every stage); the app itself starts empty
    resetDemo(true);
  });

  it('the app starts with the three clinics and no cases', () => {
    resetDemo();
    const d = read();
    expect(d.clinics).toHaveLength(3);
    expect(d.reports).toHaveLength(0);
    expect(d.updates).toHaveLength(0);
  });

  it('the sample cases cover three clinics and an animal in every stage', () => {
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

  it('a recovery update can carry a photo and details; bad details are refused', () => {
    demoRpc('claim_sos_report', { p_report_id: 'demo-f01' });
    demoRpc('admit_to_facility', { p_report_id: 'demo-f01', p_facility_id: DEMO_CLINIC_ID });
    const base = { p_report_id: 'demo-f01', p_notes: 'X-ray shows a clean break', p_state: 'healing' };
    expect(demoRpc('post_recovery_update', { ...base, p_weight_kg: 500 }).data?.success).toBe(false);
    expect(demoRpc('post_recovery_update', { ...base, p_treatment: '<b>x</b>' }).data?.success).toBe(false);
    expect(demoRpc('post_recovery_update', { ...base, p_photo_path: 'someone-elses/photo.jpg' }).data?.success).toBe(false);
    expect(report('demo-f01').state).toBe('admitted');
    const ok = demoRpc('post_recovery_update', {
      ...base,
      p_photo_path: 'data:image/jpeg;base64,AAAA',
      p_treatment: 'Cast on left leg',
      p_medication: 'Amoxicillin',
      p_weight_kg: 7.5,
      p_next_checkup_on: null,
    });
    expect(ok.data?.success).toBe(true);
    const posted = read().updates.filter((u) => u.report_id === 'demo-f01').at(-1);
    expect(posted?.treatment).toBe('Cast on left leg');
    expect(posted?.weight_kg).toBe(7.5);
    expect(posted?.photo_url).toBe('data:image/jpeg;base64,AAAA');
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

  it('a citizen report starts the flow: it lands at the top, as the citizen’s own, and can be claimed', () => {
    const args = { p_animal_type: 'dog', p_emergency_type: 'hit_and_run', p_latitude: 14.6335, p_longitude: 121.1015, p_location_name: 'Marcos Highway', p_description: 'Dog hit by a motorbike', p_photo: 'data:image/webp;base64,AAAA' };
    expect(demoRpc('create_report', { ...args, p_animal_type: 'horse' }).data?.success).toBe(false);
    expect(demoRpc('create_report', { ...args, p_latitude: NaN }).data?.success).toBe(false);
    expect(demoRpc('create_report', { ...args, p_description: '<b>' }).data?.success).toBe(false);
    expect(demoRpc('create_report', { ...args, p_photo: 'https://example.com/x.jpg' }).data?.success).toBe(false);
    const made = demoRpc('create_report', args);
    expect(made.data?.success).toBe(true);
    const created = read().reports[0];
    expect(created.id).toBe(made.data?.report_id);
    expect(created.state).toBe('reported');
    expect(created.urgency).toBe('critical');
    expect(created.reporter_id).toBe('demo-citizen');
    expect(demoRpc('claim_sos_report', { p_report_id: created.id }).data?.success).toBe(true);
  });

  it('clinic staff can edit the details; bad input is refused', () => {
    const args = { p_facility_id: DEMO_CLINIC_ID, p_address: '1 New Street, Marikina', p_phone: '0917 000 0000', p_hours: 'Mon to Sat, 8am to 6pm', p_about: 'Bring a carrier.' };
    expect(demoRpc('update_clinic_details', args).data?.success).toBe(true);
    const clinic = read().clinics.find((c) => c.id === DEMO_CLINIC_ID);
    expect(clinic?.address).toBe('1 New Street, Marikina');
    expect(clinic?.hours).toBe('Mon to Sat, 8am to 6pm');
    expect(demoRpc('update_clinic_details', { ...args, p_about: '<script>' }).data?.success).toBe(false);
    expect(demoRpc('update_clinic_details', { ...args, p_address: 'x' }).data?.success).toBe(false);
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
