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
    capability: string | null;
    procedure: string | null;
    equipment: string | null;
    capacity: number | null;
    year_established: number | null;
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
  if (score === null) return "rgba(255,255,255,0.3)";
  if (score >= 70) return "#4ade80";
  if (score >= 40) return "#fbbf24";
  return "#f87171";
}

export function trustLabel(score: number | null): string {
  if (score === null) return "—";
  if (score >= 70) return "HIGH";
  if (score >= 40) return "MED";
  return "LOW";
}
