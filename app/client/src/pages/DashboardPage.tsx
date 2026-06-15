import { useMemo, useState, useEffect } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Cell, ResponsiveContainer,
  PieChart, Pie, Tooltip,
} from "recharts";
import { DUMMY_LIST, DUMMY_DETAILS, allActedFacilityIds, latestLocalActions } from "../lib/dummy";
import { overallScore, scoreToInt, trustColor, trustLabel } from "../types";
import type { FacilityListItem } from "../types";

interface Props {
  analystId: string;
  onNavigateToFacility: (id: string) => void;
}

function useChartColors() {
  const [isDark, setIsDark] = useState(
    document.documentElement.getAttribute("data-theme") !== "light",
  );
  useEffect(() => {
    const obs = new MutationObserver(() => {
      setIsDark(document.documentElement.getAttribute("data-theme") !== "light");
    });
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => obs.disconnect();
  }, []);
  return {
    high: isDark ? "#4ade80" : "#16a34a",
    med: isDark ? "#fbbf24" : "#b45309",
    low: isDark ? "#f87171" : "#dc2626",
    insuff: isDark ? "rgba(255,255,255,0.12)" : "rgba(15,23,42,0.1)",
  };
}

export default function DashboardPage({ analystId, onNavigateToFacility }: Props) {
  const colors = useChartColors();

  const stats = useMemo(() => {
    const facilityScores = DUMMY_LIST.map((f) => ({
      ...f,
      score: overallScore(DUMMY_DETAILS[f.facility_id]?.trust_signals ?? []),
    }));

    const buckets = [
      { label: "0–29", min: 0, max: 29 },
      { label: "30–39", min: 30, max: 39 },
      { label: "40–49", min: 40, max: 49 },
      { label: "50–59", min: 50, max: 59 },
      { label: "60–69", min: 60, max: 69 },
      { label: "70–79", min: 70, max: 79 },
      { label: "80–89", min: 80, max: 89 },
      { label: "90–100", min: 90, max: 100 },
    ];

    const distribution = buckets.map((b) => ({
      label: b.label,
      count: facilityScores.filter(
        (f) => f.score !== null && f.score >= b.min && f.score <= b.max,
      ).length,
      tier: b.max < 40 ? "low" : b.max < 70 ? "med" : "high",
    }));

    const allScoredDims = Object.values(DUMMY_DETAILS)
      .flatMap((d) => d.trust_signals)
      .filter((s) => s.confidence_tier !== "insufficient_data" && s.trust_score !== null)
      .map((s) => scoreToInt(s.trust_score) as number);
    const avgScore =
      allScoredDims.length
        ? Math.round(allScoredDims.reduce((a, b) => a + b, 0) / allScoredDims.length)
        : null;

    const dimensions = ["capability", "equipment", "procedure", "completeness"];
    const dimAvgs = dimensions.map((dim) => {
      const vals = Object.values(DUMMY_DETAILS)
        .flatMap((d) => d.trust_signals)
        .filter((s) => s.dimension === dim && s.confidence_tier !== "insufficient_data" && s.trust_score !== null)
        .map((s) => scoreToInt(s.trust_score) as number);
      return {
        dim,
        avg: vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null,
      };
    });

    const types = [
      ...new Set(DUMMY_LIST.map((f) => f.facility_type).filter(Boolean)),
    ] as string[];
    const typeBreakdown = types.map((t) => ({
      type: t,
      count: DUMMY_LIST.filter((f) => f.facility_type === t).length,
      contradictions: DUMMY_LIST.filter(
        (f) => f.facility_type === t && f.has_contradiction === 1,
      ).length,
    }));

    const scored = facilityScores
      .filter((f) => f.score !== null)
      .sort((a, b) => b.score! - a.score!);
    const top3 = scored.slice(0, 3);
    const bottom3 = scored.slice(-3).reverse();

    const actedIds = allActedFacilityIds(analystId);
    const shortlistedCount = actedIds.filter((id) =>
      latestLocalActions(id, analystId).some(
        (a) => a.action_type === "shortlist" && a.content === "added",
      ),
    ).length;
    const flaggedCount = actedIds.filter((id) =>
      latestLocalActions(id, analystId).some(
        (a) => a.action_type === "flag" && a.content === "flagged",
      ),
    ).length;

    const tierData = [
      { name: "High ≥70", value: facilityScores.filter((f) => f.score !== null && f.score >= 70).length, tier: "high" },
      { name: "Med 40–69", value: facilityScores.filter((f) => f.score !== null && f.score >= 40 && f.score < 70).length, tier: "med" },
      { name: "Low <40", value: facilityScores.filter((f) => f.score !== null && f.score < 40).length, tier: "low" },
      { name: "Insuff. data", value: facilityScores.filter((f) => f.score === null).length, tier: "insuff" },
    ];

    return {
      total: DUMMY_LIST.length,
      contradictionCount: DUMMY_LIST.filter((f) => f.has_contradiction === 1).length,
      avgScore,
      distribution,
      tierData,
      dimAvgs,
      typeBreakdown,
      top3,
      bottom3,
      shortlistedCount,
      flaggedCount,
    };
  }, [analystId]);

  const tierColor = (tier: string) =>
    tier === "high" ? colors.high : tier === "med" ? colors.med : tier === "low" ? colors.low : colors.insuff;

  const card: React.CSSProperties = {
    background: "var(--fiq-bg-surface)", border: "1px solid var(--fiq-border-md)",
    borderRadius: 8, padding: "14px 16px",
  };
  const sectionLabel: React.CSSProperties = {
    fontSize: 9, fontWeight: 700, color: "var(--fiq-text-code)",
    letterSpacing: "0.8px", textTransform: "uppercase", marginBottom: 14,
  };

  return (
    <div style={{ padding: "24px 28px" }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0, marginBottom: 4, color: "var(--fiq-text)" }}>
          Overview
        </h1>
        <p style={{ fontSize: 10, color: "var(--fiq-text-subdued)", margin: 0, letterSpacing: "0.5px", textTransform: "uppercase" }}>
          India Healthcare Facility Trust · {stats.total} facilities · Extraction complete
        </p>
      </div>

      {/* KPI row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10, marginBottom: 16 }}>
        {[
          { label: "Facilities", value: stats.total, color: "var(--fiq-text)" },
          { label: "Avg Trust Score", value: stats.avgScore ?? "—", color: trustColor(stats.avgScore) },
          { label: "Contradictions", value: stats.contradictionCount, color: "#FF3621" },
          { label: "Shortlisted", value: stats.shortlistedCount, color: "#60a5fa" },
          { label: "Flagged", value: stats.flaggedCount, color: "var(--fiq-trust-med)" },
        ].map(({ label, value, color }) => (
          <div key={label} style={card}>
            <div style={{ fontSize: 8, fontWeight: 700, color: "var(--fiq-text-code)", letterSpacing: "0.8px", textTransform: "uppercase", marginBottom: 6 }}>
              {label}
            </div>
            <div style={{ fontSize: 28, fontWeight: 800, lineHeight: 1, color }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Row 1: Bar chart + Donut */}
      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 12, marginBottom: 12 }}>
        {/* Score distribution */}
        <div style={card}>
          <div style={sectionLabel}>Score Distribution — All Facilities</div>
          <ResponsiveContainer width="100%" height={130}>
            <BarChart data={stats.distribution} margin={{ top: 4, right: 4, bottom: 0, left: -28 }}>
              <XAxis dataKey="label" tick={{ fontSize: 8, fill: "var(--fiq-text-code)" as string }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 8, fill: "var(--fiq-text-code)" as string }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip
                contentStyle={{ background: "var(--fiq-bg-surface)", border: "1px solid var(--fiq-border-strong)", borderRadius: 4, fontSize: 10 }}
                cursor={{ fill: "rgba(255,255,255,0.04)" }}
              />
              <Bar dataKey="count" radius={[3, 3, 0, 0]}>
                {stats.distribution.map((entry, i) => (
                  <Cell key={i} fill={tierColor(entry.tier)} fillOpacity={0.85} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Trust tier donut */}
        <div style={card}>
          <div style={sectionLabel}>Trust Tier Breakdown</div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <PieChart width={120} height={120}>
              <Pie
                data={stats.tierData}
                cx={55} cy={55}
                innerRadius={36} outerRadius={54}
                dataKey="value"
                startAngle={90} endAngle={-270}
                strokeWidth={0}
              >
                {stats.tierData.map((entry, i) => (
                  <Cell key={i} fill={tierColor(entry.tier)} />
                ))}
              </Pie>
            </PieChart>
            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              {stats.tierData.map((t) => (
                <div key={t.name} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: tierColor(t.tier), flexShrink: 0 }} />
                  <span style={{ fontSize: 9, color: "var(--fiq-text-subdued)" }}>{t.name}</span>
                  <span style={{ fontSize: 10, fontWeight: 700, color: tierColor(t.tier), marginLeft: 4 }}>{t.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Row 2: Dimension averages + Facility type breakdown */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
        {/* Dimension averages */}
        <div style={card}>
          <div style={sectionLabel}>Average Score by Dimension</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {stats.dimAvgs.map(({ dim, avg }) => (
              <div key={dim} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ fontSize: 9, color: "var(--fiq-text-subdued)", width: 84, textTransform: "uppercase", letterSpacing: "0.3px", flexShrink: 0 }}>
                  {dim}
                </div>
                <div style={{ flex: 1, height: 8, background: "var(--fiq-border)", borderRadius: 4, overflow: "hidden" }}>
                  {avg !== null && (
                    <div style={{ width: `${avg}%`, height: "100%", background: trustColor(avg), borderRadius: 4, transition: "width 0.4s ease" }} />
                  )}
                </div>
                <div style={{ fontSize: 11, fontWeight: 700, color: avg !== null ? trustColor(avg) : "var(--fiq-text-faintest)", width: 30, textAlign: "right" }}>
                  {avg ?? "—"}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Facility type breakdown */}
        <div style={card}>
          <div style={sectionLabel}>Facilities by Type</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
            {stats.typeBreakdown.map(({ type, count }) => (
              <div key={type} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ fontSize: 10, color: "var(--fiq-text-muted)", flex: 1 }}>{type}</div>
                <div style={{ width: 90, height: 5, background: "var(--fiq-border)", borderRadius: 3, overflow: "hidden" }}>
                  <div style={{ width: `${(count / stats.total) * 100}%`, height: "100%", background: "#60a5fa", borderRadius: 3 }} />
                </div>
                <div style={{ fontSize: 10, color: "var(--fiq-text-subdued)", width: 16, textAlign: "right" }}>{count}</div>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 9, fontWeight: 700, color: "var(--fiq-text-code)", letterSpacing: "0.8px", textTransform: "uppercase", marginBottom: 8 }}>
            Contradiction Rate by Type
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {stats.typeBreakdown.map(({ type, count, contradictions }) => (
              <div key={type} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ fontSize: 10, color: "var(--fiq-text-muted)", flex: 1 }}>{type}</div>
                <div style={{ width: 90, height: 5, background: "var(--fiq-border)", borderRadius: 3, overflow: "hidden" }}>
                  <div style={{ width: `${(contradictions / count) * 100}%`, height: "100%", background: "#FF3621", borderRadius: 3, opacity: 0.7 }} />
                </div>
                <div style={{ fontSize: 9, color: contradictions > 0 ? "#FF3621" : "var(--fiq-text-faintest)", width: 28, textAlign: "right", fontWeight: contradictions > 0 ? 700 : 400 }}>
                  {contradictions}/{count}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Top / Bottom facilities */}
      <div style={card}>
        <div style={sectionLabel}>Top & Bottom Facilities by Trust Score</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
          {[
            { heading: "HIGHEST TRUST", facilities: stats.top3 },
            { heading: "LOWEST TRUST", facilities: stats.bottom3 },
          ].map(({ heading, facilities }) => (
            <div key={heading}>
              <div style={{ fontSize: 8, color: "var(--fiq-text-faintest)", marginBottom: 8, letterSpacing: "0.5px" }}>{heading}</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {(facilities as (FacilityListItem & { score: number | null })[]).map((f) => (
                  <div
                    key={f.facility_id}
                    onClick={() => onNavigateToFacility(f.facility_id)}
                    style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      padding: "7px 10px", borderRadius: 5, cursor: "pointer",
                      border: "1px solid var(--fiq-border-md)",
                      background: "var(--fiq-bg-hover)",
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 600, color: "var(--fiq-text)" }}>{f.facility_name}</div>
                      <div style={{ fontSize: 8, color: "var(--fiq-text-subdued)" }}>{f.state}</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 14, fontWeight: 800, color: trustColor(f.score) }}>{f.score ?? "—"}</div>
                      <div style={{ fontSize: 8, color: trustColor(f.score), fontWeight: 600 }}>{trustLabel(f.score)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
