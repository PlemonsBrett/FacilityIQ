import { useState, useEffect, useRef } from "react";
import type { FacilityListItem } from "../types";
import FacilityCard from "./FacilityCard";

interface Props {
  onSelect: (id: string) => void;
  selectedId: string | null;
}

export default function SearchPanel({ onSelect, selectedId }: Props) {
  const [query, setQuery] = useState("");
  const [facilities, setFacilities] = useState<FacilityListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function fetchFacilities(q: string) {
    setLoading(true);
    fetch(`/api/facilities?q=${encodeURIComponent(q)}&limit=25`)
      .then((r) => r.json())
      .then((data: FacilityListItem[]) => { setFacilities(data); setLoading(false); })
      .catch(() => setLoading(false));
  }

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchFacilities(query), 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query]);

  useEffect(() => { fetchFacilities(""); }, []);

  return (
    <>
      <div style={{
        background: "#081519", padding: "10px 16px",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        display: "flex", alignItems: "center", gap: 8, flexShrink: 0,
      }}>
        <div style={{ width: 4, height: 16, background: "#FF3621", borderRadius: 1 }} />
        <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: "1.5px" }}>FACILITYIQ</span>
        <span style={{ fontSize: 9, color: "rgba(255,255,255,0.25)", marginLeft: "auto" }}>
          TRUST DESK · INDIA
        </span>
      </div>
      <div style={{ padding: "10px 12px", borderBottom: "1px solid rgba(255,255,255,0.06)", flexShrink: 0 }}>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search facilities, specialties, states..."
          style={{
            width: "100%", boxSizing: "border-box",
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 6, padding: "7px 10px",
            color: "white", fontSize: 12, outline: "none",
          }}
        />
      </div>
      <div style={{
        padding: "5px 14px", fontSize: 9,
        color: "rgba(255,255,255,0.25)", letterSpacing: "0.5px", flexShrink: 0,
      }}>
        {loading ? "Searching..." : `${facilities.length} results`}
      </div>
      <div style={{ flex: 1, overflowY: "auto" }}>
        {facilities.map((f) => (
          <FacilityCard
            key={f.facility_id}
            facility={f}
            selected={f.facility_id === selectedId}
            onClick={() => onSelect(f.facility_id)}
          />
        ))}
        {!loading && facilities.length === 0 && (
          <div style={{ padding: 16, fontSize: 11, color: "rgba(255,255,255,0.25)" }}>No results</div>
        )}
      </div>
    </>
  );
}
