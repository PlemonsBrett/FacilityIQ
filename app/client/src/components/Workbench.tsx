import { useState, useEffect } from "react";
import type { UserAction, TrustSignal } from "../types";
import { fetchActions, postAction } from "../lib/api";

interface Props {
  facilityId: string;
  analystId: string;
  signals: TrustSignal[];
}

export default function Workbench({ facilityId, analystId, signals }: Props) {
  const [noteText, setNoteText] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [noteSaved, setNoteSaved] = useState(false);
  const [shortlisted, setShortlisted] = useState(false);
  const [flagged, setFlagged] = useState(false);

  const scoredDimensions = signals
    .filter((s) => s.confidence_tier !== "insufficient_data")
    .map((s) => s.dimension);

  const [overrideDimension, setOverrideDimension] = useState(scoredDimensions[0] ?? "");
  const [overrideScore, setOverrideScore] = useState("");
  const [overrideReason, setOverrideReason] = useState("");
  const [savingOverride, setSavingOverride] = useState(false);
  const [overrideSaved, setOverrideSaved] = useState(false);

  useEffect(() => {
    fetchActions(facilityId, analystId).then((data: UserAction[]) => {
      const note = data.find((a) => a.action_type === "note");
      if (note?.content) setNoteText(note.content);
      setShortlisted(data.some((a) => a.action_type === "shortlist" && a.content === "added"));
      setFlagged(data.some((a) => a.action_type === "flag" && a.content === "flagged"));
    });
  }, [facilityId, analystId]);

  async function saveNote() {
    if (!noteText.trim()) return;
    setSavingNote(true);
    await postAction(facilityId, analystId, "note", noteText.trim());
    setSavingNote(false);
    setNoteSaved(true);
    setTimeout(() => setNoteSaved(false), 2000);
  }

  async function toggleShortlist() {
    const next = !shortlisted;
    await postAction(facilityId, analystId, "shortlist", next ? "added" : "removed");
    setShortlisted(next);
  }

  async function toggleFlag() {
    const next = !flagged;
    await postAction(facilityId, analystId, "flag", next ? "flagged" : "cleared");
    setFlagged(next);
  }

  async function saveOverride() {
    if (!overrideDimension || !overrideScore || !overrideReason.trim()) return;
    setSavingOverride(true);
    await postAction(
      facilityId, analystId, "override",
      overrideReason.trim(), overrideDimension, parseFloat(overrideScore),
    );
    setSavingOverride(false);
    setOverrideSaved(true);
    setOverrideScore("");
    setOverrideReason("");
    setTimeout(() => setOverrideSaved(false), 2000);
  }

  const cell: React.CSSProperties = {
    border: "1px solid var(--fiq-border-md)",
    borderRadius: 5, padding: "10px 12px", background: "var(--fiq-bg-cell)",
  };
  const label: React.CSSProperties = {
    fontSize: 9, fontWeight: 600, color: "var(--fiq-text-faint)",
    letterSpacing: "0.5px", textTransform: "uppercase", marginBottom: 7,
  };
  const inputBase: React.CSSProperties = {
    width: "100%", boxSizing: "border-box",
    background: "var(--fiq-bg-input)", border: "1px solid var(--fiq-border-strong)",
    borderRadius: 4, color: "var(--fiq-text)", fontSize: 11, outline: "none", resize: "none",
  };
  const btn = (active?: boolean): React.CSSProperties => ({
    display: "block", width: "100%", marginTop: 6,
    background: active ? "#FF3621" : "var(--fiq-border)",
    color: active ? "white" : "var(--fiq-text-muted)",
    border: "none", borderRadius: 4, padding: "5px 8px",
    fontSize: 10, cursor: "pointer", fontWeight: 600,
  });

  return (
    <div style={{ marginTop: 20 }}>
      <div style={{
        background: "var(--fiq-bg-surface)", padding: "8px 14px",
        fontSize: 9, fontWeight: 700, color: "var(--fiq-text-dim)",
        letterSpacing: "1px", borderRadius: "6px 6px 0 0",
        border: "1px solid var(--fiq-border-md)", borderBottom: "none",
      }}>
        ANALYST WORKBENCH
      </div>

      <div style={{
        border: "1px solid var(--fiq-border-md)", borderRadius: "0 0 6px 6px",
        display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1,
        background: "var(--fiq-border-md)", overflow: "hidden",
      }}>
        {/* Notes */}
        <div style={cell}>
          <div style={label}>Notes</div>
          <textarea
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            rows={3}
            placeholder="Add a note about this facility..."
            style={{ ...inputBase, padding: "6px 8px" }}
          />
          <button onClick={saveNote} disabled={savingNote} style={btn()}>
            {noteSaved ? "✓ Saved" : savingNote ? "Saving..." : "Save Note"}
          </button>
        </div>

        {/* Override */}
        <div style={cell}>
          <div style={label}>Override Score</div>
          {scoredDimensions.length === 0 ? (
            <div style={{ fontSize: 10, color: "var(--fiq-text-faintest)" }}>
              No scored dimensions available to override.
            </div>
          ) : (
            <>
              <select
                value={overrideDimension}
                onChange={(e) => setOverrideDimension(e.target.value)}
                style={{ ...inputBase, padding: "5px 7px", marginBottom: 4 }}
              >
                {scoredDimensions.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
              <input
                type="number" min={0} max={100}
                value={overrideScore}
                onChange={(e) => setOverrideScore(e.target.value)}
                placeholder="New score (0–100)"
                style={{ ...inputBase, padding: "5px 7px", marginBottom: 4 }}
              />
              <input
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                placeholder="Reason (required)"
                style={{ ...inputBase, padding: "5px 7px" }}
              />
              <button onClick={saveOverride} disabled={savingOverride} style={btn()}>
                {overrideSaved ? "✓ Saved" : savingOverride ? "Saving..." : "Apply Override"}
              </button>
            </>
          )}
        </div>

        {/* Shortlist */}
        <div style={cell}>
          <div style={label}>Shortlist</div>
          <div style={{ fontSize: 10, color: "var(--fiq-text-faint)", marginBottom: 6 }}>
            {shortlisted ? "Added to your shortlist." : "Add this facility to your shortlist for review."}
          </div>
          <button onClick={toggleShortlist} style={btn(shortlisted)}>
            {shortlisted ? "★ Shortlisted" : "☆ Add to Shortlist"}
          </button>
        </div>

        {/* Flag */}
        <div style={cell}>
          <div style={label}>Flag for Review</div>
          <div style={{ fontSize: 10, color: "var(--fiq-text-faint)", marginBottom: 6 }}>
            {flagged ? "Flagged — manual review required." : "Flag this facility for manual follow-up."}
          </div>
          <button onClick={toggleFlag} style={btn(flagged)}>
            {flagged ? "⚑ Flagged" : "⚐ Flag for Review"}
          </button>
        </div>
      </div>
    </div>
  );
}
