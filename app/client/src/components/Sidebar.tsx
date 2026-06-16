import { useState } from "react";
import type { View } from "../App";
import { getTheme, toggleTheme } from "../lib/theme";

interface Props {
  view: View;
  onViewChange: (v: View) => void;
  onStartTour: () => void;
  onResetDemo: () => void;
}

const NAV: { view: View; icon: string; label: string }[] = [
  { view: "desk", icon: "⊞", label: "Trust Desk" },
  { view: "dashboard", icon: "◫", label: "Dashboard" },
  { view: "board", icon: "⊟", label: "Board" },
];

export default function Sidebar({ view, onViewChange, onStartTour, onResetDemo }: Props) {
  const [isDark, setIsDark] = useState(getTheme() === "dark");

  function handleTheme() {
    setIsDark(toggleTheme() === "dark");
  }

  const btnBase: React.CSSProperties = {
    width: 28, height: 28, border: "none", cursor: "pointer",
    borderRadius: 5, fontSize: 14,
    display: "flex", alignItems: "center", justifyContent: "center",
    position: "relative", background: "transparent",
  };

  const tip: React.CSSProperties = {
    position: "absolute", left: 36, top: "50%", transform: "translateY(-50%)",
    background: "rgba(15,23,42,0.92)", color: "#ffffff",
    fontSize: 10, padding: "3px 8px", borderRadius: 4,
    whiteSpace: "nowrap", pointerEvents: "none",
    border: "1px solid rgba(255,255,255,0.1)", zIndex: 50,
  };

  return (
    <div style={{
      width: 40, flexShrink: 0,
      background: "var(--fiq-bg-surface)",
      borderRight: "1px solid var(--fiq-border)",
      display: "flex", flexDirection: "column",
      alignItems: "center", padding: "10px 0", gap: 6,
    }}>
      <svg
        viewBox="0 0 264 263"
        aria-label="FacilityIQ"
        style={{ width: 24, height: 24, marginBottom: 8, color: "var(--fiq-text)", opacity: 0.85, flexShrink: 0 }}
        fill="currentColor"
      >
        <g transform="translate(0,263) scale(0.1,-0.1)">
          <path d="M1130 2623 c-288 -47 -516 -161 -724 -362 -203 -198 -335 -453 -382 -739 -20 -118 -14 -371 11 -472 65 -270 181 -479 364 -660 192 -191 404 -306 664 -362 134 -28 370 -31 500 -5 160 32 353 113 489 204 458 310 678 878 543 1407 -108 426 -406 765 -805 915 -165 62 -278 81 -472 80 -89 -1 -174 -4 -188 -6z m562 -776 c232 -84 372 -279 372 -517 -1 -134 -22 -204 -100 -337 l-19 -32 55 -56 54 -55 -59 -60 c-33 -33 -63 -60 -67 -60 -4 0 -30 25 -59 55 -28 30 -56 55 -62 55 -6 0 -33 -11 -61 -24 -113 -52 -284 -66 -401 -32 -242 71 -404 288 -405 542 0 80 32 202 72 273 47 82 141 172 223 213 61 31 90 40 180 62 50 12 213 -3 277 -27z m-907 -527 l0 -535 -102 -3 -103 -3 0 541 0 541 103 -3 102 -3 0 -535z" />
          <path d="M1407 1676 c-103 -28 -200 -125 -233 -232 -21 -68 -20 -181 2 -246 33 -100 90 -167 184 -214 47 -24 67 -28 140 -28 60 -1 97 5 124 17 l40 18 -75 75 -74 76 64 59 65 60 74 -78 75 -78 26 55 c22 48 25 69 26 160 0 93 -3 111 -26 160 -77 164 -241 242 -412 196z" />
        </g>
      </svg>

      {NAV.map(({ view: v, icon, label }) => (
        <button
          key={v}
          onClick={() => onViewChange(v)}
          className="fiq-sidebar-btn"
          title={label}
          style={{
            ...btnBase,
            background: view === v ? "rgba(255,255,255,0.07)" : "transparent",
            color: view === v ? "var(--fiq-text)" : "var(--fiq-text-faintest)",
          }}
        >
          {icon}
          <span className="fiq-sidebar-tip" style={tip}>{label}</span>
        </button>
      ))}

      <div style={{ flex: 1 }} />

      {/* Start Tour button */}
      <button
        onClick={onStartTour}
        className="fiq-sidebar-btn"
        title="Start Tour"
        style={{ ...btnBase, color: "#5FD3E3", fontSize: 13 }}
      >
        ◎
        <span className="fiq-sidebar-tip" style={tip}>Start Tour</span>
      </button>

      {/* Theme toggle */}
      <button
        onClick={handleTheme}
        className="fiq-sidebar-btn"
        title={isDark ? "Light mode" : "Dark mode"}
        style={{ ...btnBase, color: "var(--fiq-text-faintest)", fontSize: 13 }}
      >
        {isDark ? "☀" : "◑"}
        <span className="fiq-sidebar-tip" style={tip}>
          {isDark ? "Light mode" : "Dark mode"}
        </span>
      </button>

      {/* Hidden reset — small dot, no tooltip, restores splash+tour for next judge */}
      <button
        onClick={onResetDemo}
        title=""
        aria-label="Reset demo"
        style={{
          ...btnBase,
          width: 6, height: 6,
          borderRadius: "50%",
          background: "var(--fiq-border)",
          marginBottom: 4,
          opacity: 0.3,
        }}
      />
    </div>
  );
}
