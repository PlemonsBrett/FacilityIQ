#!/usr/bin/env bash
# Publish the gold facilities table to the Lakebase prod path the app reads:
#   workspace.facilityiq.facilities_gold  ──(synced table)──►  `facilityiq-lakebase`.public.facilities
#
# Why a synced table (not a path change in the SQL): `facilityiq-lakebase` is a
# Lakebase (Postgres) catalog. You cannot CREATE a Delta table there with Spark —
# the medallion stays Delta in Unity Catalog, and this sync serves gold to Postgres.
#
# Why SNAPSHOT mode: facilities_gold is rebuilt with CREATE OR REPLACE (full overwrite),
# which breaks the Change Data Feed lineage that TRIGGERED/CONTINUOUS require.
# Re-run this script (or trigger the sync pipeline) after each gold rebuild to refresh.
#
# NOT a DABs resource: for Autoscaling Lakebase, the DABs `synced_database_tables`
# field maps to the Provisioned API and can create unintended instances. Use this CLI.
#
# Prereqs: Lakebase project + `facilityiq-lakebase` UC catalog already exist
# (see docs/superpowers/plans/2026-06-15-facilityiq-mvp.md). USE_SCHEMA + CREATE_TABLE
# on the target schema. Set PROFILE below.

set -euo pipefail

PROFILE="${DATABRICKS_PROFILE:-DEFAULT}"
SOURCE_TABLE="workspace.facilityiq.facilities_gold"
TARGET="facilityiq-lakebase.public.facilities"   # the table the app reads
BRANCH="projects/facilityiq/branches/production"

databricks postgres create-synced-table "${TARGET}" \
  --json "{
    \"spec\": {
      \"source_table_full_name\": \"${SOURCE_TABLE}\",
      \"primary_key_columns\": [\"unique_id\"],
      \"scheduling_policy\": \"SNAPSHOT\",
      \"branch\": \"${BRANCH}\",
      \"postgres_database\": \"databricks_postgres\",
      \"create_database_objects_if_missing\": true,
      \"new_pipeline_spec\": {
        \"storage_catalog\": \"workspace\",
        \"storage_schema\": \"default\"
      }
    }
  }" --profile "${PROFILE}"

# Check status:
#   databricks postgres get-synced-table "synced_tables/${TARGET}" --profile "${PROFILE}"
