import { useState, useEffect, useRef, useCallback } from "react";
import { Joyride, ACTIONS, LIFECYCLE, STATUS, type EventData } from "react-joyride";
import type { FacilityDetail } from "./types";
import SearchPanel from "./components/SearchPanel";
import GuidedAnalysis from "./components/GuidedAnalysis";
import Sidebar from "./components/Sidebar";
import DashboardPage from "./pages/DashboardPage";
import KanbanPage from "./pages/KanbanPage";
import { ANALYST_ID } from "./lib/analyst";
import { fetchFacilityDetail } from "./lib/api";
import { buildTourSteps, TOUR_STEPS, type DashboardStats } from "./lib/tour";

export type View = "desk" | "dashboard" | "board";
export { ANALYST_ID };

const TOUR_KEY = "fiq_tour_seen";

interface Props {
  splashDone: boolean;
}

export default function App({ splashDone }: Props) {
  const [view, setView] = useState<View>("desk");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<FacilityDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Tour state
  const [tourRun, setTourRun] = useState(false);
  const [tourStepIndex, setTourStepIndex] = useState(0);
  const firstFacilityIdRef = useRef<string | null>(null);
  const tourWaitingForFacility = useRef(false);
  const [dashStats, setDashStats] = useState<DashboardStats | null>(null);
  const [statsLoaded, setStatsLoaded] = useState(false);

  // Fetch dashboard stats for dynamic tour copy; fail gracefully so tour still works
  useEffect(() => {
    fetch("/api/dashboard/stats")
      .then((r) => r.ok ? r.json() : null)
      .then((data: DashboardStats | null) => { if (data?.total_facilities != null) setDashStats(data); setStatsLoaded(true); })
      .catch(() => setStatsLoaded(true));
  }, []);

  // Auto-start after splash AND once stats are resolved (or failed)
  useEffect(() => {
    if (!splashDone || !statsLoaded) return;
    if (!localStorage.getItem(TOUR_KEY)) {
      setTourRun(true);
    }
  }, [splashDone, statsLoaded]);

  // Advance tour step once facility detail loads (for selectFirst steps)
  useEffect(() => {
    if (tourWaitingForFacility.current && detail) {
      tourWaitingForFacility.current = false;
      // Let React finish rendering the scorecard before Joyride scans
      setTimeout(() => setTourStepIndex((i) => i + 1), 150);
    }
  }, [detail]);

  function startTour() {
    setTourStepIndex(0);
    setTourRun(true);
  }

  function resetDemo() {
    localStorage.removeItem(TOUR_KEY);
    window.location.href = window.location.pathname + "?splash=on";
  }

  const selectFirstFacility = useCallback(() => {
    const id = firstFacilityIdRef.current;
    if (id) setSelectedId(id);
  }, []);

  const handleTourCallback = useCallback(
    (data: EventData) => {
      const { action, index, lifecycle, status } = data;
      // On Next: prep next step's view before advancing
      if (lifecycle === LIFECYCLE.COMPLETE && action === ACTIONS.NEXT) {
        const nextStep = TOUR_STEPS[index + 1];
        if (nextStep?.meta?.view) setView(nextStep.meta.view as View);
        if (nextStep?.meta?.selectFirst) {
          tourWaitingForFacility.current = true;
          selectFirstFacility();
          return; // defer advance until facility detail loads
        }
        setTourStepIndex(index + 1);
      }
      if (status === STATUS.FINISHED || status === STATUS.SKIPPED || action === ACTIONS.CLOSE) {
        setTourRun(false);
        localStorage.setItem(TOUR_KEY, "1");
      }
    },
    [selectFirstFacility],
  );

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
      <Joyride
        steps={buildTourSteps(dashStats)}
        run={tourRun}
        stepIndex={tourStepIndex}
        onEvent={handleTourCallback}
        continuous
        options={{
          buttons: ["close", "primary", "skip"],
          showProgress: true,
          skipBeacon: true,
          primaryColor: "#5FD3E3",
          backgroundColor: "var(--fiq-bg-surface)",
          textColor: "var(--fiq-text)",
          overlayColor: "rgba(6, 15, 18, 0.6)",
          zIndex: 10000,
        }}
        styles={{
          tooltip: {
            borderRadius: 10,
            border: "1px solid var(--fiq-border-md)",
          },
          buttonPrimary: {
            backgroundColor: "#5FD3E3",
            color: "#0B2026",
            borderRadius: 6,
            fontWeight: 700,
          },
          buttonBack: {
            color: "var(--fiq-text-subdued)",
          },
          buttonSkip: {
            color: "var(--fiq-text-faintest)",
          },
        }}
      />

      <Sidebar view={view} onViewChange={setView} onStartTour={startTour} onResetDemo={resetDemo} />

      {view === "desk" && (
        <>
          <div style={{
            width: 360, minWidth: 360, flexShrink: 0,
            borderRight: "1px solid var(--fiq-border)",
            display: "flex", flexDirection: "column", overflow: "hidden",
          }}>
            <SearchPanel
              onSelect={setSelectedId}
              selectedId={selectedId}
              onFirstFacilityId={(id) => { firstFacilityIdRef.current = id; }}
            />
          </div>
          <div style={{ flex: 1, overflowY: "auto", background: "var(--fiq-bg)" }}>
            {loadingDetail ? (
              <div style={{ padding: 32, color: "var(--fiq-text-faintest)", fontSize: 13 }}>Loading...</div>
            ) : detail ? (
              <GuidedAnalysis detail={detail} analystId={ANALYST_ID} />
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

      {view === "board" && (
        <div style={{ flex: 1, overflow: "hidden" }}>
          <KanbanPage onNavigateToFacility={navigateToFacility} />
        </div>
      )}
    </div>
  );
}
