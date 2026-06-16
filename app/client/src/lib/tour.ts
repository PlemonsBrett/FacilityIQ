import type { Step } from "react-joyride";
import type { View } from "../App";

export interface TourStep extends Step {
  meta?: {
    view?: View;
    selectFirst?: boolean;
  };
}

export const TOUR_STEPS: TourStep[] = [
  {
    target: "body",
    placement: "center",
    disableBeacon: true,
    title: "FacilityIQ",
    content:
      "An LLM-powered trust desk for 10,000 India healthcare facilities — built on Databricks. Let's walk through how it works.",
  },
  {
    target: '[data-tour="dashboard-kpis"]',
    placement: "bottom",
    disableBeacon: true,
    title: "The scale",
    content:
      "10,000 healthcare facilities processed in a single Databricks batch. One LLM call per facility extracts four trust dimensions simultaneously and writes results to Delta Lake.",
    meta: { view: "dashboard" },
  },
  {
    target: '[data-tour="score-distribution"]',
    placement: "right",
    disableBeacon: true,
    title: "Honest scoring",
    content:
      "Every facility gets a trust score per dimension. Fields with low coverage — like capacity at 25% — are never scored. We surface 'Insufficient Data' rather than manufacture false confidence.",
  },
  {
    target: '[data-tour="search-bar"]',
    placement: "right",
    disableBeacon: true,
    title: "Finding what matters",
    content:
      "Search across all 10,000 facilities by name, description, or clinical capability — with filters for state, type, and trust tier.",
    meta: { view: "desk" },
  },
  {
    target: '[data-tour="search-filters"]',
    placement: "right",
    disableBeacon: true,
    title: "The contradiction filter",
    content:
      "This filter surfaces facilities where the LLM detected a conflict between structured fields and free text — the highest-priority cases for human review.",
  },
  {
    target: '[data-tour="trust-scorecard"]',
    placement: "right",
    disableBeacon: true,
    title: "Trust scorecard",
    content:
      "Each facility shows scores across capability, equipment, procedure, and completeness — with a confidence tier on each that tells you exactly how much weight to place on it.",
    meta: { selectFirst: true },
  },
  {
    target: '[data-tour="evidence-panel"]',
    placement: "top",
    disableBeacon: true,
    title: "Grounded in evidence",
    content:
      "Every score links back to an exact quote from the source text, highlighted in context. If the text doesn't support a claim, the system says so — no inferences.",
  },
  {
    target: '[data-tour="workbench"]',
    placement: "top",
    disableBeacon: true,
    title: "Analyst actions",
    content:
      "Shortlist high-trust facilities, flag contradictions for follow-up, leave notes for teammates, or override a score with a reason — all persisted instantly.",
  },
  {
    target: '[data-tour="kanban-board"]',
    placement: "top",
    disableBeacon: true,
    title: "The review pipeline",
    content:
      "A full workflow tracks each facility from first look through email outreach, calls, and final validation — giving the whole team a shared view of 10,000 facilities.",
    meta: { view: "board" },
  },
];
