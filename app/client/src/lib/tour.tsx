import type { Step } from "react-joyride";

type AppView = "desk" | "dashboard" | "board";

export interface TourStep extends Step {
  meta?: {
    view?: AppView;
    selectFirst?: boolean;
  };
}

export interface DashboardStats {
  total_facilities: number;
  contradiction_count: number;
  high_trust_pct: number;
  med_trust_pct: number;
  low_trust_pct: number;
  insuff_pct: number;
  top_dimension: string | null;
  bottom_dimension: string | null;
  highest_contradiction_type: string | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fraction(pct: number): string {
  if (pct >= 45) return "nearly half";
  if (pct >= 38) return "more than a third";
  if (pct >= 28) return "roughly a third";
  if (pct >= 20) return "about a quarter";
  return `${pct}%`;
}

function dimLabel(d: string | null): string {
  const map: Record<string, string> = {
    procedure: "procedure",
    capability: "capability",
    equipment: "equipment",
    completeness: "completeness",
  };
  return d ? (map[d] ?? d) : "procedure";
}

function typeLabel(t: string | null): string {
  return t ?? "smaller facility types";
}

// ── Welcome content ───────────────────────────────────────────────────────────

const WelcomeContent = () => (
  <div style={{ textAlign: "center", padding: "4px 0 8px" }}>
    <img
      src={`${import.meta.env.BASE_URL}facilityiq-logo.png`}
      alt="FacilityIQ"
      style={{ width: 220, borderRadius: 12, display: "block", margin: "0 auto 14px" }}
    />
    <p style={{ margin: 0, lineHeight: 1.6 }}>
      An LLM-powered trust analysis platform for 10,000 India healthcare facilities,
      built on Databricks. Let us walk through how it works.
    </p>
  </div>
);

// ── Step builder ──────────────────────────────────────────────────────────────

export function buildTourSteps(stats?: DashboardStats | null): TourStep[] {
  const total = stats?.total_facilities != null ? stats.total_facilities.toLocaleString() : "10,000";
  const contradictions = stats?.contradiction_count != null ? stats.contradiction_count.toLocaleString() : "hundreds of";
  const highFrac = stats?.high_trust_pct != null ? fraction(stats.high_trust_pct) : "roughly a third";
  const topDim = dimLabel(stats?.top_dimension ?? null);
  const bottomDim = dimLabel(stats?.bottom_dimension ?? null);
  const highContraType = typeLabel(stats?.highest_contradiction_type ?? null);

  return [
    // ── Step 1: Welcome ──────────────────────────────────────────────────────
    {
      target: "body",
      placement: "center",
      title: "FacilityIQ",
      content: <WelcomeContent />,
    },

    // ── Step 2: KPI row ──────────────────────────────────────────────────────
    {
      target: '[data-tour="dashboard-kpis"]',
      placement: "bottom",
      title: "The numbers at a glance",
      content: `Before opening a single record, FacilityIQ shows the situation. ${total} facilities processed, ${contradictions} contradictions surfaced. This is the view planners have never had before.`,
      meta: { view: "dashboard" },
    },

    // ── Step 3: Score distribution ───────────────────────────────────────────
    {
      target: '[data-tour="score-distribution"]',
      placement: "right",
      title: "Where the scores land",
      content:
        "Most facilities cluster between 60 and 80. The tail on the left carries the most risk for any routing decision. The chart shows at a glance where to focus first.",
    },

    // ── Step 4: Trust tier donut ─────────────────────────────────────────────
    {
      target: '[data-tour="trust-tier-donut"]',
      placement: "left",
      title: "Breaking it into tiers",
      content: `${highFrac.charAt(0).toUpperCase() + highFrac.slice(1)} of facilities hit the high-trust threshold. The rest fall into medium, low, or return insufficient data across key dimensions. This breakdown drives how analysts prioritize their review queue.`,
    },

    // ── Step 5: Dimension averages ───────────────────────────────────────────
    {
      target: '[data-tour="dimension-averages"]',
      placement: "right",
      title: "Which claims hold up",
      content: `${topDim.charAt(0).toUpperCase() + topDim.slice(1)} claims score the highest because they are specific and cross-referenceable. ${bottomDim.charAt(0).toUpperCase() + bottomDim.slice(1)} reveals where source data was not there to score against. Analysts see exactly where confidence is earned and where it is not.`,
    },

    // ── Step 6: Type breakdown ───────────────────────────────────────────────
    {
      target: '[data-tour="type-breakdown"]',
      placement: "left",
      title: "Type changes the risk profile",
      content: `${typeLabel(highContraType).charAt(0).toUpperCase() + typeLabel(highContraType).slice(1)} carry the highest contradiction rates. Smaller facilities, less structured source data, more opportunities for claims to go unverified. This is where the pipeline pays off most.`,
    },

    // ── Step 7: Top / Bottom facilities ─────────────────────────────────────
    {
      target: '[data-tour="top-bottom-facilities"]',
      placement: "top",
      title: "The two lists worth acting on",
      content:
        "At the top: facilities with the strongest evidence across all four dimensions, ready for outreach. At the bottom: records that need review before any routing decision. Both lists are immediately actionable.",
    },

    // ── Step 8: Search ───────────────────────────────────────────────────────
    {
      target: '[data-tour="search-bar"]',
      placement: "right",
      title: "10,000 facilities, one search",
      content:
        "Any facility in the dataset is findable by name, clinical specialty, or free-text description. The list responds in real time.",
      meta: { view: "desk" },
    },

    // ── Step 9: State filter ─────────────────────────────────────────────────
    {
      target: '[data-tour="state-filter"]',
      placement: "bottom",
      title: "Zoom into a state",
      content:
        "Select Karnataka. The hospitals there include a facility with a flagged contradiction worth seeing up close.",
      blockTargetInteraction: false,
    },

    // ── Step 10: Type filter ─────────────────────────────────────────────────
    {
      target: '[data-tour="type-filter"]',
      placement: "bottom",
      title: "Focus on hospitals",
      content: "Select Hospital to narrow the list further.",
      blockTargetInteraction: false,
    },

    // ── Step 11: Contradiction filter ───────────────────────────────────────
    {
      target: '[data-tour="contradiction-filter"]',
      placement: "bottom",
      title: "Show only the flagged cases",
      content:
        "Enable this. The Karnataka hospitals with contradictions flagged by the pipeline will surface. These are the records worth reviewing before any routing decision is made.",
      blockTargetInteraction: false,
    },

    // ── Step 12: Trust scorecard ─────────────────────────────────────────────
    {
      target: '[data-tour="trust-scorecard"]',
      placement: "left",
      title: "A contradiction in context",
      content:
        "One contradiction flagged on this facility. The structured fields and the description do not agree on one key claim. Check the trust dimensions below to see which one carries the flag.",
      meta: { view: "desk", selectFirst: true },
    },

    // ── Step 13: Trust dimensions ────────────────────────────────────────────
    {
      target: '[data-tour="trust-dimensions"]',
      placement: "left",
      title: "Four dimensions, one honest picture",
      content:
        "Capability, equipment, procedure, and completeness are scored independently. When source data is insufficient, the card shows Score Suppressed rather than a misleading low number. An honest gap is more useful than a fabricated confidence.",
    },

    // ── Step 14: Evidence panel ──────────────────────────────────────────────
    {
      target: '[data-tour="evidence-panel"]',
      placement: "left",
      title: "Every claim, cited",
      content:
        "Hover any highlighted phrase to read the exact quote that drove the score. Click Show all evidence to surface every annotation at once. Nothing is inferred. If the text does not support a claim, the system returns Insufficient Data.",
    },

    // ── Step 15: Analyst actions ─────────────────────────────────────────────
    {
      target: '[data-tour="workbench"]',
      placement: "left",
      title: "What analysts do next",
      content:
        "Shortlist high-trust facilities for outreach, flag contradictions for follow-up, leave notes for teammates, or override a score with justification. Every action persists instantly and is visible to the whole team.",
    },

    // ── Step 16: Kanban overview ─────────────────────────────────────────────
    {
      target: '[data-tour="kanban-board"]',
      placement: "center",
      title: "The review pipeline",
      content:
        "Six stages: Not Started, In Review, Email Sent, Called, Parked, and Validated. Every one of the facilities moves through this board as the team works through the dataset.",
      meta: { view: "board" },
    },

    // ── Step 17: Kanban drag interaction ─────────────────────────────────────
    {
      target: '[data-tour="kanban-not-started"]',
      placement: "center",
      title: "Moving a facility",
      content:
        "Drag any card into the next column to advance it. Or open the status menu from a facility detail page to update it there. Both routes update the same shared board in real time.",
      blockTargetInteraction: false,
    },
  ];
}

// Fallback for callers that haven't loaded stats yet
export const TOUR_STEPS = buildTourSteps(null);
