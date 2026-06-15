import { useState, useMemo } from "react";
import { DUMMY_LIST, DUMMY_DETAILS, allActedFacilityIds, latestLocalActions } from "../lib/dummy";
import { overallScore, trustColor } from "../types";
import type { FacilityListItem } from "../types";

interface QueueEntry {
  facility: FacilityListItem;
  score: number | null;
  note: string | null;
  hasContradiction: boolean;
}

interface Props {
  analystId: string;
  onNavigateToFacility: (id: string) => void;
}

type Tab = "flagged" | "shortlisted";

export default function QueuePage({ analystId, onNavigateToFacility }: Props) {
  const [tab, setTab] = useState<Tab>("flagged");

  const { flagged, shortlisted } = useMemo(() => {
    const actedIds = allActedFacilityIds(analystId);
    const flaggedList: QueueEntry[] = [];
    const shortlistedList: QueueEntry[] = [];

    for (const id of actedIds) {
      const facility = DUMMY_LIST.find((f) => f.facility_id === id);
      if (!facility) continue;
      const actions = latestLocalActions(id, analystId);
      const isFlagged = actions.some((a) => a.action_type === "flag" && a.content === "flagged");
      const isShortlisted = actions.some((a) => a.action_type === "shortlist" && a.content === "added");
      if (!isFlagged && !isShortlisted) continue;
      const note = actions.find((a) => a.action_type === "note")?.content ?? null;
      const score = overallScore(DUMMY_DETAILS[id]?.trust_signals ?? []);
      const entry: QueueEntry = { facility, score, note, hasContradiction: facility.has_contradiction === 1 };
      if (isFlagged) flaggedList.push(entry);
      if (isShortlisted) shortlistedList.push(entry);
    }

    return { flagged: flaggedList, shortlisted: shortlistedList };
  }, [analystId]);

  const tabItems = tab === "flagged" ? flagged : shortlisted;
  const emptyMessage =
    tab === "flagged"
      ? "No flagged facilities yet. Flag a facility from its scorecard."
      : "No shortlisted facilities yet. Add one from the workbench.";

  const tabBtn = (t: Tab, _icon: string, _label: string, _count: number, activeColor: string): React.CSSProperties => ({
    padding: "9px 18px", fontSize: 11, fontWeight: 600, cursor: "pointer", border: "none",
    background: "transparent", borderBottom: `2px solid ${tab === t ? activeColor : "transparent"}`,
    color: tab === t ? "var(--fiq-text)" : "var(--fiq-text-subdued)",
    marginBottom: -1, display: "flex", alignItems: "center", gap: 6,
  });

  return (
    <div style={{ padding: "24px 28px" }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0, marginBottom: 4, color: "var(--fiq-text)" }}>
          Review Queue
        </h1>
        <p style={{ fontSize: 10, color: "var(--fiq-text-subdued)", margin: 0, letterSpacing: "0.5px", textTransform: "uppercase" }}>
          Your flagged and shortlisted facilities
        </p>
      </div>

      {/* Tab bar */}
      <div style={{ display: "flex", borderBottom: "1px solid var(--fiq-border)", marginBottom: 16 }}>
        <button onClick={() => setTab("flagged")} style={tabBtn("flagged", "⚑", "Flagged", flagged.length, "var(--fiq-trust-med)")}>
          <span>⚑ Flagged</span>
          <span style={{
            fontSize: 9, padding: "1px 6px", borderRadius: 8,
            background: tab === "flagged" ? "rgba(251,191,36,0.15)" : "var(--fiq-bg-input)",
            color: tab === "flagged" ? "var(--fiq-trust-med)" : "var(--fiq-text-faintest)",
            fontWeight: 700,
          }}>{flagged.length}</span>
        </button>
        <button onClick={() => setTab("shortlisted")} style={tabBtn("shortlisted", "★", "Shortlisted", shortlisted.length, "#60a5fa")}>
          <span>★ Shortlisted</span>
          <span style={{
            fontSize: 9, padding: "1px 6px", borderRadius: 8,
            background: tab === "shortlisted" ? "rgba(96,165,250,0.15)" : "var(--fiq-bg-input)",
            color: tab === "shortlisted" ? "#60a5fa" : "var(--fiq-text-faintest)",
            fontWeight: 700,
          }}>{shortlisted.length}</span>
        </button>
      </div>

      {/* List */}
      {tabItems.length === 0 ? (
        <div style={{
          padding: "48px 24px", textAlign: "center",
          color: "var(--fiq-text-faintest)", fontSize: 12,
          background: "var(--fiq-bg-surface)", borderRadius: 8,
          border: "1px solid var(--fiq-border-md)",
        }}>
          {emptyMessage}
        </div>
      ) : (
        <div style={{
          background: "var(--fiq-bg-surface)", border: "1px solid var(--fiq-border-md)",
          borderRadius: 8, overflow: "hidden",
        }}>
          {tabItems.map(({ facility, score, note, hasContradiction }, i) => (
            <div
              key={facility.facility_id}
              onClick={() => onNavigateToFacility(facility.facility_id)}
              style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "12px 16px", cursor: "pointer",
                borderTop: i === 0 ? "none" : "1px solid var(--fiq-border)",
                transition: "background 0.12s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--fiq-bg-hover)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "var(--fiq-text)" }}>
                    {facility.facility_name}
                  </span>
                  {hasContradiction && (
                    <span style={{ fontSize: 9, color: "#FF3621", fontWeight: 700 }}>⚠</span>
                  )}
                </div>
                <div style={{ fontSize: 9, color: "var(--fiq-text-subdued)" }}>
                  {[facility.state, facility.facility_type].filter(Boolean).join(" · ")}
                </div>
                {note && (
                  <div style={{
                    fontSize: 10, color: "var(--fiq-text-faint)", fontStyle: "italic",
                    marginTop: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    maxWidth: 500,
                  }}>
                    "{note}"
                  </div>
                )}
              </div>
              <div style={{ textAlign: "right", flexShrink: 0, marginLeft: 16 }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: trustColor(score), lineHeight: 1 }}>
                  {score ?? "—"}
                </div>
                <div style={{ fontSize: 8, color: trustColor(score), fontWeight: 600, letterSpacing: "0.3px" }}>
                  {score !== null ? (score >= 70 ? "HIGH" : score >= 40 ? "MED" : "LOW") : "—"}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
