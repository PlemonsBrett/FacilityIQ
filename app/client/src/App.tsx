import { useState, useEffect } from "react";
import type { FacilityDetail } from "./types";
import SearchPanel from "./components/SearchPanel";
import ScoreCard from "./components/ScoreCard";
import { ANALYST_ID } from "./lib/analyst";

export { ANALYST_ID };

export default function App() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<FacilityDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  useEffect(() => {
    if (!selectedId) { setDetail(null); return; }
    setLoadingDetail(true);
    fetch(`/api/facilities/${selectedId}`)
      .then((r) => r.json())
      .then((data: FacilityDetail) => { setDetail(data); setLoadingDetail(false); })
      .catch(() => setLoadingDetail(false));
  }, [selectedId]);

  return (
    <div style={{
      display: "flex", height: "100vh", overflow: "hidden",
      background: "#0B2026", color: "white",
      fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif",
    }}>
      <div style={{
        width: 360, minWidth: 360, flexShrink: 0,
        borderRight: "1px solid rgba(255,255,255,0.06)",
        display: "flex", flexDirection: "column", overflow: "hidden",
      }}>
        <SearchPanel onSelect={setSelectedId} selectedId={selectedId} />
      </div>
      <div style={{ flex: 1, overflowY: "auto", background: "#0B2026" }}>
        {loadingDetail ? (
          <div style={{ padding: 32, color: "rgba(255,255,255,0.3)", fontSize: 13 }}>Loading...</div>
        ) : detail ? (
          <ScoreCard detail={detail} analystId={ANALYST_ID} />
        ) : (
          <div style={{
            display: "flex", flexDirection: "column", alignItems: "center",
            justifyContent: "center", height: "100%", gap: 8,
            color: "rgba(255,255,255,0.2)",
          }}>
            <div style={{ fontSize: 28 }}>⊞</div>
            <div style={{ fontSize: 12 }}>Select a facility to view its trust scorecard</div>
          </div>
        )}
      </div>
    </div>
  );
}
