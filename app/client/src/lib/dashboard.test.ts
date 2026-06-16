import { describe, expect, it } from "vitest";
import { buildDashboardDataFromList } from "./dashboard";
import type { FacilityDetail, FacilityListItem, UserAction } from "../types";

const facilities: FacilityListItem[] = [
  {
    facility_id: "a",
    facility_name: "Alpha Clinic",
    state: "Karnataka",
    facility_type: "clinic",
    overall_trust_score: "0.82",
    has_contradiction: 0,
    signal_count: 2,
  },
  {
    facility_id: "b",
    facility_name: "Beta Hospital",
    state: "Maharashtra",
    facility_type: "hospital",
    overall_trust_score: "0.36",
    has_contradiction: 1,
    signal_count: 2,
  },
];

const details: Record<string, FacilityDetail> = {
  a: {
    facility: {
      facility_id: "a",
      facility_name: "Alpha Clinic",
      facility_type: "clinic",
      state: "Karnataka",
      district: null,
      description: null,
      capacity: null,
      year_established: null,
      number_doctors: null,
      official_phone: null,
      email: null,
      official_website: null,
      address_line1: null,
      overridden_fields: [],
    },
    trust_signals: [
      {
        id: 1,
        facility_id: "a",
        dimension: "capability",
        trust_score: "0.8",
        confidence_tier: "high",
        evidence_text: null,
        source_field: null,
        contradiction: false,
        contradiction_detail: null,
        extraction_model: "test",
        extracted_at: "2026-06-16T00:00:00Z",
      },
      {
        id: 2,
        facility_id: "a",
        dimension: "equipment",
        trust_score: "0.6",
        confidence_tier: "medium",
        evidence_text: null,
        source_field: null,
        contradiction: false,
        contradiction_detail: null,
        extraction_model: "test",
        extracted_at: "2026-06-16T00:00:00Z",
      },
    ],
  },
  b: {
    facility: {
      facility_id: "b",
      facility_name: "Beta Hospital",
      facility_type: "hospital",
      state: "Maharashtra",
      district: null,
      description: null,
      capacity: null,
      year_established: null,
      number_doctors: null,
      official_phone: null,
      email: null,
      official_website: null,
      address_line1: null,
      overridden_fields: [],
    },
    trust_signals: [
      {
        id: 3,
        facility_id: "b",
        dimension: "capability",
        trust_score: "0.4",
        confidence_tier: "low",
        evidence_text: null,
        source_field: null,
        contradiction: true,
        contradiction_detail: null,
        extraction_model: "test",
        extracted_at: "2026-06-16T00:00:00Z",
      },
      {
        id: 4,
        facility_id: "b",
        dimension: "procedure",
        trust_score: null,
        confidence_tier: "insufficient_data",
        evidence_text: null,
        source_field: null,
        contradiction: false,
        contradiction_detail: null,
        extraction_model: "test",
        extracted_at: "2026-06-16T00:00:00Z",
      },
    ],
  },
};

const actions: UserAction[] = [
  {
    action_id: "1",
    facility_id: "a",
    analyst_id: "analyst",
    action_type: "shortlist",
    dimension: null,
    content: "added",
    override_score: null,
    updated_at: "2026-06-16T00:00:00Z",
  },
  {
    action_id: "2",
    facility_id: "b",
    analyst_id: "analyst",
    action_type: "flag",
    dimension: null,
    content: "flagged",
    override_score: null,
    updated_at: "2026-06-16T00:00:00Z",
  },
];

describe("buildDashboardDataFromList", () => {
  it("builds dashboard metrics from the provided facilities instead of bundled demo data", () => {
    const dashboard = buildDashboardDataFromList(facilities, details, actions);

    expect(dashboard.total).toBe(2);
    expect(dashboard.contradictionCount).toBe(1);
    expect(dashboard.avgScore).toBe(60);
    expect(dashboard.shortlistedCount).toBe(1);
    expect(dashboard.flaggedCount).toBe(1);
    expect(dashboard.tierData.map((tier) => [tier.tier, tier.value])).toEqual([
      ["high", 1],
      ["med", 0],
      ["low", 1],
      ["insuff", 0],
    ]);
    expect(dashboard.top3[0]?.facility_id).toBe("a");
    expect(dashboard.bottom3[0]?.facility_id).toBe("b");
    expect(dashboard.typeBreakdown).toEqual([
      { type: "clinic", count: 1, contradictions: 0 },
      { type: "hospital", count: 1, contradictions: 1 },
    ]);
  });
});
