import { useState, useEffect } from "react";
import type { UserAction } from "../types";
import { fetchActions, postAction } from "../lib/api";

interface Props {
  facilityId: string;
  analystId: string;
}

export default function Workbench({ facilityId, analystId }: Props) {
  const [noteText, setNoteText] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [noteSaved, setNoteSaved] = useState(false);

  useEffect(() => {
    fetchActions(facilityId, analystId).then((data: UserAction[]) => {
      const note = data.find((a) => a.action_type === "note");
      if (note?.content) setNoteText(note.content);
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

  return (
    <div data-tour="workbench" className="rounded-2xl overflow-hidden" style={{ border: "1px solid var(--fiq-border)" }}>
      <div
        className="px-4 py-2 text-[9px] font-bold uppercase tracking-widest"
        style={{ color: "var(--fiq-text-code)", background: "var(--fiq-bg-surface)", borderBottom: "1px solid var(--fiq-border)" }}
      >
        Analyst Notes
      </div>
      <div className="p-4" style={{ background: "var(--fiq-bg-surface)" }}>
        <textarea
          value={noteText}
          onChange={(e) => setNoteText(e.target.value)}
          rows={3}
          placeholder="Add a note about this facility..."
          className="w-full resize-none text-sm outline-none rounded-lg px-3 py-2"
          style={{ background: "var(--fiq-bg-input)", border: "1px solid var(--fiq-border-strong)", color: "var(--fiq-text)" }}
        />
        <button
          onClick={saveNote}
          disabled={savingNote || !noteText.trim()}
          className="mt-2 px-4 py-1.5 text-xs font-semibold rounded-lg disabled:opacity-40 transition-opacity"
          style={{ background: "var(--fiq-text)", color: "var(--fiq-bg)" }}
        >
          {noteSaved ? "✓ Saved" : savingNote ? "Saving…" : "Save Note"}
        </button>
      </div>
    </div>
  );
}
