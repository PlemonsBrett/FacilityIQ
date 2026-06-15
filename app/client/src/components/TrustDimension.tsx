import { useState } from "react";
import type { TrustSignal } from "../types";
import { scoreToInt, trustColor, trustLabel } from "../types";

interface Props {
  signal: TrustSignal;
}

export default function TrustDimension({ signal }: Props) {
  const [open, setOpen] = useState(false);
  const dimScore = scoreToInt(signal.trust_score);
  const color = trustColor(dimScore);
  const isInsufficient = signal.confidence_tier === "insufficient_data";

  return (
    <div style={{
      border: `1px solid ${signal.contradiction ? "rgba(255,54,33,0.3)" : "var(--fiq-border-md)"}`,
      borderRadius: 6, marginBottom: 8, overflow: "hidden",
    }}>
      <div
        onClick={() => setOpen((o) => !o)}
        style={{
          padding: "10px 14px", cursor: "pointer",
          background: open ? "var(--fiq-bg-hover)" : "transparent",
          display: "flex", flexDirection: "column", gap: 6,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{
            fontSize: 10, fontWeight: 600, letterSpacing: "0.5px",
            textTransform: "uppercase", color: "var(--fiq-text-muted)",
          }}>
            {signal.dimension}
            {signal.contradiction && (
              <span style={{ color: "#FF3621", marginLeft: 6 }}>⚠</span>
            )}
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {isInsufficient ? (
              <span style={{
                fontSize: 9,
                background: "var(--fiq-insufficient-bg)",
                color: "var(--fiq-insufficient-text)",
                padding: "2px 8px", borderRadius: 4, fontWeight: 600,
              }}>
                INSUFFICIENT DATA
              </span>
            ) : (
              <span style={{ fontSize: 12, fontWeight: 700, color }}>
                {dimScore} · {trustLabel(dimScore)}
              </span>
            )}
            <span style={{ fontSize: 10, color: "var(--fiq-text-faintest)" }}>
              {open ? "▲" : "▼"}
            </span>
          </div>
        </div>
        {!isInsufficient && dimScore !== null && (
          <div style={{ height: 4, background: "var(--fiq-border)", borderRadius: 2 }}>
            <div style={{
              height: "100%", width: `${dimScore}%`,
              background: color, borderRadius: 2, transition: "width 0.3s ease",
            }} />
          </div>
        )}
      </div>

      {open && (
        <div style={{
          borderTop: "1px solid var(--fiq-border)",
          padding: "10px 14px", background: "var(--fiq-bg-expanded)",
        }}>
          {isInsufficient && signal.evidence_text && (
            <p style={{ fontSize: 9, color: "var(--fiq-text-faint)", margin: 0 }}>
              {signal.evidence_text}
            </p>
          )}

          {!isInsufficient && signal.evidence_text && (
            <div style={{ marginBottom: signal.contradiction ? 10 : 0 }}>
              <div style={{
                fontSize: 8, fontWeight: 600, color: "var(--fiq-text-code)",
                textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 6,
              }}>
                Evidence · {signal.source_field ?? "unknown field"}
              </div>
              <div style={{
                borderLeft: "2px solid var(--fiq-evidence-border)", paddingLeft: 10,
                fontSize: 11, color: "var(--fiq-text-light)",
                fontStyle: "italic", lineHeight: 1.5,
              }}>
                "{signal.evidence_text}"
              </div>
            </div>
          )}

          {signal.contradiction && signal.contradiction_detail && (
            <div style={{
              background: "rgba(255,54,33,0.08)",
              border: "1px solid rgba(255,54,33,0.2)",
              borderRadius: 4, padding: "8px 10px",
              marginTop: signal.evidence_text && !isInsufficient ? 10 : 0,
            }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: "#FF3621", marginBottom: 3 }}>
                CONTRADICTION DETAIL
              </div>
              <div style={{ fontSize: 10, color: "var(--fiq-text-faint)", lineHeight: 1.4 }}>
                {signal.contradiction_detail}
              </div>
            </div>
          )}

          {!isInsufficient && !signal.evidence_text && (
            <p style={{ fontSize: 9, color: "var(--fiq-text-faintest)", margin: 0 }}>
              No evidence text available for this dimension.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
