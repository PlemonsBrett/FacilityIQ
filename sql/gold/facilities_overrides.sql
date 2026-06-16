-- Analyst override log for facility data corrections.
-- Append-only audit trail: one row per correction. Gold applies the LATEST override
-- per (facility_id, field_name) by updated_at. NEVER truncate or delete from this table.
--
-- This table lives in Lakebase Postgres (facilityiq-lakebase.public.facilities_overrides),
-- in the same public schema as the synced facility tables.
-- Created by the app SP in server.ts onPluginsReady via appkit.lakebase.query().
--
-- Spark reads it in facilities_gold.sql as: facilityiq-lakebase.public.facilities_overrides
--
-- To add a new overridable field: add a route in server.ts that INSERTs a row with the
-- field_name matching the column name in facilities_gold.

-- Run this in a Postgres client (databricks psql) if you need to create it manually.
-- Normally created automatically on app boot.

CREATE TABLE IF NOT EXISTS facilityiq.facilities_overrides (
  facility_id  TEXT        NOT NULL,
  field_name   TEXT        NOT NULL,
  new_value    TEXT,
  analyst_id   TEXT,
  reason       TEXT,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fo_facility_field
  ON facilityiq.facilities_overrides (facility_id, field_name, updated_at DESC);
