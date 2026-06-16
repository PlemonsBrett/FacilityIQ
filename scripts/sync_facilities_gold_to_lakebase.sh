#!/usr/bin/env bash
# Sync all FacilityIQ Delta tables (Unity Catalog) → Lakebase Postgres (app reads here).
#
# Direction: workspace.facilityiq.* ──(synced table)──► facilityiq-lakebase.public.*
#
# Tables synced:
#   facilities_gold           → public.facilities           (primary facility data)
#   facilities_trust_signals  → public.facilities_trust_signals
#   facilities_quality_scores → public.facilities_quality_scores
#   facilities_email_outreach → public.facilities_email_outreach
#
# NOT synced (live in Lakebase Postgres natively, created by app on boot):
#   facilityiq.facilities_overrides  — app writes, gold reads via facilityiq-lakebase.facilityiq.*
#   facilityiq.user_actions          — app owned
#   facilityiq.facility_review       — app owned (kanban)
#
# Why SNAPSHOT: all these tables are rebuilt with CREATE OR REPLACE (full overwrite),
# which breaks the CDF lineage required by TRIGGERED/CONTINUOUS. Re-run this script
# after each pipeline run to refresh Lakebase.
#
# Prereqs: facilityiq-lakebase UC catalog and Lakebase project already exist.
#          Run pipeline notebooks first so source tables exist.

set -euo pipefail

PROFILE="${DATABRICKS_PROFILE:-facilityiq}"
BRANCH="projects/facilityiq/branches/production"
STORAGE_CATALOG="workspace"
STORAGE_SCHEMA="default"

sync_table() {
  local source="$1"
  local target="$2"
  local pk="$3"

  echo ""
  echo "▶ Syncing ${source} → ${target} (pk: ${pk})"

  databricks postgres create-synced-table "${target}" \
    --json "{
      \"spec\": {
        \"source_table_full_name\": \"${source}\",
        \"primary_key_columns\": [${pk}],
        \"scheduling_policy\": \"SNAPSHOT\",
        \"branch\": \"${BRANCH}\",
        \"postgres_database\": \"databricks_postgres\",
        \"create_database_objects_if_missing\": true,
        \"new_pipeline_spec\": {
          \"storage_catalog\": \"${STORAGE_CATALOG}\",
          \"storage_schema\": \"${STORAGE_SCHEMA}\"
        }
      }
    }" --profile "${PROFILE}"

  echo "  ✓ Created. Check status:"
  echo "    databricks postgres get-synced-table \"synced_tables/${target}\" --profile ${PROFILE}"
}

# 1. Gold facilities — primary table the app lists and searches
sync_table \
  "workspace.facilityiq.facilities_gold" \
  "facilityiq-lakebase.public.facilities" \
  '"unique_id"'

# 2. Trust signals — LLM-extracted trust scores per (facility, dimension)
# NOTE: target is public.trust_signals (no prefix) to match server.ts queries
sync_table \
  "workspace.facilityiq.facilities_trust_signals" \
  "facilityiq-lakebase.public.trust_signals" \
  '"facility_id","dimension"'

# 3. Quality scores — data-record integrity score per facility
sync_table \
  "workspace.facilityiq.facilities_quality_scores" \
  "facilityiq-lakebase.public.facilities_quality_scores" \
  '"facility_id"'

# 4. Email outreach — per-email data state for the outreach workflow
sync_table \
  "workspace.facilityiq.facilities_email_outreach" \
  "facilityiq-lakebase.public.facilities_email_outreach" \
  '"email"'

echo ""
echo "✓ All synced tables created. Pipeline:"
echo "  1. Run notebooks (00_setup → 01_trust_extraction)"
echo "  2. Re-run this script to refresh Lakebase"
echo "  3. App reads from facilityiq-lakebase.public.*"
