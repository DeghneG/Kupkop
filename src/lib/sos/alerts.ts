/**
 * Who gets an SOS alert, and when. Pure: shared by the web scheduler and (later) the mobile app.
 * Timings come from ESCALATION_CONFIG (AGENTS.md):
 *   initial      at report time  -> responders whose alert area covers the report
 *   widened      at widenMinutes -> every volunteer and admin not alerted yet
 *   no_responder at alertMinutes -> admins
 */
import { ESCALATION_CONFIG, getEscalationTier } from './escalation';
import { distanceKm, type LatLng } from './geo';

export type AlertStage = 'initial' | 'widened' | 'no_responder';
export const ALERT_STAGES: AlertStage[] = ['initial', 'widened', 'no_responder'];

export interface AlertArea {
  userId: string;
  latitude: number;
  longitude: number;
  radiusKm: number;
}

/** The furthest stage a report has reached, or null before it exists. */
export function currentAlertStage(createdAt: string | Date, rawType: string | null | undefined, now = Date.now()): AlertStage {
  const config = ESCALATION_CONFIG[getEscalationTier(rawType)];
  const minutes = (now - new Date(createdAt).getTime()) / 60_000;
  if (minutes >= config.alertMinutes) return 'no_responder';
  if (minutes >= config.widenMinutes) return 'widened';
  return 'initial';
}

/**
 * Stages to act on now. A late scheduler sends only the newest stage (no burst of three alerts);
 * skipped stages are returned so the caller can record them as done.
 */
export function planAlertStages(
  current: AlertStage,
  alreadySent: AlertStage[]
): { send: AlertStage | null; skip: AlertStage[] } {
  const upTo = ALERT_STAGES.slice(0, ALERT_STAGES.indexOf(current) + 1);
  const pending = upTo.filter((stage) => !alreadySent.includes(stage));
  if (pending.length === 0) return { send: null, skip: [] };
  return { send: pending[pending.length - 1], skip: pending.slice(0, -1) };
}

/** Responders whose alert area covers the report location. */
export function usersInArea(report: LatLng, areas: AlertArea[]): string[] {
  return areas
    .filter((a) => distanceKm(report, { lat: a.latitude, lng: a.longitude }) <= a.radiusKm)
    .map((a) => a.userId);
}

export interface AlertTargets {
  volunteerIds: string[];
  adminIds: string[];
  areas: AlertArea[];
  reporterId: string | null;
}

/** People to alert for a stage. The reporter is never alerted about their own report. */
export function alertRecipients(stage: AlertStage, report: LatLng, t: AlertTargets): string[] {
  const responders = [...new Set([...t.volunteerIds, ...t.adminIds])];
  const responderSet = new Set(responders);
  const inArea = usersInArea(report, t.areas).filter((id) => responderSet.has(id));
  let ids: string[];
  if (stage === 'initial') ids = inArea;
  else if (stage === 'widened') ids = responders.filter((id) => !inArea.includes(id));
  else ids = t.adminIds;
  return [...new Set(ids)].filter((id) => id !== t.reporterId);
}

export function alertMessage(
  stage: AlertStage,
  r: { animal: string; type: string; place: string; shortId: string; minutes: number }
): { title: string; body: string } {
  if (stage === 'no_responder') {
    return {
      title: `No responder yet · #${r.shortId}`,
      body: `${r.animal} · ${r.type} has waited ${r.minutes} min at ${r.place}. Find someone to take it.`,
    };
  }
  return {
    title: stage === 'widened' ? `Still needs a rescuer · ${r.animal}` : `New SOS nearby · ${r.animal}`,
    body: `${r.type} · ${r.place} · #${r.shortId}`,
  };
}
