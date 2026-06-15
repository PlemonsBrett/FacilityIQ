import { useState, useEffect } from "react";
import type { FacilityDetail } from "./types";
import SearchPanel from "./components/SearchPanel";
import ScoreCard from "./components/ScoreCard";
import Sidebar from "./components/Sidebar";
import DashboardPage from "./pages/DashboardPage";
import QueuePage from "./pages/QueuePage";
import { ANALYST_ID } from "./lib/analyst";
import { fetchFacilityDetail } from "./lib/api";

export type View = "desk" | "dashboard" | "queue";
export { ANALYST_ID };

export default function App() {
  const [view, setView] = useState<View>("desk");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<FacilityDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  useEffect(() => {
    if (!selectedId) { setDetail(null); return; }
    setLoadingDetail(true);
    fetchFacilityDetail(selectedId)
      .then((data) => { setDetail(data); setLoadingDetail(false); })
      .catch(() => setLoadingDetail(false));
  }, [selectedId]);

  function navigateToFacility(id: string) {
    setSelectedId(id);
    setView("desk");
  }

  return (
    <div style={{
      display: "flex", height: "100vh", overflow: "hidden",
      background: "var(--fiq-bg)", color: "var(--fiq-text)",
      fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif",
    }}>
      <Sidebar view={view} onViewChange={setView} />

      {view === "desk" && (
        <>
          <div style={{
            width: 360, minWidth: 360, flexShrink: 0,
            borderRight: "1px solid var(--fiq-border)",
            display: "flex", flexDirection: "column", overflow: "hidden",
          }}>
            <SearchPanel onSelect={setSelectedId} selectedId={selectedId} />
          </div>
          <div style={{ flex: 1, overflowY: "auto", background: "var(--fiq-bg)" }}>
            {loadingDetail ? (
              <div style={{ padding: 32, color: "var(--fiq-text-faintest)", fontSize: 13 }}>Loading...</div>
            ) : detail ? (
              <ScoreCard detail={detail} analystId={ANALYST_ID} />
            ) : (
              <div style={{
                display: "flex", flexDirection: "column", alignItems: "center",
                justifyContent: "center", height: "100%", gap: 8,
                color: "var(--fiq-text-faintest)",
              }}>
                <div style={{ fontSize: 28 }}>⊞</div>
                <div style={{ fontSize: 12 }}>Select a facility to view its trust scorecard</div>
              </div>
            )}
          </div>
        </>
      )}

      {view === "dashboard" && (
        <div style={{ flex: 1, overflowY: "auto" }}>
          <DashboardPage analystId={ANALYST_ID} onNavigateToFacility={navigateToFacility} />
        </div>
      )}

      {view === "queue" && (
        <div style={{ flex: 1, overflowY: "auto" }}>
          <QueuePage analystId={ANALYST_ID} onNavigateToFacility={navigateToFacility} />
        </div>
      )}
    </div>
  );
}
