import { useState } from "react";
import type { View } from "../App";
import { getTheme, toggleTheme } from "../lib/theme";

interface Props {
  view: View;
  onViewChange: (v: View) => void;
}

const NAV: { view: View; icon: string; label: string }[] = [
  { view: "desk", icon: "⊞", label: "Trust Desk" },
  { view: "dashboard", icon: "◫", label: "Dashboard" },
  { view: "board", icon: "⊟", label: "Board" },
];

export default function Sidebar({ view, onViewChange }: Props) {
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
    background: "#1e3a42", color: "var(--fiq-text)",
    fontSize: 10, padding: "3px 8px", borderRadius: 4,
    whiteSpace: "nowrap", pointerEvents: "none",
    border: "1px solid var(--fiq-border-strong)", zIndex: 50,
  };

  return (
    <div style={{
      width: 40, flexShrink: 0,
      background: "var(--fiq-bg-surface)",
      borderRight: "1px solid var(--fiq-border)",
      display: "flex", flexDirection: "column",
      alignItems: "center", padding: "10px 0", gap: 6,
    }}>
      <div style={{ width: 4, height: 16, background: "#FF3621", borderRadius: 1, marginBottom: 8 }} />

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
    </div>
  );
}
