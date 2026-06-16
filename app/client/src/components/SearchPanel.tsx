import { useState, useEffect, useRef } from "react";
import type { FacilityListItem, UserAction } from "../types";
import FacilityCard from "./FacilityCard";
import { fetchFacilities, fetchMeta, fetchActions } from "../lib/api";
import { ANALYST_ID } from "../lib/analyst";

interface Props {
  onSelect: (id: string) => void;
  selectedId: string | null;
  onFirstFacilityId?: (id: string | null) => void;
}

const LIMIT = 25;

export default function SearchPanel({ onSelect, selectedId, onFirstFacilityId }: Props) {
  const [query, setQuery] = useState("");
  const [state, setState] = useState("");
  const [facilityType, setFacilityType] = useState("");
  const [contradictionsOnly, setContradictionsOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [facilities, setFacilities] = useState<FacilityListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [meta, setMeta] = useState<{ states: string[]; facility_types: string[] }>({
    states: [], facility_types: [],
  });
  const [selectedActions, setSelectedActions] = useState<UserAction[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { fetchMeta().then(setMeta); }, []);

  useEffect(() => {
    if (!selectedId) { setSelectedActions([]); return; }
    fetchActions(selectedId, ANALYST_ID).then(setSelectedActions);
  }, [selectedId]);

  function load(q: string, pg: number) {
    setLoading(true);
    fetchFacilities({ q, page: pg, limit: LIMIT, state, facilityType, contradictionsOnly })
      .then((data) => {
        setFacilities(data);
        setLoading(false);
        if (pg === 1) onFirstFacilityId?.(data[0]?.facility_id ?? null);
      })
      .catch(() => setLoading(false));
  }

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => { setPage(1); load(query, 1); }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, state, facilityType, contradictionsOnly]);

  useEffect(() => { load(query, page); }, [page]);
  useEffect(() => { load("", 1); }, []);

  const selectStyle: React.CSSProperties = {
    background: "var(--fiq-bg-input)", border: "1px solid var(--fiq-border-strong)",
    borderRadius: 4, color: "var(--fiq-text)", fontSize: 10, padding: "3px 6px", outline: "none",
  };

  return (
    <>
      {/* Header */}
      <div style={{
        background: "var(--fiq-bg-surface)", padding: "10px 16px",
        borderBottom: "1px solid var(--fiq-border)",
        display: "flex", alignItems: "center", gap: 8, flexShrink: 0,
      }}>
        <div style={{ width: 4, height: 16, background: "#FF3621", borderRadius: 1 }} />
        <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: "1.5px" }}>FACILITYIQ</span>
        <span style={{ fontSize: 9, color: "var(--fiq-text-faintest)", marginLeft: "auto" }}>
          TRUST DESK · INDIA
        </span>
      </div>

      {/* Search */}
      <div data-tour="search-bar" style={{ padding: "10px 12px", borderBottom: "1px solid var(--fiq-border)", flexShrink: 0 }}>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search facilities, specialties, states..."
          style={{
            width: "100%", boxSizing: "border-box",
            background: "var(--fiq-bg-input)", border: "1px solid var(--fiq-border-strong)",
            borderRadius: 6, padding: "7px 10px",
            color: "var(--fiq-text)", fontSize: 12, outline: "none",
          }}
        />
      </div>

      {/* Filters */}
      <div data-tour="search-filters" style={{
        padding: "6px 12px", borderBottom: "1px solid var(--fiq-border)",
        display: "flex", gap: 5, flexWrap: "wrap", flexShrink: 0,
      }}>
        <select data-tour="state-filter" value={state} onChange={(e) => setState(e.target.value)} style={selectStyle}>
          <option value="">All States</option>
          {meta.states.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select data-tour="type-filter" value={facilityType} onChange={(e) => setFacilityType(e.target.value)} style={selectStyle}>
          <option value="">All Types</option>
          {meta.facility_types.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <button
          data-tour="contradiction-filter"
          onClick={() => setContradictionsOnly((c) => !c)}
          style={{
            background: contradictionsOnly ? "rgba(255,54,33,0.2)" : "var(--fiq-bg-input)",
            border: `1px solid ${contradictionsOnly ? "rgba(255,54,33,0.5)" : "var(--fiq-border-strong)"}`,
            borderRadius: 4, color: contradictionsOnly ? "#FF3621" : "var(--fiq-text-dim)",
            fontSize: 9, padding: "3px 7px", cursor: "pointer", fontWeight: 600,
          }}
        >
          ⚠ Contradictions
        </button>
      </div>

      {/* Count */}
      <div style={{
        padding: "5px 14px", fontSize: 9,
        color: "var(--fiq-text-faintest)", letterSpacing: "0.5px", flexShrink: 0,
      }}>
        {loading ? "Searching..." : `${facilities.length} results · page ${page}`}
      </div>

      {/* List */}
      <div style={{ flex: 1, overflowY: "auto" }}>
        {facilities.map((f) => (
          <FacilityCard
            key={f.facility_id}
            facility={f}
            selected={f.facility_id === selectedId}
            onClick={() => onSelect(f.facility_id)}
            actions={f.facility_id === selectedId ? selectedActions : []}
          />
        ))}
        {!loading && facilities.length === 0 && (
          <div style={{ padding: 16, fontSize: 11, color: "var(--fiq-text-faintest)" }}>
            No results
          </div>
        )}
      </div>

      {/* Pagination */}
      <div style={{
        padding: "6px 12px", borderTop: "1px solid var(--fiq-border)",
        display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0,
      }}>
        <button
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          disabled={page === 1}
          style={{
            background: "transparent", border: "1px solid var(--fiq-border-strong)",
            borderRadius: 4,
            color: page === 1 ? "var(--fiq-text-faintest)" : "var(--fiq-text-dim)",
            fontSize: 10, padding: "3px 10px", cursor: page === 1 ? "default" : "pointer",
          }}
        >← Prev</button>
        <span style={{ fontSize: 9, color: "var(--fiq-text-code)" }}>Page {page}</span>
        <button
          onClick={() => setPage((p) => p + 1)}
          disabled={facilities.length < LIMIT}
          style={{
            background: "transparent", border: "1px solid var(--fiq-border-strong)",
            borderRadius: 4,
            color: facilities.length < LIMIT ? "var(--fiq-text-faintest)" : "var(--fiq-text-dim)",
            fontSize: 10, padding: "3px 10px",
            cursor: facilities.length < LIMIT ? "default" : "pointer",
          }}
        >Next →</button>
      </div>
    </>
  );
}
