import type { Step } from "react-joyride";

type AppView = "desk" | "dashboard" | "board";

export interface TourStep extends Step {
  meta?: {
    view?: AppView;
    selectFirst?: boolean;
  };
}

const WelcomeContent = () => (
  <div style={{ textAlign: "center", padding: "4px 0 8px" }}>
    <img
      src="/facilityiq-logo.png"
      alt="FacilityIQ"
      style={{ width: 220, borderRadius: 12, display: "block", margin: "0 auto 14px" }}
    />
    <p style={{ margin: 0, lineHeight: 1.6 }}>
      An LLM-powered trust analysis platform for 10,000 India healthcare facilities,
      built on Databricks. Let's walk through how it works.
    </p>
  </div>
);

export const TOUR_STEPS: TourStep[] = [
  {
    target: "body",
    placement: "center",
    title: "FacilityIQ",
    content: <WelcomeContent />,
  },
  {
    target: '[data-tour="dashboard-kpis"]',
    placement: "bottom",
    title: "The scale",
    content:
      "10,000 healthcare facilities processed in a single Databricks batch. One LLM call per facility extracts four trust dimensions simultaneously and writes to Delta Lake.",
    meta: { view: "dashboard" },
  },
  {
    target: '[data-tour="score-distribution"]',
    placement: "right",
    title: "Honest scoring",
    content:
      "Every facility gets a trust score per dimension. Fields with insufficient coverage (capacity appears in only 25% of records) are never scored. We surface Insufficient Data rather than manufacture false confidence.",
  },
  {
    target: '[data-tour="search-bar"]',
    placement: "right",
    title: "Finding what matters",
    content:
      "Search across all 10,000 facilities by name, description, or clinical capability, with filters by state, facility type, and trust tier.",
    meta: { view: "desk" },
  },
  {
    target: '[data-tour="search-filters"]',
    placement: "right",
    title: "The contradiction filter",
    content:
      "This filter surfaces facilities where the LLM detected a conflict between structured fields and free text. These are the highest-priority cases for human review.",
  },
  {
    target: '[data-tour="trust-scorecard"]',
    placement: "right",
    title: "Trust scorecard",
    content:
      "Each facility shows scores across capability, equipment, procedure, and completeness. Each dimension carries a confidence tier so analysts know exactly how much weight to place on it.",
    meta: { selectFirst: true },
  },
  {
    target: '[data-tour="evidence-panel"]',
    placement: "top",
    title: "Grounded in evidence",
    content:
      "Every score links back to an exact quote from the source text, highlighted in context. If the text does not support a claim, the system returns Insufficient Data, not a guess.",
  },
  {
    target: '[data-tour="workbench"]',
    placement: "top",
    title: "Analyst actions",
    content:
      "Shortlist high-trust facilities, flag contradictions for follow-up, leave notes for teammates, or override a score with justification. All actions persist instantly to Lakebase.",
  },
  {
    target: '[data-tour="kanban-board"]',
    placement: "top",
    title: "The review pipeline",
    content:
      "A full workflow tracks each facility from initial review through email outreach, calls, and validation. The whole team sees 10,000 facilities in one shared view.",
    meta: { view: "board" },
  },
];
