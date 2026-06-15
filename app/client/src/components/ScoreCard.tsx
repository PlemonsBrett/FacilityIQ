import type { FacilityDetail, TrustSignal } from "../types";
import { scoreToInt, trustColor, trustLabel, parseScore } from "../types";

interface Props {
  detail: FacilityDetail;
  analystId: string;
}

function overallScore(signals: TrustSignal[]): number | null {
  const valid = signals
    .filter((s) => s.confidence_tier !== "insufficient_data" && s.trust_score !== null)
    .map((s) => parseScore(s.trust_score) as number);
  if (valid.length === 0) return null;
  return Math.round((valid.reduce((a, b) => a + b, 0) / valid.length) * 100);
}

export default function ScoreCard({ detail }: Props) {
  const { facility, trust_signals } = detail;
  const score = overallScore(trust_signals);
  const color = trustColor(score);
  const hasContradiction = trust_signals.some((s) => s.contradiction);

  return (
    <div style={{ padding: "24px 28px" }}>
      <div style={{
        display: "flex", justifyContent: "space-between",
        alignItems: "flex-start", marginBottom: 20,
        paddingBottom: 16, borderBottom: "1px solid rgba(255,255,255,0.06)",
      }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0, marginBottom: 4 }}>
            {facility.facility_name}
          </h1>
          <p style={{
            fontSize: 10, color: "rgba(255,255,255,0.35)", margin: 0,
            letterSpacing: "0.5px", textTransform: "uppercase",
          }}>
            {[facility.state, facility.facility_type, facility.district].filter(Boolean).join(" · ")}
          </p>
        </div>
        <div style={{ textAlign: "right", flexShrink: 0, marginLeft: 16 }}>
          <div style={{ fontSize: 40, fontWeight: 800, lineHeight: 1, color: "white" }}>
            {score ?? "—"}
          </div>
          <div style={{ fontSize: 9, fontWeight: 600, color, letterSpacing: "0.5px" }}>
            OVERALL · {score !== null ? trustLabel(score) : "INSUFFICIENT DATA"}
          </div>
        </div>
      </div>

      {hasContradiction && (
        <div style={{
          background: "rgba(255,54,33,0.10)", border: "1px solid rgba(255,54,33,0.25)",
          borderRadius: 6, padding: "10px 14px", marginBottom: 16,
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#FF3621", marginBottom: 2 }}>
            ⚠ CONTRADICTION DETECTED
          </div>
          <div style={{ fontSize: 9, color: "rgba(255,255,255,0.45)" }}>
            One or more structured fields conflict with free text. Expand a dimension to see details.
          </div>
        </div>
      )}

      <div style={{
        fontSize: 9, fontWeight: 700, color: "rgba(255,255,255,0.3)",
        letterSpacing: "0.5px", textTransform: "uppercase", marginBottom: 10,
      }}>
        Trust Dimensions
      </div>

      {trust_signals.map((signal) => {
        const dimScore = scoreToInt(signal.trust_score);
        const dimColor = trustColor(dimScore);
        const isInsufficient = signal.confidence_tier === "insufficient_data";

        return (
          <div key={signal.dimension} style={{
            border: `1px solid ${signal.contradiction ? "rgba(255,54,33,0.25)" : "rgba(255,255,255,0.07)"}`,
            borderRadius: 6, padding: "10px 14px", marginBottom: 8,
          }}>
            <div style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              marginBottom: isInsufficient ? 0 : 8,
            }}>
              <span style={{
                fontSize: 10, fontWeight: 600, letterSpacing: "0.5px",
                textTransform: "uppercase", color: "rgba(255,255,255,0.7)",
              }}>
                {signal.dimension}
                {signal.contradiction && <span style={{ color: "#FF3621", marginLeft: 6 }}>⚠</span>}
              </span>
              {isInsufficient ? (
                <span style={{
                  fontSize: 9, background: "rgba(251,191,36,0.12)",
                  color: "#fbbf24", padding: "2px 8px", borderRadius: 4, fontWeight: 600,
                }}>INSUFFICIENT DATA</span>
              ) : (
                <span style={{ fontSize: 12, fontWeight: 700, color: dimColor }}>
                  {dimScore} · {trustLabel(dimScore)}
                </span>
              )}
            </div>
            {!isInsufficient && dimScore !== null && (
              <div style={{ height: 4, background: "rgba(255,255,255,0.06)", borderRadius: 2 }}>
                <div style={{
                  height: "100%", width: `${dimScore}%`,
                  background: dimColor, borderRadius: 2, transition: "width 0.3s ease",
                }} />
              </div>
            )}
            {isInsufficient && signal.evidence_text && (
              <div style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", marginTop: 4 }}>
                {signal.evidence_text}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
