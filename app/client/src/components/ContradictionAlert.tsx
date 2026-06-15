import type { TrustSignal } from "../types";

interface Props {
  signals: TrustSignal[];
}

export default function ContradictionAlert({ signals }: Props) {
  const contradictions = signals.filter((s) => s.contradiction);
  if (contradictions.length === 0) return null;

  return (
    <div style={{
      background: "rgba(255,54,33,0.08)",
      border: "1px solid rgba(255,54,33,0.25)",
      borderRadius: 6, padding: "12px 14px", marginBottom: 16,
    }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: "#FF3621", marginBottom: 6 }}>
        ⚠ CONTRADICTION{contradictions.length > 1 ? "S" : ""} DETECTED · {contradictions.length} DIMENSION{contradictions.length > 1 ? "S" : ""}
      </div>
      {contradictions.map((s, i) => (
        <div key={s.dimension} style={{
          marginTop: i === 0 ? 0 : 8,
          paddingTop: i === 0 ? 0 : 8,
          borderTop: i === 0 ? "none" : "1px solid rgba(255,54,33,0.15)",
        }}>
          <div style={{
            fontSize: 9, fontWeight: 700, color: "#cc2d1a",
            textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 4,
          }}>
            {s.dimension}
          </div>
          {s.contradiction_detail && (
            <div style={{ fontSize: 10, color: "var(--fiq-text-faint)", lineHeight: 1.4 }}>
              {s.contradiction_detail}
            </div>
          )}
          <div style={{ fontSize: 9, color: "#cc2d1a", marginTop: 4, fontWeight: 600 }}>
            Expand the dimension below to see the conflicting evidence.
          </div>
        </div>
      ))}
    </div>
  );
}
