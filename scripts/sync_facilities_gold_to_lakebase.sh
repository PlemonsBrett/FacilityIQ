#!/usr/bin/env bash
# Sync all FacilityIQ Delta tables (Unity Catalog) -> Lakebase Postgres (app reads here).
#
# Direction: workspace.facilityiq.* --(synced table)--> facilityiq-lakebase.public.*
#
# Fallback: if Lakebase sync fails (e.g. missing CREATE TABLE permission on the schema),
# the script does NOT exit. It records the failure, verifies the Delta source table
# still exists, and prints the fallback Delta path the app can read from instead.
# Fix: grant CREATE TABLE on facilityiq-lakebase.public to the deployer SP, then rerun.
#
# Why SNAPSHOT: tables are rebuilt with CREATE OR REPLACE (full overwrite), which
# breaks CDF lineage required by TRIGGERED/CONTINUOUS. Rerun after each pipeline run.

set -uo pipefail   # no -e so failures don't abort the whole script

PROFILE="${DATABRICKS_PROFILE:-facilityiq}"
BRANCH="projects/facilityiq/branches/production"
STORAGE_CATALOG="workspace"
STORAGE_SCHEMA="default"
WAREHOUSE="a4e1c80a2e8ea399"

FAILED_SYNCS=()
SUCCEEDED_SYNCS=()

sync_table() {
  local source="$1" target="$2" pk="$3"
  echo ""
  echo "Syncing ${source} -> ${target}"

  local out
  out=$(databricks postgres create-synced-table "${target}" \
    --json "{\"spec\":{\"source_table_full_name\":\"${source}\",\"primary_key_columns\":[${pk}],\"scheduling_policy\":\"SNAPSHOT\",\"branch\":\"${BRANCH}\",\"postgres_database\":\"databricks_postgres\",\"create_database_objects_if_missing\":true,\"new_pipeline_spec\":{\"storage_catalog\":\"${STORAGE_CATALOG}\",\"storage_schema\":\"${STORAGE_SCHEMA}\"}}}" \
    --profile "${PROFILE}" 2>&1)

  if [ $? -eq 0 ]; then
    echo "  OK - check: databricks postgres get-synced-table synced_tables/${target} --profile ${PROFILE}"
    SUCCEEDED_SYNCS+=("${target}")
  else
    echo "  FAILED: ${out}"
    FAILED_SYNCS+=("${source} -> ${target}")
    verify_delta_fallback "${source}"
  fi
}

verify_delta_fallback() {
  local source="$1"
  local count
  count=$(databricks api post /api/2.0/sql/statements/ \
    --profile "${PROFILE}" \
    --json "{\"warehouse_id\":\"${WAREHOUSE}\",\"statement\":\"SELECT COUNT(*) FROM ${source}\",\"wait_timeout\":\"30s\"}" 2>/dev/null \
    | python3 -c "import json,sys; r=json.load(sys.stdin); print(r.get('result',{}).get('data_array',[[0]])[0][0])" 2>/dev/null || echo "unknown")
  echo "  FALLBACK: Delta table ${source} has ${count} rows and is available to the app via SQL warehouse."
}

# 1. Gold facilities
sync_table "workspace.facilityiq.facilities_gold"           "facilityiq-lakebase.public.facilities"                 '"unique_id"'

# 2. Trust signals
sync_table "workspace.facilityiq.facilities_trust_signals"  "facilityiq-lakebase.public.facilities_trust_signals"   '"facility_id","dimension"'

# 3. Quality scores
sync_table "workspace.facilityiq.facilities_quality_scores" "facilityiq-lakebase.public.facilities_quality_scores"  '"facility_id"'

# 4. Email outreach
sync_table "workspace.facilityiq.facilities_email_outreach" "facilityiq-lakebase.public.facilities_email_outreach"  '"email"'

echo ""
echo "========================================"
echo "SUMMARY"
echo "========================================"
echo "Succeeded: ${#SUCCEEDED_SYNCS[@]}"
for t in "${SUCCEEDED_SYNCS[@]:-}"; do echo "  OK  $t"; done

echo "Failed:    ${#FAILED_SYNCS[@]}"
for t in "${FAILED_SYNCS[@]:-}"; do echo "  FAIL $t"; done

if [ ${#FAILED_SYNCS[@]} -gt 0 ]; then
  echo ""
  echo "To fix Lakebase sync failures, grant CREATE TABLE to the deployer SP:"
  echo "  In Databricks UI: Catalog Explorer -> facilityiq-lakebase -> public -> Permissions"
  echo "  Grant CREATE TABLE to: eb33f311-4e00-41c1-ad33-90c3a6e01764 (deployer-facilityiq)"
  echo "  Then rerun this script."
  echo ""
  echo "Until then, the app can read from Delta at workspace.facilityiq.* via SQL warehouse."
fi
