export interface FacilityListItem {
  facility_id: string;
  facility_name: string;
  state: string | null;
  facility_type: string | null;
  overall_trust_score: string | null; // Postgres returns numerics as strings
  has_contradiction: number;
  signal_count: number;
}

export interface TrustSignal {
  id: number;
  facility_id: string;
  dimension: string;
  trust_score: string | null; // Postgres returns as string
  confidence_tier: string;
  evidence_text: string | null;
  source_field: string | null;
  contradiction: boolean;
  contradiction_detail: string | null;
  extraction_model: string;
  extracted_at: string;
}

export interface FacilityDetail {
  facility: {
    facility_id: string;
    facility_name: string;
    facility_type: string | null;
    state: string | null;
    district: string | null;
    description: string | null;
    capability?: string | null;
    procedure?: string | null;
    equipment?: string | null;
    capacity: number | null;
    year_established: number | null;
    number_doctors: number | null;
    official_phone: string | null;
    email: string | null;
    official_website: string | null;
    address_line1: string | null;
    overridden_fields: string[];
    overall_trust_score?: string | null;
  };
  trust_signals: TrustSignal[];
}

export interface UserAction {
  action_id: string;
  facility_id: string;
  analyst_id: string;
  action_type: "note" | "override" | "shortlist" | "flag";
  dimension: string | null;
  content: string | null;
  override_score: number | null;
  updated_at: string;
}

export function parseScore(raw: string | null): number | null {
  if (raw === null || raw === undefined) return null;
  const n = parseFloat(String(raw));
  return isNaN(n) ? null : n;
}

export function scoreToInt(raw: string | null): number | null {
  const s = parseScore(raw);
  if (s === null) return null;
  return s <= 1 ? Math.round(s * 100) : Math.round(s);
}

export function trustColor(score: number | null): string {
  if (score === null) return "var(--fiq-trust-null)";
  if (score >= 70) return "var(--fiq-trust-high)";
  if (score >= 40) return "var(--fiq-trust-med)";
  return "var(--fiq-trust-low)";
}

export function trustLabel(score: number | null): string {
  if (score === null) return "—";
  if (score >= 70) return "HIGH";
  if (score >= 40) return "MED";
  return "LOW";
}

export function overallScore(signals: TrustSignal[]): number | null {
  const valid = signals
    .filter((s) => s.confidence_tier !== "insufficient_data" && s.trust_score !== null)
    .map((s) => scoreToInt(s.trust_score) as number);
  if (valid.length === 0) return null;
  return Math.round(valid.reduce((a, b) => a + b, 0) / valid.length);
}

export type ReviewStatus =
  | "not_started"
  | "in_progress"
  | "email_sent"
  | "called"
  | "parked"
  | "validation_complete";

export interface ReviewCard {
  facility_id: string;
  facility_name: string;
  facility_type: string | null;
  state: string | null;
  status: ReviewStatus;
  parked_reason: string | null;
  assigned_to: string | null;
  notes: string | null;
  updated_by: string | null;
  updated_at: string;
}
