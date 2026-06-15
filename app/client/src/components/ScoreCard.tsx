import type { FacilityDetail } from "../types";
import { trustColor, trustLabel, overallScore } from "../types";
import TrustDimension from "./TrustDimension";
import ContradictionAlert from "./ContradictionAlert";
import Workbench from "./Workbench";

interface Props {
  detail: FacilityDetail;
  analystId: string;
}

export default function ScoreCard({ detail, analystId }: Props) {
  const { facility, trust_signals } = detail;
  const score = overallScore(trust_signals);
  const color = trustColor(score);

  return (
    <div style={{ padding: "24px 28px" }}>
      {/* Header */}
      <div style={{
        display: "flex", justifyContent: "space-between",
        alignItems: "flex-start", marginBottom: 20,
        paddingBottom: 16, borderBottom: "1px solid var(--fiq-border)",
      }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0, marginBottom: 4, color: "var(--fiq-text)" }}>
            {facility.facility_name}
          </h1>
          <p style={{
            fontSize: 10, color: "var(--fiq-text-subdued)", margin: 0,
            letterSpacing: "0.5px", textTransform: "uppercase",
          }}>
            {[facility.state, facility.facility_type, facility.district].filter(Boolean).join(" · ")}
          </p>
        </div>
        <div style={{ textAlign: "right", flexShrink: 0, marginLeft: 16 }}>
          <div style={{ fontSize: 40, fontWeight: 800, lineHeight: 1, color: "var(--fiq-text)" }}>
            {score ?? "—"}
          </div>
          <div style={{ fontSize: 9, fontWeight: 600, color, letterSpacing: "0.5px" }}>
            OVERALL · {score !== null ? trustLabel(score) : "INSUFFICIENT DATA"}
          </div>
        </div>
      </div>

      <ContradictionAlert signals={trust_signals} />

      <div style={{
        fontSize: 9, fontWeight: 700, color: "var(--fiq-text-code)",
        letterSpacing: "0.5px", textTransform: "uppercase", marginBottom: 10,
      }}>
        Trust Dimensions
      </div>

      {trust_signals.map((signal) => (
        <TrustDimension key={signal.dimension} signal={signal} />
      ))}

      <Workbench
        facilityId={facility.facility_id}
        analystId={analystId}
        signals={trust_signals}
      />
    </div>
  );
}
