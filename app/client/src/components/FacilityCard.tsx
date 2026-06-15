import type { FacilityListItem } from "../types";
import { scoreToInt, trustColor, trustLabel } from "../types";

interface Props {
  facility: FacilityListItem;
  selected: boolean;
  onClick: () => void;
}

export default function FacilityCard({ facility, selected, onClick }: Props) {
  const score = scoreToInt(facility.overall_trust_score);
  const color = trustColor(score);

  return (
    <div
      onClick={onClick}
      style={{
        padding: "10px 14px",
        borderLeft: `2px solid ${selected ? "#FF3621" : "transparent"}`,
        background: selected ? "rgba(255,255,255,0.04)" : "transparent",
        borderBottom: "1px solid rgba(255,255,255,0.04)",
        cursor: "pointer",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div style={{ flex: 1, marginRight: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 2, lineHeight: 1.3 }}>
            {facility.facility_name}
          </div>
          <div style={{ fontSize: 9, color: "rgba(255,255,255,0.35)", letterSpacing: "0.3px" }}>
            {[facility.state, facility.facility_type].filter(Boolean).join(" · ")}
          </div>
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color, lineHeight: 1 }}>{score ?? "—"}</div>
          <div style={{ fontSize: 8, color, fontWeight: 600, letterSpacing: "0.3px" }}>{trustLabel(score)}</div>
        </div>
      </div>
      {facility.has_contradiction === 1 && (
        <div style={{ fontSize: 8, color: "#FF3621", marginTop: 3, fontWeight: 600 }}>⚠ CONTRADICTION</div>
      )}
    </div>
  );
}
