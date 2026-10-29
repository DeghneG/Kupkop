// Feed data rules, ported from the web feed (src/app/page.tsx, IncidentCard.tsx).
import { calculateClaimTimer, calculateEscalation, ESCALATION_CONFIG } from '@shared/escalation';
import type { ColorTokens } from '@/theme/tokens';

export type CaseState = 'reported' | 'claimed' | 'admitted' | 'healing' | 'resolved';

export interface Incident {
  id: string;
  shortId: string;
  animal: string;
  type: string;
  location: string;
  description?: string;
  state: CaseState;
  photoUrl?: string;
  latitude?: number;
  longitude?: number;
  claimedBy: string | null;
  claimedAt: string | null;
  createdAt: string | null;
  facilityId: string | null;
}

// Database row from sos_reports (only the columns the app reads)
export interface ReportRow {
  id: string;
  short_id: string;
  animal_type: string | null;
  emergency_type: string | null;
  state: string | null;
  location_name: string | null;
  description: string | null;
  photo_url: string | null;
  latitude: number | null;
  longitude: number | null;
  claimed_by: string | null;
  claimed_at: string | null;
  created_at: string | null;
  server_timestamp: string | null;
  facility_id: string | null;
}

const TYPE_LABELS: Record<string, string> = {
  hit_and_run: 'Hit-and-run · Critical',
  bleeding: 'Bleeding · Critical',
  fracture: 'Fracture / Limping',
  trapped_abused: 'Trapped in storm drain',
  sick_mange: 'Sick / Severe Mange',
};

export function fromRow(r: ReportRow): Incident {
  let location = r.location_name || 'Pinned location';
  let description = r.description || '';
  // Older reports stored "street — description" in one column
  if (location.includes(' — ')) {
    const [loc, desc] = location.split(' — ');
    location = loc;
    if (!description) description = desc;
  }
  // Raw coordinates when street lookup failed; the pin is still real
  if (/^Near -?\d+\.\d+/.test(location)) location = 'Pinned location';

  return {
    id: r.id,
    shortId: r.short_id,
    animal: r.animal_type === 'dog' ? 'Injured Dog' : r.animal_type === 'cat' ? 'Injured Cat' : 'Injured Animal',
    type: TYPE_LABELS[r.emergency_type ?? ''] ?? 'Emergency',
    location,
    description: description || undefined,
    state: (r.state as CaseState) || 'reported',
    photoUrl: r.photo_url || undefined,
    latitude: r.latitude ?? undefined,
    longitude: r.longitude ?? undefined,
    claimedBy: r.claimed_by,
    claimedAt: r.claimed_at,
    createdAt: r.created_at || r.server_timestamp,
    facilityId: r.facility_id,
  };
}

export function timeAgo(iso: string | null, now: number): string {
  if (!iso) return 'Just now';
  const min = Math.floor((now - new Date(iso).getTime()) / 60000);
  if (min < 1) return 'Just now';
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  return hr < 24 ? `${hr}h ago` : `${Math.floor(hr / 24)}d ago`;
}

/** Status reads as colored text; says what happens next on the escalation clock */
export function statusOf(incident: Incident): { label: string; tone: keyof ColorTokens } {
  switch (incident.state) {
    case 'claimed': {
      const timer = calculateClaimTimer(incident.claimedAt);
      if (!timer.isClaimed || timer.isExpired) return { label: 'Claimed', tone: 'claimedFg' };
      const left = timer.remainingMinutes > 0 ? `${timer.remainingMinutes}m` : `${timer.remainingSeconds}s`;
      return { label: `Claimed · ${left} lock`, tone: 'claimedFg' };
    }
    case 'admitted':
      return { label: 'Admitted', tone: 'healingFg' };
    case 'healing':
      return { label: 'Healing', tone: 'healingFg' };
    case 'resolved':
      return { label: 'Resolved', tone: 'resolvedFg' };
    default: {
      const esc = calculateEscalation(incident.createdAt, incident.type);
      const tier = ESCALATION_CONFIG[esc.tier];
      if (esc.stage === 'alert') return { label: 'No responder yet', tone: 'reportedFg' };
      if (esc.stage === 'widened') {
        return { label: `Search widened · alert in ${tier.alertMinutes - esc.elapsedMinutes}m`, tone: 'reportedFg' };
      }
      return { label: `Reported · widens in ${tier.widenMinutes - esc.elapsedMinutes}m`, tone: 'reportedFg' };
    }
  }
}

/** Drop "· Critical"; the status line carries urgency */
export const triageTag = (type: string) => type.replace(/\s*[·•]\s*Critical/i, '').trim();

export const CHANNELS = [
  { id: 'all', label: 'All' },
  { id: 'critical', label: 'Critical' },
  { id: 'fracture', label: 'Fracture' },
  { id: 'trapped', label: 'Trapped' },
  { id: 'sick', label: 'Sick / Mange' },
] as const;

export type ChannelId = (typeof CHANNELS)[number]['id'];

export function matchesChannel(incident: Incident, channel: ChannelId): boolean {
  const t = incident.type.toLowerCase();
  switch (channel) {
    case 'critical':
      return t.includes('critical') || t.includes('hit') || t.includes('bleed');
    case 'fracture':
      return t.includes('fracture') || t.includes('limp');
    case 'trapped':
      return t.includes('trap') || t.includes('drain');
    case 'sick':
      return t.includes('sick') || t.includes('mange');
    default:
      return true;
  }
}

const STAGE_RANK = { alert: 0, widened: 1, standard: 2 } as const;
const TIER_RANK = { critical: 0, urgent: 1, moderate: 2 } as const;
export const createdMs = (i: Incident) => (i.createdAt ? new Date(i.createdAt).getTime() : 0);

/** Most urgent first: escalation stage, then tier, then oldest */
export function byUrgency(a: Incident, b: Incident): number {
  const ea = calculateEscalation(a.createdAt, a.type);
  const eb = calculateEscalation(b.createdAt, b.type);
  return (
    STAGE_RANK[ea.stage] - STAGE_RANK[eb.stage] ||
    TIER_RANK[ea.tier] - TIER_RANK[eb.tier] ||
    createdMs(a) - createdMs(b)
  );
}
