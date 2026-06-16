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
  // ── Step 1: Welcome ────────────────────────────────────────────────────────
  {
    target: "body",
    placement: "center",
    title: "FacilityIQ",
    content: <WelcomeContent />,
  },

  // ── Step 2: The scale (Dashboard KPIs) ────────────────────────────────────
  {
    target: '[data-tour="dashboard-kpis"]',
    placement: "bottom",
    title: "The scale",
    content:
      "10,000 healthcare facilities processed in a single Databricks batch. One LLM call per facility extracts four trust dimensions simultaneously and writes to Delta Lake.",
    meta: { view: "dashboard" },
  },

  // ── Step 3: Score distribution ────────────────────────────────────────────
  {
    target: '[data-tour="score-distribution"]',
    placement: "right",
    title: "Trust score distribution",
    content:
      "This chart shows how trust scores spread across all 10,000 facilities. Scores above 70 are high-trust; below 40 need close review. The distribution tells analysts where to focus first.",
  },

  // ── Step 4: Search ────────────────────────────────────────────────────────
  {
    target: '[data-tour="search-bar"]',
    placement: "right",
    title: "Search",
    content:
      "Search across all 10,000 facilities by name, description, or clinical capability.",
    meta: { view: "desk" },
  },

  // ── Step 5: State filter ─────────────────────────────────────────────────
  {
    target: '[data-tour="state-filter"]',
    placement: "bottom",
    title: "Filter by state",
    content: "Narrow the list to a specific state. Try selecting one now.",
    blockTargetInteraction: false,
  },

  // ── Step 6: Type filter ───────────────────────────────────────────────────
  {
    target: '[data-tour="type-filter"]',
    placement: "bottom",
    title: "Filter by facility type",
    content: "Scope to hospitals, PHCs, CHCs, or any other facility type.",
    blockTargetInteraction: false,
  },

  // ── Step 7: Contradiction filter ─────────────────────────────────────────
  {
    target: '[data-tour="contradiction-filter"]',
    placement: "bottom",
    title: "The contradiction filter",
    content:
      "The LLM flags facilities where structured fields conflict with free-text claims — a hospital listed as a basic PHC, for example. These are the highest-priority cases. Click to activate it.",
    blockTargetInteraction: false,
  },

  // ── Step 8: Trust scorecard (auto-select first facility) ──────────────────
  {
    target: '[data-tour="trust-scorecard"]',
    placement: "left",
    title: "Overall trust score",
    content:
      "Selecting a facility shows its overall trust score, review status, and flag controls. The score is the average across all scoreable dimensions.",
    meta: { selectFirst: true },
  },

  // ── Step 9: Trust dimensions ──────────────────────────────────────────────
  {
    target: '[data-tour="trust-dimensions"]',
    placement: "left",
    title: "Four trust dimensions",
    content:
      "Capability, equipment, procedure, and completeness are scored independently. Dimensions with insufficient source data show Score Suppressed — an honest gap, not a zero.",
  },

  // ── Step 10: Evidence panel ────────────────────────────────────────────────
  {
    target: '[data-tour="evidence-panel"]',
    placement: "left",
    title: "Evidence in context",
    content:
      "Every score is grounded in an exact quote from the source text, highlighted inline. Hover any highlighted phrase to read the evidence bubble. Click Show all evidence to surface every annotation at once.",
  },

  // ── Step 11: Analyst actions (workbench) ──────────────────────────────────
  {
    target: '[data-tour="workbench"]',
    placement: "left",
    title: "Analyst actions",
    content:
      "Leave a note for teammates, shortlist the facility for follow-up, flag a contradiction for review, or override a dimension score with justification. All actions persist to Lakebase.",
  },

  // ── Step 12: Kanban overview ──────────────────────────────────────────────
  {
    target: '[data-tour="kanban-board"]',
    placement: "top",
    title: "The review pipeline",
    content:
      "Every facility moves through six stages: Not Started, In Review, Email Sent, Called, Parked, and Validated. The whole team sees 10,000 facilities in one shared view.",
    meta: { view: "board" },
  },

  // ── Step 13: Kanban interaction ───────────────────────────────────────────
  {
    target: '[data-tour="kanban-not-started"]',
    placement: "right",
    title: "Moving a facility",
    content:
      "Drag any card to the next column to advance it, or open the status menu on a facility's detail page to update it from there. Give it a try.",
    blockTargetInteraction: false,
  },
];
