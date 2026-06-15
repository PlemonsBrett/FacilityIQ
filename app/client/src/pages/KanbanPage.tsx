import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  DndContext,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import type { ReviewCard, ReviewStatus } from "../types";
import { scoreToInt, trustColor } from "../types";
import { DUMMY_LIST } from "../lib/dummy";
import { fetchBoardColumn, postReviewStatus } from "../lib/api";

// ── Column config ─────────────────────────────────────────────────────────────

const COLUMNS: { status: ReviewStatus; label: string; accent: string }[] = [
  { status: "not_started",         label: "Not Started", accent: "#94a3b8" },
  { status: "in_progress",         label: "In Review",   accent: "#60a5fa" },
  { status: "email_sent",          label: "Email Sent",  accent: "#a78bfa" },
  { status: "called",              label: "Called",      accent: "#fb923c" },
  { status: "parked",              label: "Parked",      accent: "#64748b" },
  { status: "validation_complete", label: "Validated",   accent: "#4ade80" },
];

// ── Drag preview (shown in DragOverlay) ───────────────────────────────────────

function CardPreview({ card }: { card: ReviewCard }) {
  const listItem = DUMMY_LIST.find((f) => f.facility_id === card.facility_id);
  const score = listItem ? scoreToInt(listItem.overall_trust_score) : null;
  return (
    <div
      className="rounded-xl p-3 shadow-2xl"
      style={{
        width: 260,
        background: "var(--fiq-bg)",
        border: "1px solid var(--fiq-border)",
        opacity: 0.92,
        transform: "rotate(1.5deg)",
      }}
    >
      <div
        className="text-sm font-semibold"
        style={{ color: "var(--fiq-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
      >
        {card.facility_name}
      </div>
      <div className="text-[10px] mt-0.5 flex items-center gap-2" style={{ color: "var(--fiq-text-subdued)" }}>
        <span>{[card.state, card.facility_type].filter(Boolean).join(" · ")}</span>
        {score !== null && (
          <span style={{ color: trustColor(score), fontWeight: 700 }}>{score}</span>
        )}
      </div>
    </div>
  );
}

// ── KanbanCard (draggable) ────────────────────────────────────────────────────

function KanbanCard({
  card,
  onMove,
  onNavigate,
}: {
  card: ReviewCard;
  onMove: (card: ReviewCard, to: ReviewStatus) => void;
  onNavigate: (id: string) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const listItem = DUMMY_LIST.find((f) => f.facility_id === card.facility_id);
  const score = listItem ? scoreToInt(listItem.overall_trust_score) : null;

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: card.facility_id,
    data: { card },
  });

  return (
    <div
      ref={setNodeRef}
      className="group"
      style={{
        transform: CSS.Transform.toString(transform),
        opacity: isDragging ? 0.3 : 1,
        background: "var(--fiq-bg)",
        border: "1px solid var(--fiq-border)",
        borderRadius: "0.75rem",
        padding: "0.75rem",
        cursor: isDragging ? "grabbing" : "grab",
        touchAction: "none",
      }}
      {...attributes}
      {...listeners}
      onClick={() => !menuOpen && !isDragging && onNavigate(card.facility_id)}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div
            className="text-sm font-semibold leading-snug"
            style={{ color: "var(--fiq-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
          >
            {card.facility_name}
          </div>
          <div className="text-[10px] mt-0.5" style={{ color: "var(--fiq-text-subdued)" }}>
            {[card.state, card.facility_type].filter(Boolean).join(" · ")}
          </div>
          {card.parked_reason && (
            <div className="text-[10px] mt-1 italic" style={{ color: "var(--fiq-text-faintest)" }}>
              {card.parked_reason}
            </div>
          )}
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {score !== null && (
            <span className="text-[10px] font-bold" style={{ color: trustColor(score) }}>
              {score}
            </span>
          )}
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); setMenuOpen((o) => !o); }}
            className="opacity-0 group-hover:opacity-100 transition-opacity rounded text-[11px] px-1"
            style={{ color: "var(--fiq-text-faintest)", background: "var(--fiq-bg-input)" }}
          >
            ···
          </button>
        </div>
      </div>

      {menuOpen && (
        <div
          className="mt-2 rounded-lg overflow-hidden"
          style={{ border: "1px solid var(--fiq-border)", background: "var(--fiq-bg-surface)" }}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          {COLUMNS.filter((c) => c.status !== card.status).map((c) => (
            <button
              key={c.status}
              onClick={() => { setMenuOpen(false); onMove(card, c.status); }}
              className="w-full text-left flex items-center gap-2 px-3 py-1.5 text-[10px] transition-opacity hover:opacity-70"
              style={{ color: "var(--fiq-text-muted)" }}
            >
              <span style={{ color: c.accent }}>●</span>
              {c.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── KanbanColumn (droppable) ──────────────────────────────────────────────────

function KanbanColumn({
  status,
  label,
  accent,
  cards,
  onMove,
  onNavigate,
}: {
  status: ReviewStatus;
  label: string;
  accent: string;
  cards: ReviewCard[];
  onMove: (card: ReviewCard, to: ReviewStatus) => void;
  onNavigate: (id: string) => void;
}) {
  const { isOver, setNodeRef } = useDroppable({ id: status });

  return (
    <div
      className="flex flex-col flex-shrink-0 rounded-xl overflow-hidden"
      style={{
        width: 260,
        background: isOver ? `${accent}14` : "var(--fiq-bg-surface)",
        border: `1px solid ${isOver ? accent : "var(--fiq-border)"}`,
        transition: "background 0.15s, border-color 0.15s",
      }}
    >
      <div
        className="flex items-center justify-between px-3 py-2.5 flex-shrink-0"
        style={{ borderBottom: "1px solid var(--fiq-border)", borderLeft: `3px solid ${accent}` }}
      >
        <span className="text-[11px] font-semibold" style={{ color: "var(--fiq-text)" }}>
          {label}
        </span>
        <span
          className="text-[10px] font-bold px-2 py-0.5 rounded-full"
          style={{ background: `${accent}22`, color: accent }}
        >
          {cards.length}
        </span>
      </div>

      <div
        ref={setNodeRef}
        className="flex flex-col gap-2 p-2 overflow-y-auto"
        style={{ minHeight: 80, maxHeight: "calc(100vh - 170px)" }}
      >
        {cards.length === 0 ? (
          <div className="text-[10px] text-center py-6" style={{ color: "var(--fiq-text-faintest)" }}>
            {isOver ? "Drop here" : "No facilities"}
          </div>
        ) : (
          cards.map((card) => (
            <KanbanCard
              key={card.facility_id}
              card={card}
              onMove={onMove}
              onNavigate={onNavigate}
            />
          ))
        )}
      </div>
    </div>
  );
}

// ── ParkedReasonModal ─────────────────────────────────────────────────────────

function ParkedReasonModal({
  facilityName,
  onConfirm,
  onCancel,
}: {
  facilityName: string;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
}) {
  const [reason, setReason] = useState("");
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.5)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div
        className="w-full max-w-sm mx-4 rounded-2xl p-6 shadow-2xl"
        style={{ background: "var(--fiq-bg-surface)", border: "1px solid var(--fiq-border)" }}
      >
        <h3 className="font-semibold text-sm mb-1" style={{ color: "var(--fiq-text)" }}>Park Facility</h3>
        <p className="text-xs mb-4" style={{ color: "var(--fiq-text-faintest)" }}>{facilityName}</p>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Reason for parking (required)"
          rows={3}
          className="w-full rounded-lg px-3 py-2 text-sm resize-none outline-none mb-4"
          style={{ background: "var(--fiq-bg-input)", border: "1px solid var(--fiq-border-strong)", color: "var(--fiq-text)" }}
        />
        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="px-4 py-1.5 text-xs font-semibold rounded-lg border"
            style={{ borderColor: "var(--fiq-border)", color: "var(--fiq-text-faintest)" }}
          >
            Cancel
          </button>
          <button
            onClick={() => reason.trim() && onConfirm(reason.trim())}
            disabled={!reason.trim()}
            className="px-4 py-1.5 text-xs font-semibold rounded-lg disabled:opacity-40"
            style={{ background: "var(--fiq-text)", color: "var(--fiq-bg)" }}
          >
            Park
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

// ── KanbanPage ────────────────────────────────────────────────────────────────

interface Props {
  onNavigateToFacility: (id: string) => void;
}

export default function KanbanPage({ onNavigateToFacility }: Props) {
  const [columns, setColumns] = useState<Record<ReviewStatus, ReviewCard[]>>(() => {
    const empty = {} as Record<ReviewStatus, ReviewCard[]>;
    COLUMNS.forEach((c) => { empty[c.status] = []; });
    return empty;
  });
  const [loading, setLoading] = useState(true);
  const [parkingCard, setParkingCard] = useState<ReviewCard | null>(null);
  const [activeCard, setActiveCard] = useState<ReviewCard | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
  );

  useEffect(() => {
    Promise.all(COLUMNS.map((c) => fetchBoardColumn(c.status))).then((results) => {
      const map = {} as Record<ReviewStatus, ReviewCard[]>;
      COLUMNS.forEach((col, i) => { map[col.status] = results[i]; });
      setColumns(map);
      setLoading(false);
    });
  }, []);

  function findCard(id: string): ReviewCard | null {
    for (const { status } of COLUMNS) {
      const found = columns[status]?.find((c) => c.facility_id === id);
      if (found) return found;
    }
    return null;
  }

  function handleDragStart(event: DragStartEvent) {
    setActiveCard(findCard(event.active.id as string));
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveCard(null);
    const { active, over } = event;
    if (!over) return;
    const card = findCard(active.id as string);
    const toStatus = over.id as ReviewStatus;
    if (!card || toStatus === card.status) return;
    if (toStatus === "parked") { setParkingCard(card); return; }
    doMove(card, toStatus, null);
  }

  async function handleMove(card: ReviewCard, toStatus: ReviewStatus) {
    if (toStatus === "parked") { setParkingCard(card); return; }
    await doMove(card, toStatus, null);
  }

  async function doMove(card: ReviewCard, toStatus: ReviewStatus, parkedReason: string | null) {
    setColumns((prev) => {
      const next = { ...prev };
      next[card.status] = (next[card.status] ?? []).filter((c) => c.facility_id !== card.facility_id);
      const moved: ReviewCard = { ...card, status: toStatus, parked_reason: parkedReason, updated_at: new Date().toISOString() };
      next[toStatus] = [moved, ...(next[toStatus] ?? [])];
      return next;
    });
    await postReviewStatus(card.facility_id, toStatus, parkedReason);
  }

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div className="flex-shrink-0 px-6 py-4" style={{ borderBottom: "1px solid var(--fiq-border)" }}>
        <h1 className="text-xl font-bold" style={{ color: "var(--fiq-text)" }}>Review Board</h1>
        <p className="text-[10px] mt-0.5 uppercase tracking-wide" style={{ color: "var(--fiq-text-subdued)" }}>
          Facility validation pipeline · drag cards to move
        </p>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center text-sm" style={{ color: "var(--fiq-text-faintest)" }}>
          Loading board…
        </div>
      ) : (
        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div
            className="flex-1 overflow-x-auto overflow-y-hidden px-6 py-4"
            style={{ display: "flex", gap: 12, alignItems: "flex-start" }}
          >
            {COLUMNS.map((col) => (
              <KanbanColumn
                key={col.status}
                status={col.status}
                label={col.label}
                accent={col.accent}
                cards={columns[col.status] ?? []}
                onMove={handleMove}
                onNavigate={onNavigateToFacility}
              />
            ))}
          </div>
          <DragOverlay dropAnimation={null}>
            {activeCard ? <CardPreview card={activeCard} /> : null}
          </DragOverlay>
        </DndContext>
      )}

      {parkingCard && (
        <ParkedReasonModal
          facilityName={parkingCard.facility_name}
          onConfirm={(reason) => { doMove(parkingCard, "parked", reason); setParkingCard(null); }}
          onCancel={() => setParkingCard(null)}
        />
      )}
    </div>
  );
}
