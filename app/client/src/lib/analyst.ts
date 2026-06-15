function getAnalystId(): string {
  const stored = localStorage.getItem("facilityiq_analyst_id");
  if (stored) return stored;
  const id = crypto.randomUUID();
  localStorage.setItem("facilityiq_analyst_id", id);
  return id;
}

export const ANALYST_ID = getAnalystId();
