import type { FacilityListItem, FacilityDetail, UserAction, ReviewCard, ReviewStatus } from "../types";
import {
  filterDummyList,
  DUMMY_DETAILS,
  DUMMY_META,
  latestLocalActions,
  saveLocalAction,
  getLocalBoardColumn,
  setLocalKanbanStatus,
  getLocalUnstartedFacilities,
} from "./dummy";

async function tryFetch<T>(url: string, init?: RequestInit): Promise<T | null> {
  try {
    const res = await fetch(url, init);
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export interface FacilitiesParams {
  q: string;
  page: number;
  limit: number;
  state: string;
  facilityType: string;
  contradictionsOnly: boolean;
}

// null = unknown, true = real data exists, false = DB empty → use dummy
let _facilityDataAvailable: boolean | null = null;

export async function fetchFacilities(params: FacilitiesParams): Promise<FacilityListItem[]> {
  const { q, page, limit, state, facilityType, contradictionsOnly } = params;

  if (_facilityDataAvailable === false) {
    return filterDummyList(q, state, facilityType, contradictionsOnly, page, limit);
  }

  const qs = new URLSearchParams({
    q,
    page: String(page),
    limit: String(limit),
    ...(state ? { state } : {}),
    ...(facilityType ? { facility_type: facilityType } : {}),
    ...(contradictionsOnly ? { contradictions_only: "true" } : {}),
  });
  const result = await tryFetch<FacilityListItem[]>(`/api/facilities?${qs}`);

  if (result === null) {
    // Transient failure (network/server error) — don't permanently lock, try again next call
    return filterDummyList(q, state, facilityType, contradictionsOnly, page, limit);
  }
  if (result.length > 0) {
    _facilityDataAvailable = true;
    return result;
  }

  // Empty result — if we haven't confirmed real data exists yet, treat DB as empty
  if (_facilityDataAvailable === null) {
    _facilityDataAvailable = false;
    return filterDummyList(q, state, facilityType, contradictionsOnly, page, limit);
  }

  // DB has real data; this is a valid empty filtered result
  return result;
}

export async function fetchMeta(): Promise<{ states: string[]; facility_types: string[] }> {
  const result = await tryFetch<{ states: string[]; facility_types: string[] }>(
    "/api/facilities/meta",
  );
  if (result && result.states.length > 0) return result;
  return DUMMY_META;
}

export async function fetchFacilityDetail(id: string): Promise<FacilityDetail | null> {
  const result = await tryFetch<FacilityDetail>(`/api/facilities/${id}`);
  if (result !== null) return result;
  return DUMMY_DETAILS[id] ?? null;
}

export async function fetchActions(facilityId: string, analystId: string): Promise<UserAction[]> {
  const result = await tryFetch<UserAction[]>(
    `/api/facilities/${facilityId}/actions?analyst_id=${analystId}`,
  );
  if (result !== null) return result;
  return latestLocalActions(facilityId, analystId);
}

export async function postAction(
  facilityId: string,
  analystId: string,
  action_type: UserAction["action_type"],
  content?: string | null,
  dimension?: string | null,
  override_score?: number | null,
): Promise<UserAction | null> {
  const result = await tryFetch<UserAction>(`/api/facilities/${facilityId}/actions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      analyst_id: analystId,
      action_type,
      content: content ?? null,
      dimension: dimension ?? null,
      override_score: override_score ?? null,
    }),
  });
  if (result !== null) return result;
  return saveLocalAction(
    facilityId,
    analystId,
    action_type,
    content ?? null,
    dimension ?? null,
    override_score ?? null,
  );
}

export async function fetchBoardColumn(status: ReviewStatus): Promise<ReviewCard[]> {
  if (status === "not_started") {
    const result = await tryFetch<ReviewCard[]>("/api/review/board/unstarted?limit=50");
    // Empty result means DB is empty or unreachable — show dummy facilities
    if (result !== null && result.length > 0) return result;
    return getLocalUnstartedFacilities();
  }
  const result = await tryFetch<ReviewCard[]>(`/api/review/board?status=${status}&limit=200`);
  if (result !== null && result.length > 0) return result;
  return getLocalBoardColumn(status);
}

export async function postReviewStatus(
  facilityId: string,
  status: ReviewStatus,
  parked_reason: string | null = null,
  notes: string | null = null,
): Promise<void> {
  const result = await tryFetch<ReviewCard>(`/api/review/${facilityId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status, parked_reason, notes }),
  });
  if (result === null) {
    setLocalKanbanStatus(facilityId, status, parked_reason, notes);
  }
}
