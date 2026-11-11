'use client';

/**
 * Demo mode: sample cases, clinics and the whole flow, played locally in this browser.
 * Nothing is read from or written to the database. One person plays every role by switching the preview bar.
 * The rules mirror the database functions (supabase/migrations) and reuse the shared pure logic.
 */
import { useSyncExternalStore } from 'react';
import { claimLockEndsAt, claimLockMinutes, ESCALATION_CONFIG } from '@/lib/sos/escalation';
import { effectiveAvailability } from '@/lib/sos/clinics';
import { claimPhase, canClaimNow } from '@/lib/sos/standby';
import { detailsError } from '@/lib/sos/recovery';
import { readViewAs } from '@/lib/storage';

export const DEMO_USER = 'demo-user';
/** Reports made through SOS in the demo belong to this citizen, so the volunteer is a different person */
export const DEMO_CITIZEN = 'demo-citizen';
/** The made-up spot every demo SOS report comes from (no frame asks for real location) */
export const DEMO_PLACE = { lat: 14.6335, lng: 121.1015, name: 'Marcos Highway, Marikina City (demo location)' };
const OTHER_USER = 'demo-other';
export const DEMO_CLINIC_ID = 'demo-clinic-marikina';
const KEY_ON = 'kupkop-demo-on';
const KEY_DATA = 'kupkop-demo-data';
const EVENT = 'kupkop-storage-change';

type CaseState = 'reported' | 'claimed' | 'admitted' | 'healing' | 'resolved';

export interface DemoReport {
  id: string;
  short_id: string;
  reporter_id: string;
  animal_type: 'dog' | 'cat' | 'other';
  emergency_type: string;
  urgency: string;
  state: CaseState;
  photo_url: string;
  latitude: number;
  longitude: number;
  location_name: string;
  description: string;
  claimed_by: string | null;
  claimed_at: string | null;
  facility_id: string | null;
  intake_confirmed_at: string | null;
  hidden_at: string | null;
  animal_name: string | null;
  checkin_kind: 'on_my_way' | 'arrived' | null;
  checkin_at: string | null;
  heads_up_facility_id: string | null;
  heads_up_eta_minutes: number | null;
  heads_up_at: string | null;
  heads_up_response: 'expecting' | 'cannot' | null;
  heads_up_response_at: string | null;
  heads_up_note: string | null;
  ai_graphic: boolean;
  created_at: string;
  updated_at: string;
  server_timestamp: string;
}

export interface DemoUpdate {
  id: string;
  report_id: string;
  notes: string;
  state: CaseState;
  created_at: string;
  /** A small data URL in the demo (the real app stores a path in the recovery-photos bucket) */
  photo_url?: string | null;
  treatment?: string | null;
  medication?: string | null;
  weight_kg?: number | null;
  next_checkup_on?: string | null;
}

export interface DemoClinic {
  id: string;
  name: string;
  address: string;
  phone: string;
  latitude: number;
  longitude: number;
  status: 'Listed';
  last_active_at: string;
  availability: 'open' | 'limited' | 'full' | null;
  availability_set_at: string | null;
  hours?: string | null;
  about?: string | null;
}

export interface DemoStandby {
  report_id: string;
  volunteer_id: string;
  created_at: string;
}

export interface DemoData {
  reports: DemoReport[];
  updates: DemoUpdate[];
  clinics: DemoClinic[];
  standby: DemoStandby[];
}

const EMPTY: DemoData = { reports: [], updates: [], clinics: [], standby: [] };

// ---- storage -----------------------------------------------------------------------------------------------

function subscribe(callback: () => void) {
  window.addEventListener('storage', callback);
  window.addEventListener(EVENT, callback);
  return () => {
    window.removeEventListener('storage', callback);
    window.removeEventListener(EVENT, callback);
  };
}

function readRaw(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

let cachedRaw: string | null = null;
let cachedData: DemoData = EMPTY;

function snapshot(): DemoData {
  const raw = readRaw(KEY_DATA);
  if (raw === cachedRaw) return cachedData;
  cachedRaw = raw;
  try {
    cachedData = raw ? (JSON.parse(raw) as DemoData) : EMPTY;
  } catch {
    cachedData = EMPTY;
  }
  return cachedData;
}

function save(data: DemoData) {
  try {
    localStorage.setItem(KEY_DATA, JSON.stringify(data));
    window.dispatchEvent(new Event(EVENT));
  } catch (err) {
    console.warn('Could not save the demo', err);
  }
}

export function isDemoOn(): boolean {
  return typeof window !== 'undefined' && readRaw(KEY_ON) === '1';
}

/** True while demo mode is on. */
export function useDemoMode(): boolean {
  return useSyncExternalStore(subscribe, () => readRaw(KEY_ON) === '1', () => false);
}

/** The demo's data while demo mode is on, otherwise empty. */
export function useDemoData(): DemoData {
  const on = useDemoMode();
  const data = useSyncExternalStore(subscribe, snapshot, () => EMPTY);
  return on ? data : EMPTY;
}

export function setDemoOn(on: boolean) {
  try {
    if (on) {
      if (!readRaw(KEY_DATA)) save(seedDemo());
      localStorage.setItem(KEY_ON, '1');
      // Start as a volunteer so the Feed shows its buttons; switch roles with the preview bar
      if (!readRaw('kupkop-view-as')) localStorage.setItem('kupkop-view-as', 'volunteer');
    } else {
      localStorage.removeItem(KEY_ON);
    }
    window.dispatchEvent(new Event(EVENT));
  } catch (err) {
    console.warn('Could not change demo mode', err);
  }
}

/** Start the demo over: the three clinics and no cases, so the first report anyone files is the first case. */
export function resetDemo(withSamples = false) {
  save(seedDemo(withSamples));
}

function mutate<T>(change: (data: DemoData) => T): T {
  const data: DemoData = JSON.parse(JSON.stringify(snapshot() === EMPTY ? seedDemo() : snapshot()));
  const result = change(data);
  save(data);
  return result;
}

// ---- sample data -------------------------------------------------------------------------------------------

const ago = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();

function baseReport(over: Partial<DemoReport> & Pick<DemoReport, 'id' | 'short_id' | 'animal_type' | 'emergency_type' | 'latitude' | 'longitude' | 'location_name' | 'description'>, created: number): DemoReport {
  const critical = ['hit_and_run', 'bleeding'].includes(over.emergency_type);
  const urgent = ['fracture', 'trapped_abused'].includes(over.emergency_type);
  return {
    reporter_id: OTHER_USER,
    urgency: critical ? 'critical' : urgent ? 'urgent' : 'moderate',
    state: 'reported',
    photo_url: '',
    claimed_by: null,
    claimed_at: null,
    facility_id: null,
    intake_confirmed_at: null,
    hidden_at: null,
    animal_name: null,
    checkin_kind: null,
    checkin_at: null,
    heads_up_facility_id: null,
    heads_up_eta_minutes: null,
    heads_up_at: null,
    heads_up_response: null,
    heads_up_response_at: null,
    heads_up_note: null,
    ai_graphic: false,
    created_at: ago(created),
    updated_at: ago(created),
    server_timestamp: ago(created),
    ...over,
  };
}

/**
 * The demo starts with the three clinics and no cases. The made-up sample cases (an animal in every stage) are kept
 * only for the unit tests, which ask for them with withSamples = true; the app never does.
 */
export function seedDemo(withSamples = false): DemoData {
  const clinics: DemoClinic[] = [
    { id: DEMO_CLINIC_ID, name: 'Sample Animal Clinic (Marikina)', address: 'Marcos Highway, Marikina City', phone: '0000-100-0001', latitude: 14.633, longitude: 121.102, status: 'Listed', last_active_at: ago(60), availability: 'open', availability_set_at: ago(10) },
    { id: 'demo-clinic-makati', name: 'Sample Vet Hospital (Makati)', address: 'Pasong Tamo Extension, Makati City', phone: '0000-100-0002', latitude: 14.5547, longitude: 121.0244, status: 'Listed', last_active_at: ago(60 * 24 * 3), availability: 'open', availability_set_at: ago(10) },
    { id: 'demo-clinic-pasig', name: 'Sample Rescue Shelter (Pasig)', address: 'Ortigas Avenue Extension, Pasig City', phone: '0000-100-0003', latitude: 14.5866, longitude: 121.083, status: 'Listed', last_active_at: ago(60 * 24 * 5), availability: 'full', availability_set_at: ago(20) },
  ];

  const reports: DemoReport[] = [
    // Waiting for a rescuer
    baseReport({ id: 'demo-f01', short_id: 'KK-F01', animal_type: 'dog', emergency_type: 'hit_and_run', latitude: 14.6385, longitude: 121.099, location_name: 'Sumulong Highway, Marikina', description: 'Brown dog lying beside the road after a motorcycle hit it.' }, 1),
    baseReport({ id: 'demo-f02', short_id: 'KK-F02', animal_type: 'cat', emergency_type: 'fracture', latitude: 14.5575, longitude: 121.021, location_name: 'Chino Roces Ave, Makati', description: 'Grey cat holding up a front leg, hiding under a tricycle.' }, 6),
    baseReport({ id: 'demo-f03', short_id: 'KK-F03', animal_type: 'dog', emergency_type: 'sick_mange', latitude: 14.587, longitude: 121.0845, location_name: 'Kapitolyo, Pasig', description: 'Thin dog with bald, crusty skin near the food stalls.' }, 20),
    baseReport({ id: 'demo-f04', short_id: 'KK-F04', animal_type: 'cat', emergency_type: 'bleeding', latitude: 14.632, longitude: 121.104, location_name: 'Marcos Hwy near SM Marikina', description: 'Cat with a bleeding ear and a cut on its side, very weak.' }, 12),
    // More injured dogs to play with
    baseReport({ id: 'demo-f06', short_id: 'KK-F06', animal_type: 'dog', emergency_type: 'trapped_abused', latitude: 14.6507, longitude: 121.0495, location_name: 'Visayas Ave, Quezon City', description: 'Small black dog stuck in a drainage pipe, whining and not moving.' }, 3),
    baseReport({ id: 'demo-f07', short_id: 'KK-F07', animal_type: 'dog', emergency_type: 'bleeding', latitude: 14.6091, longitude: 121.0223, location_name: 'España Blvd, Manila', description: 'White dog with a deep cut on its shoulder, leaving blood on the sidewalk.' }, 9),
    baseReport({ id: 'demo-f08', short_id: 'KK-F08', animal_type: 'dog', emergency_type: 'fracture', latitude: 14.5995, longitude: 121.0361, location_name: 'Shaw Blvd, Mandaluyong', description: 'Golden dog with a swollen hind leg, will not put it down.' }, 30),
    // Claimed by someone else; its 15-minute lock ends in about a minute
    baseReport({ id: 'demo-f05', short_id: 'KK-F05', animal_type: 'dog', emergency_type: 'hit_and_run', latitude: 14.56, longitude: 121.0215, location_name: 'EDSA Buendia flyover, Makati', description: 'Dog dragging its back legs across the lane.', state: 'claimed', claimed_by: OTHER_USER, claimed_at: ago(14) }, 16),
    // In care at Marikina: a dog healing, a cat just brought in
    baseReport({ id: 'demo-c01', short_id: 'KK-C01', animal_type: 'dog', emergency_type: 'fracture', latitude: 14.6401, longitude: 121.0985, location_name: 'Sumulong Highway, Marikina', description: 'Brown dog dragging a hind leg near the market.', state: 'healing', claimed_by: OTHER_USER, claimed_at: ago(60 * 48), facility_id: DEMO_CLINIC_ID, intake_confirmed_at: ago(60 * 48 - 40), animal_name: 'Max' }, 60 * 48 + 20),
    baseReport({ id: 'demo-c02', short_id: 'KK-C02', animal_type: 'cat', emergency_type: 'sick_mange', latitude: 14.6288, longitude: 121.095, location_name: 'Gil Fernando Ave, Marikina', description: 'Thin grey cat with bald patches, sneezing.', state: 'admitted', claimed_by: OTHER_USER, claimed_at: ago(35), facility_id: DEMO_CLINIC_ID }, 50),
    // Resolved at Pasig 10 hours ago
    baseReport({ id: 'demo-c03', short_id: 'KK-C03', animal_type: 'dog', emergency_type: 'trapped_abused', latitude: 14.584, longitude: 121.087, location_name: 'Shaw Blvd near Kapitolyo, Pasig', description: 'Puppy tied up behind a shop with a rope cutting into its neck.', state: 'resolved', claimed_by: OTHER_USER, claimed_at: ago(60 * 24 * 9), facility_id: 'demo-clinic-pasig', intake_confirmed_at: ago(60 * 24 * 9 - 45), animal_name: 'Daisy', updated_at: ago(60 * 10) }, 60 * 24 * 9 + 5),
  ];

  const u = (n: string, report: string, notes: string, state: CaseState, minutes: number): DemoUpdate => ({ id: `demo-u-${n}`, report_id: report, notes, state, created_at: ago(minutes) });
  const updates: DemoUpdate[] = [
    u('1a', 'demo-c01', 'Brought to Sample Animal Clinic (Marikina). Waiting for the clinic to confirm.', 'admitted', 60 * 48),
    u('1b', 'demo-c01', 'The clinic confirmed the animal arrived.', 'admitted', 60 * 48 - 40),
    u('1c', 'demo-c01', 'X-ray shows a clean break. Cast on, eating and drinking well.', 'healing', 60 * 24),
    u('2a', 'demo-c02', 'Brought to Sample Animal Clinic (Marikina). Waiting for the clinic to confirm.', 'admitted', 6),
    u('3a', 'demo-c03', 'Brought to Sample Rescue Shelter (Pasig). Waiting for the clinic to confirm.', 'admitted', 60 * 24 * 9),
    u('3b', 'demo-c03', 'The clinic confirmed the animal arrived.', 'admitted', 60 * 24 * 9 - 45),
    u('3c', 'demo-c03', 'Neck wound treated, vaccinated, gaining weight.', 'healing', 60 * 24 * 6),
    u('3d', 'demo-c03', 'Healthy and friendly. Adopted by a family nearby.', 'resolved', 60 * 10),
  ];

  return { reports: withSamples ? reports : [], updates: withSamples ? updates : [], clinics, standby: [] };
}

// ---- the rules, played locally ----------------------------------------------------------------------------

export interface DemoRpcResult {
  data: { success?: boolean; error?: string; [key: string]: unknown } | null;
  error: { message: string } | null;
}

const ok = (extra: Record<string, unknown> = {}): DemoRpcResult => ({ data: { success: true, ...extra }, error: null });
const fail = (message: string): DemoRpcResult => ({ data: { success: false, error: message }, error: null });

const viewingAsAdmin = () => readViewAs() === 'admin';

/** Anything that leaves the "on the way" stage clears the check-in and the heads-up, like the database trigger. */
function clearExtras(r: DemoReport) {
  r.checkin_kind = null;
  r.checkin_at = null;
  r.heads_up_facility_id = null;
  r.heads_up_eta_minutes = null;
  r.heads_up_at = null;
  r.heads_up_response = null;
  r.heads_up_response_at = null;
  r.heads_up_note = null;
}

let counter = 0;
const nextId = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${counter++}`;

export function demoRpc(fn: string, args: Record<string, unknown>): DemoRpcResult {
  const reportId = args.p_report_id as string | undefined;
  const now = new Date().toISOString();
  const nowMs = Date.now();

  return mutate((d): DemoRpcResult => {
    const r = reportId ? d.reports.find((x) => x.id === reportId) : undefined;
    const needReport = () => (r ? null : fail('Report not found'));
    const clinicName = (id: string | null) => d.clinics.find((c) => c.id === id)?.name ?? 'the clinic';

    switch (fn) {
      case 'create_report': {
        const animal = args.p_animal_type as string;
        const emergency = args.p_emergency_type as string;
        if (!['dog', 'cat', 'other'].includes(animal)) return fail('Choose the animal');
        if (!['hit_and_run', 'bleeding', 'fracture', 'trapped_abused', 'sick_mange'].includes(emergency)) return fail('Choose the emergency');
        const lat = Number(args.p_latitude);
        const lng = Number(args.p_longitude);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return fail('A real location is needed to send a report');
        const text = (v: unknown) => ((v as string | null | undefined) ?? '').trim();
        const description = text(args.p_description).slice(0, 500);
        if (/[<>]/.test(description)) return fail('Use plain words in the description (no < or >)');
        const photo = text(args.p_photo);
        if (photo && !photo.startsWith('data:image/')) return fail('The demo photo must be the fake frame');
        let shortId = '';
        do {
          shortId = 'KK-' + Math.random().toString(36).slice(2, 6).toUpperCase();
        } while (d.reports.some((x) => x.short_id === shortId));
        const report = baseReport(
          { id: nextId('demo-r'), short_id: shortId, animal_type: animal as DemoReport['animal_type'], emergency_type: emergency, latitude: lat, longitude: lng, location_name: text(args.p_location_name) || DEMO_PLACE.name, description, reporter_id: DEMO_CITIZEN, photo_url: photo },
          0
        );
        report.created_at = now;
        report.updated_at = now;
        report.server_timestamp = now;
        d.reports.unshift(report);
        return ok({ report_id: report.id, short_id: shortId, server_timestamp: now });
      }

      case 'claim_sos_report': {
        if (needReport()) return needReport()!;
        const report = r!;
        if (report.state !== 'reported' && report.state !== 'claimed') return fail('This case is already past the claim stage');
        if (!viewingAsAdmin()) {
          const holding = d.reports.find(
            (x) => x.id !== report.id && x.state === 'claimed' && x.claimed_by === DEMO_USER && (claimLockEndsAt(x.claimed_at, x.emergency_type) ?? 0) > nowMs
          );
          if (holding) return fail('You already have an active rescue. Admit or release it first.');
        }
        const lock = claimLockMinutes(report.emergency_type);
        if (report.state === 'claimed' && report.claimed_by && report.claimed_by !== DEMO_USER && (claimLockEndsAt(report.claimed_at, report.emergency_type) ?? 0) > nowMs) {
          return fail('Already claimed by another rescuer');
        }
        const standby = d.standby.filter((s) => s.report_id === report.id).map((s) => ({ volunteerId: s.volunteer_id, joinedAt: s.created_at }));
        if (report.claimed_by !== DEMO_USER) {
          const phase = claimPhase({ state: report.state, claimedAt: report.claimed_at, type: report.emergency_type, releasedAt: report.updated_at, standby });
          if (!canClaimNow(phase, DEMO_USER)) return fail('This case is held for the next volunteer in line for a moment.');
        }
        if (report.claimed_by !== DEMO_USER) clearExtras(report);
        report.state = 'claimed';
        report.claimed_by = DEMO_USER;
        report.claimed_at = now;
        report.updated_at = now;
        d.standby = d.standby.filter((s) => s.volunteer_id !== DEMO_USER);
        return ok({ report_id: report.id, claimed_by: DEMO_USER, claimed_at: now, lock_duration_minutes: lock });
      }

      case 'release_sos_claim': {
        if (needReport()) return needReport()!;
        if (r!.state !== 'claimed') return fail('Only a claimed case can be released');
        if (r!.claimed_by !== DEMO_USER && !viewingAsAdmin()) return fail('You did not claim this rescue');
        r!.state = 'reported';
        r!.claimed_by = null;
        r!.claimed_at = null;
        r!.updated_at = now;
        clearExtras(r!);
        return ok({ report_id: r!.id, state: 'reported' });
      }

      case 'claim_checkin': {
        if (needReport()) return needReport()!;
        const kind = args.p_kind as 'on_my_way' | 'arrived';
        if (r!.state !== 'claimed' || r!.claimed_by !== DEMO_USER) return fail('Only the rescuer who claimed this case can check in');
        if (r!.checkin_kind === 'arrived' || r!.checkin_kind === kind) return fail('You already checked in for this step');
        r!.claimed_at = now;
        r!.checkin_kind = kind;
        r!.checkin_at = now;
        r!.updated_at = now;
        return ok({ claimed_at: now, lock_duration_minutes: claimLockMinutes(r!.emergency_type) });
      }

      case 'join_standby': {
        if (needReport()) return needReport()!;
        if (r!.state !== 'claimed') return fail('Only a claimed case has a standby list');
        if (r!.claimed_by === DEMO_USER) return fail('This is your own rescue');
        if ((claimLockEndsAt(r!.claimed_at, r!.emergency_type) ?? 0) <= nowMs) return fail('The lock has ended. You can claim this case now.');
        const mine = d.standby.filter((s) => s.volunteer_id === DEMO_USER && s.report_id !== r!.id && d.reports.find((x) => x.id === s.report_id)?.state === 'claimed');
        if (mine.length >= ESCALATION_CONFIG.maxStandbyCases) return fail('You are already on standby for 3 cases. Leave one first.');
        if (!d.standby.some((s) => s.report_id === r!.id && s.volunteer_id === DEMO_USER)) {
          d.standby.push({ report_id: r!.id, volunteer_id: DEMO_USER, created_at: now });
        }
        return ok();
      }

      case 'leave_standby': {
        d.standby = d.standby.filter((s) => !(s.report_id === reportId && s.volunteer_id === DEMO_USER));
        return ok();
      }

      case 'send_clinic_heads_up': {
        if (needReport()) return needReport()!;
        if (r!.state !== 'claimed') return fail('Only a claimed case can send a heads-up');
        const clinic = d.clinics.find((c) => c.id === args.p_facility_id);
        if (!clinic || clinic.status !== 'Listed') return fail('This clinic is not accepting animals right now');
        if (effectiveAvailability(clinic.availability, clinic.availability_set_at) === 'full') return fail(`${clinic.name} reported it is full. Choose another clinic.`);
        r!.heads_up_facility_id = clinic.id;
        r!.heads_up_eta_minutes = (args.p_eta_minutes as number | null) ?? null;
        r!.heads_up_at = now;
        r!.heads_up_response = null;
        r!.heads_up_response_at = null;
        r!.heads_up_note = null;
        r!.updated_at = now;
        return ok({ facility_id: clinic.id });
      }

      case 'respond_to_heads_up': {
        if (needReport()) return needReport()!;
        if (!r!.heads_up_facility_id) return fail('Only staff of the clinic that was told can answer');
        if (r!.state !== 'claimed') return fail('This case is no longer on the way');
        r!.heads_up_response = args.p_response as 'expecting' | 'cannot';
        r!.heads_up_response_at = now;
        r!.heads_up_note = ((args.p_note as string | null) ?? '').trim() || null;
        r!.updated_at = now;
        return ok();
      }

      case 'admit_to_facility': {
        if (needReport()) return needReport()!;
        if (r!.state !== 'claimed') return fail('Only a claimed case can be admitted');
        if (r!.claimed_by !== DEMO_USER && !viewingAsAdmin()) return fail('Only the rescuer who claimed this case can hand it off');
        const clinic = d.clinics.find((c) => c.id === args.p_facility_id);
        if (!clinic) return fail('Partner facility not found');
        if (clinic.status !== 'Listed') return fail('This clinic is paused and cannot receive animals right now');
        r!.state = 'admitted';
        r!.facility_id = clinic.id;
        r!.intake_confirmed_at = null;
        r!.updated_at = now;
        clearExtras(r!);
        d.standby = d.standby.filter((s) => s.report_id !== r!.id);
        clinic.last_active_at = now;
        d.updates.push({ id: nextId('demo-u'), report_id: r!.id, notes: `Brought to ${clinic.name}. Waiting for the clinic to confirm.`, state: 'admitted', created_at: now });
        return ok({ report_id: r!.id, facility_id: clinic.id, state: 'admitted', admitted_at: now });
      }

      case 'confirm_intake': {
        if (needReport()) return needReport()!;
        if (r!.state !== 'admitted' || r!.intake_confirmed_at) return fail('This case is not waiting for intake');
        r!.intake_confirmed_at = now;
        r!.updated_at = now;
        const clinic = d.clinics.find((c) => c.id === r!.facility_id);
        if (clinic) clinic.last_active_at = now;
        d.updates.push({ id: nextId('demo-u'), report_id: r!.id, notes: 'The clinic confirmed the animal arrived.', state: 'admitted', created_at: now });
        return ok();
      }

      case 'decline_admission': {
        if (needReport()) return needReport()!;
        if (r!.state !== 'admitted' || r!.intake_confirmed_at) return fail('Only an animal waiting for intake can be declined');
        const reason = ((args.p_reason as string) ?? '').trim();
        if (!reason) return fail('Say briefly why the clinic cannot take the animal');
        const name = clinicName(r!.facility_id);
        r!.state = 'claimed';
        r!.facility_id = null;
        r!.claimed_at = now;
        r!.intake_confirmed_at = null;
        r!.updated_at = now;
        d.updates.push({ id: nextId('demo-u'), report_id: r!.id, notes: `${name} could not accept the animal: ${reason}`, state: 'claimed', created_at: now });
        return ok({ claimed_by: r!.claimed_by });
      }

      case 'post_recovery_update': {
        if (needReport()) return needReport()!;
        const state = args.p_state as CaseState;
        const notes = ((args.p_notes as string) ?? '').trim();
        if (r!.state !== 'admitted' && r!.state !== 'healing') return fail('Updates can only be posted while the animal is in care');
        if (!['admitted', 'healing', 'resolved'].includes(state) || (r!.state === 'healing' && state === 'admitted')) return fail('That status change is not allowed');
        if (notes.length < 5) return fail('Write a short note on how the animal is doing (5+ characters)');
        const clean = (v: unknown) => ((v as string | null | undefined) ?? '').trim() || null;
        const weight = args.p_weight_kg == null || args.p_weight_kg === '' ? null : Number(args.p_weight_kg);
        const details = { treatment: clean(args.p_treatment), medication: clean(args.p_medication), weight_kg: weight, next_checkup_on: clean(args.p_next_checkup_on) };
        const detailProblem = detailsError(details);
        if (detailProblem) return fail(detailProblem);
        const photo = clean(args.p_photo_path);
        if (photo && !photo.startsWith('data:image/')) return fail('That photo does not belong to this case');
        d.updates.push({ id: nextId('demo-u'), report_id: r!.id, notes: notes.slice(0, 500), state, created_at: now, photo_url: photo, ...details });
        r!.state = state;
        r!.intake_confirmed_at = r!.intake_confirmed_at ?? now;
        r!.updated_at = now;
        const clinic = d.clinics.find((c) => c.id === r!.facility_id);
        if (clinic) clinic.last_active_at = now;
        return ok({ report_id: r!.id, state, posted_at: now });
      }

      case 'set_animal_name': {
        if (needReport()) return needReport()!;
        const name = ((args.p_name as string) ?? '').trim();
        if (name.length > 40 || /[<>]/.test(name)) return fail('Use a short name (up to 40 characters, no < or >)');
        r!.animal_name = name || null;
        r!.updated_at = now;
        return ok({ animal_name: r!.animal_name });
      }

      case 'set_clinic_availability': {
        const clinic = d.clinics.find((c) => c.id === args.p_facility_id);
        if (!clinic) return fail('Clinic not found');
        const status = args.p_status as 'open' | 'limited' | 'full';
        if (!['open', 'limited', 'full'].includes(status)) return fail('Status must be open, limited or full');
        clinic.availability = status;
        clinic.availability_set_at = now;
        return ok({ availability: status });
      }

      case 'update_clinic_details': {
        const clinic = d.clinics.find((c) => c.id === args.p_facility_id);
        if (!clinic) return fail('Clinic not found');
        const text = (v: unknown) => ((v as string | null | undefined) ?? '').trim();
        const address = text(args.p_address);
        const phone = text(args.p_phone);
        const hours = text(args.p_hours);
        const about = text(args.p_about);
        if (address.length < 3 || address.length > 200) return fail('Address must be 3 to 200 characters');
        if (phone.length > 30 || /[<>]/.test(phone)) return fail('Phone number is too long');
        if (hours.length > 200 || /[<>]/.test(hours)) return fail('Hours must be up to 200 characters, no < or >');
        if (about.length > 500 || /[<>]/.test(about)) return fail('The note must be up to 500 characters, no < or >');
        clinic.address = address;
        clinic.phone = phone;
        clinic.hours = hours || null;
        clinic.about = about || null;
        return ok({});
      }

      case 'admin_assign_claim': {
        if (needReport()) return needReport()!;
        if (r!.state !== 'reported' && r!.state !== 'claimed') return fail('This case is already past the claim stage');
        clearExtras(r!);
        r!.state = 'claimed';
        r!.claimed_by = DEMO_USER;
        r!.claimed_at = now;
        r!.updated_at = now;
        return ok({ claimed_by: DEMO_USER });
      }

      case 'admin_hide_report': {
        if (needReport()) return needReport()!;
        r!.hidden_at = now;
        r!.updated_at = now;
        d.standby = d.standby.filter((s) => s.report_id !== r!.id);
        return ok();
      }

      default:
        return fail('This action is not part of the demo.');
    }
  });
}
