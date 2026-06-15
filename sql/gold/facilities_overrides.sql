-- Analyst override log for facility data corrections.
-- Append-only audit trail: one row per correction. Gold applies the LATEST override
-- per (facility_id, field_name) by updated_at. NEVER drop/replace this table.
--
-- field_name must match a column name in facilities_gold (e.g. 'name', 'capacity',
-- 'address_city', 'latitude'). new_value is stored as text and cast on apply.

CREATE TABLE IF NOT EXISTS workspace.facilityiq.facilities_overrides (
  facility_id STRING NOT NULL,
  field_name  STRING NOT NULL,
  new_value   STRING,
  analyst_id  STRING,
  reason      STRING,
  updated_at  TIMESTAMP NOT NULL
)
USING DELTA;
