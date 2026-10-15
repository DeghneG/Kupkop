export type UserRole = 'citizen' | 'volunteer' | 'facility' | 'admin';

export type CaseState = 'reported' | 'claimed' | 'admitted' | 'healing' | 'resolved';

export type EmergencyUrgency = 'critical' | 'urgent' | 'moderate';

export type EmergencyType =
  | 'hit_and_run'
  | 'bleeding'
  | 'fracture'
  | 'trapped_abused'
  | 'sick_mange'
  | 'other';

export interface Profile {
  id: string; // matches auth.users id
  email: string;
  full_name: string | null;
  phone: string | null;
  role: UserRole;
  is_verified: boolean;
  created_at: string;
  updated_at: string;
}

export interface Facility {
  id: string;
  name: string;
  address: string;
  phone: string;
  latitude: number;
  longitude: number;
  // Prototype rule: labeled "Listed", NEVER "Verified"
  status: 'Listed' | 'Pending';
  last_active_at: string; // for 14-day inactivity clock
  created_at: string;
}

export interface SOSReport {
  id: string; // e.g. KK-4821 short reference
  reporter_id: string;
  animal_type: 'dog' | 'cat' | 'other';
  emergency_type: EmergencyType;
  urgency: EmergencyUrgency;
  state: CaseState;
  photo_url: string; // live camera capture in 'live-snaps' bucket
  latitude: number;
  longitude: number;
  location_name: string;
  claimed_by: string | null;
  claimed_at: string | null;
  facility_id: string | null;
  server_timestamp: string; // server-side default now()
  created_at: string;
  updated_at: string;
}

export interface RecoveryUpdate {
  id: string;
  report_id: string;
  author_id: string;
  author_role: UserRole;
  notes: string;
  photo_url?: string;
  state: CaseState;
  created_at: string;
}
