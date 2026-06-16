import { useState, useEffect } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Cell, ResponsiveContainer,
  PieChart, Pie, Tooltip,
} from "recharts";
import { fetchDashboardData } from "../lib/api";
import { trustColor, trustLabel } from "../types";
import type { DashboardData, FacilityListItem } from "../types";

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
  const [stats, setStats] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

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

  useEffect(() => {
    let cancelled = false;
    void fetchDashboardData(analystId)
      .then((data) => {
        if (!cancelled) setStats(data);
      })
      .catch(() => {
        if (!cancelled) setStats(null);
      })
      .then(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [analystId]);

  if (loading) {
    return (
      <div style={{ padding: "24px 28px" }}>
        <div style={card}>Loading dashboard...</div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div style={{ padding: "24px 28px" }}>
        <div style={card}>
          <div style={sectionLabel}>Dashboard unavailable</div>
          <div style={{ color: "var(--fiq-text-subdued)", fontSize: 12 }}>
            Live dashboard data could not be loaded from Lakebase.
          </div>
        </div>
      </div>
    );
  }

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
      <div data-tour="dashboard-kpis" style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10, marginBottom: 16 }}>
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
        <div data-tour="score-distribution" style={card}>
          <div style={sectionLabel}>Score Distribution — All Facilities</div>
          <ResponsiveContainer width="100%" height={130}>
            <BarChart data={stats.distribution} margin={{ top: 4, right: 4, bottom: 0, left: -28 }}>
              <XAxis dataKey="label" tick={{ fontSize: 8, fill: "var(--fiq-text-code)" as string }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 8, fill: "var(--fiq-text-code)" as string }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip
                contentStyle={{ background: "var(--fiq-bg-surface)", border: "1px solid var(--fiq-border-strong)", borderRadius: 4, fontSize: 10, color: "var(--fiq-text)" }}
                cursor={{ fill: "rgba(255,255,255,0.04)" }}
              />
              <Bar dataKey="count" radius={[3, 3, 0, 0]}>
                {stats.distribution.map((entry) => (
                  <Cell key={entry.label} fill={tierColor(entry.tier)} fillOpacity={0.85} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Trust tier donut */}
        <div data-tour="trust-tier-donut" style={card}>
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
                {stats.tierData.map((entry) => (
                  <Cell key={entry.name} fill={tierColor(entry.tier)} />
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
        <div data-tour="dimension-averages" style={card}>
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
        <div data-tour="type-breakdown" style={card}>
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
      <div data-tour="top-bottom-facilities" style={card}>
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
