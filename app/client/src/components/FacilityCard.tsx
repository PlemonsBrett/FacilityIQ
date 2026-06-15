import type { FacilityListItem, UserAction } from "../types";
import { scoreToInt, trustColor, trustLabel } from "../types";

interface Props {
  facility: FacilityListItem;
  selected: boolean;
  onClick: () => void;
  actions?: UserAction[];
}

export default function FacilityCard({ facility, selected, onClick, actions = [] }: Props) {
  const score = scoreToInt(facility.overall_trust_score);
  const color = trustColor(score);
  const isShortlisted = actions.some(
    (a) => a.action_type === "shortlist" && a.content === "added",
  );
  const isFlagged = actions.some(
    (a) => a.action_type === "flag" && a.content === "flagged",
  );

  return (
    <div
      onClick={onClick}
      style={{
        padding: "10px 14px",
        borderLeft: `2px solid ${selected ? "#FF3621" : "transparent"}`,
        background: selected ? "var(--fiq-bg-hover)" : "transparent",
        borderBottom: "1px solid var(--fiq-border)",
        cursor: "pointer",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div style={{ flex: 1, marginRight: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 2, lineHeight: 1.3 }}>
            {facility.facility_name}
          </div>
          <div style={{ fontSize: 9, color: "var(--fiq-text-subdued)", letterSpacing: "0.3px" }}>
            {[facility.state, facility.facility_type].filter(Boolean).join(" · ")}
          </div>
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color, lineHeight: 1 }}>{score ?? "—"}</div>
          <div style={{ fontSize: 8, color, fontWeight: 600, letterSpacing: "0.3px" }}>{trustLabel(score)}</div>
        </div>
      </div>
      {(facility.has_contradiction === 1 || isShortlisted || isFlagged) && (
        <div style={{ display: "flex", gap: 6, marginTop: 4, flexWrap: "wrap" }}>
          {facility.has_contradiction === 1 && (
            <span style={{ fontSize: 8, color: "#FF3621", fontWeight: 600 }}>⚠ Contradiction</span>
          )}
          {isShortlisted && (
            <span style={{ fontSize: 8, color: "#60a5fa", fontWeight: 600 }}>★ Shortlisted</span>
          )}
          {isFlagged && (
            <span style={{ fontSize: 8, color: "#fbbf24", fontWeight: 600 }}>⚑ Flagged</span>
          )}
        </div>
      )}
    </div>
  );
}
