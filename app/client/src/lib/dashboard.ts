import type { DashboardData, FacilityDetail, FacilityListItem, UserAction } from "../types";
import { overallScore, scoreToInt } from "../types";

const buckets = [
  { label: "0-29", min: 0, max: 29 },
  { label: "30-39", min: 30, max: 39 },
  { label: "40-49", min: 40, max: 49 },
  { label: "50-59", min: 50, max: 59 },
  { label: "60-69", min: 60, max: 69 },
  { label: "70-79", min: 70, max: 79 },
  { label: "80-89", min: 80, max: 89 },
  { label: "90-100", min: 90, max: 100 },
] as const;

const dimensions = ["capability", "equipment", "procedure", "completeness"];

function latestActions(actions: UserAction[]): UserAction[] {
  const latest = new Map<string, UserAction>();
  for (const action of actions) {
    const key = `${action.facility_id}__${action.action_type}__${action.dimension ?? ""}`;
    const existing = latest.get(key);
    if (!existing || action.updated_at > existing.updated_at) latest.set(key, action);
  }
  return [...latest.values()];
}

export function buildDashboardDataFromList(
  facilities: FacilityListItem[],
  detailsById: Record<string, FacilityDetail>,
  actions: UserAction[] = [],
): DashboardData {
  const facilityScores = facilities.map((facility) => {
    const listScore = scoreToInt(facility.overall_trust_score);
    return {
      ...facility,
      score: listScore ?? overallScore(detailsById[facility.facility_id]?.trust_signals ?? []),
    };
  });

  const distribution = buckets.map((bucket) => ({
    label: bucket.label,
    count: facilityScores.filter(
      (facility) => facility.score !== null && facility.score >= bucket.min && facility.score <= bucket.max,
    ).length,
    tier: bucket.max < 40 ? "low" as const : bucket.max < 70 ? "med" as const : "high" as const,
  }));

  const allSignals = Object.values(detailsById).flatMap((detail) => detail.trust_signals);
  const allScoredDims = allSignals
    .filter((signal) => signal.confidence_tier !== "insufficient_data" && signal.trust_score !== null)
    .map((signal) => scoreToInt(signal.trust_score) as number);
  const avgScore = allScoredDims.length
    ? Math.round(allScoredDims.reduce((sum, score) => sum + score, 0) / allScoredDims.length)
    : null;

  const dimAvgs = dimensions.map((dim) => {
    const vals = allSignals
      .filter(
        (signal) =>
          signal.dimension === dim &&
          signal.confidence_tier !== "insufficient_data" &&
          signal.trust_score !== null,
      )
      .map((signal) => scoreToInt(signal.trust_score) as number);
    return {
      dim,
      avg: vals.length ? Math.round(vals.reduce((sum, score) => sum + score, 0) / vals.length) : null,
    };
  });

  const typeBreakdown = [...new Set(facilities.map((facility) => facility.facility_type).filter(Boolean))]
    .map((type) => ({
      type: type as string,
      count: facilities.filter((facility) => facility.facility_type === type).length,
      contradictions: facilities.filter(
        (facility) => facility.facility_type === type && facility.has_contradiction === 1,
      ).length,
    }))
    .sort((a, b) => b.count - a.count || a.type.localeCompare(b.type));

  const scored = facilityScores
    .filter((facility) => facility.score !== null)
    .sort((a, b) => b.score! - a.score!);

  const activeActions = latestActions(actions);
  const shortlistedCount = new Set(
    activeActions
      .filter((action) => action.action_type === "shortlist" && action.content === "added")
      .map((action) => action.facility_id),
  ).size;
  const flaggedCount = new Set(
    activeActions
      .filter((action) => action.action_type === "flag" && action.content === "flagged")
      .map((action) => action.facility_id),
  ).size;

  return {
    total: facilities.length,
    contradictionCount: facilities.filter((facility) => facility.has_contradiction === 1).length,
    avgScore,
    distribution,
    tierData: [
      { name: "High >=70", value: facilityScores.filter((facility) => facility.score !== null && facility.score >= 70).length, tier: "high" },
      { name: "Med 40-69", value: facilityScores.filter((facility) => facility.score !== null && facility.score >= 40 && facility.score < 70).length, tier: "med" },
      { name: "Low <40", value: facilityScores.filter((facility) => facility.score !== null && facility.score < 40).length, tier: "low" },
      { name: "Insuff. data", value: facilityScores.filter((facility) => facility.score === null).length, tier: "insuff" },
    ],
    dimAvgs,
    typeBreakdown,
    top3: scored.slice(0, 3),
    bottom3: scored.slice(-3).reverse(),
    shortlistedCount,
    flaggedCount,
  };
}
