# Databricks notebook source
# MAGIC %md # FacilityIQ — Setup
# Configure these for your workspace
CATALOG = "workspace"   # the catalog where facilityiq schema will live
SCHEMA = "facilityiq"
SOURCE_TABLE = "databricks_virtue_foundation_dataset_dais_2026.virtue_foundation_dataset.facilities"

import re
for _var, _val in [("CATALOG", CATALOG), ("SCHEMA", SCHEMA)]:
    assert re.fullmatch(r"[a-zA-Z0-9_]+", _val), f"Invalid {_var}: {_val!r}"

spark.sql(f"USE CATALOG {CATALOG}")
spark.sql(f"CREATE SCHEMA IF NOT EXISTS {SCHEMA}")
spark.sql(f"USE SCHEMA {SCHEMA}")

# Create normalized facilities_raw from the hackathon Delta Sharing table.
# Column renames align the hackathon schema with FacilityIQ's standard names
# so all downstream code (pipeline, API, UI) uses consistent field names.
spark.sql(f"""
  CREATE OR REPLACE TABLE {CATALOG}.{SCHEMA}.facilities_raw
  USING DELTA
  TBLPROPERTIES (delta.enableChangeDataFeed = true)
  AS SELECT
    unique_id               AS facility_id,
    name                    AS facility_name,
    organization_type       AS facility_type,
    address_stateOrRegion   AS state,
    address_city            AS district,
    description,
    capability,
    procedure,
    equipment,
    capacity,
    yearEstablished         AS year_established,
    latitude,
    longitude,
    specialties
  FROM {SOURCE_TABLE}
""")

raw_count = spark.table(f"{CATALOG}.{SCHEMA}.facilities_raw").count()
print(f"facilities_raw: {raw_count} rows")
assert raw_count > 0, f"CTAS produced 0 rows — check source table: {SOURCE_TABLE}"

# Create trust signals table
spark.sql(f"""
  CREATE TABLE IF NOT EXISTS {CATALOG}.{SCHEMA}.facilities_trust_signals (
    facility_id    STRING NOT NULL,
    dimension      STRING NOT NULL,
    trust_score    FLOAT,
    confidence_tier STRING NOT NULL,
    evidence_text  STRING,
    source_field   STRING,
    contradiction  BOOLEAN NOT NULL DEFAULT FALSE,
    contradiction_detail STRING,
    extraction_model STRING NOT NULL,
    extracted_at   TIMESTAMP NOT NULL
  )
  USING DELTA
  PARTITIONED BY (dimension)
  TBLPROPERTIES (delta.enableChangeDataFeed = true)
""")

spark.sql(f"""
  ALTER TABLE {CATALOG}.{SCHEMA}.facilities_trust_signals
  SET TBLPROPERTIES (delta.enableChangeDataFeed = true)
""")

# Create extraction errors table (for failed LLM calls)
spark.sql(f"""
  CREATE TABLE IF NOT EXISTS {CATALOG}.{SCHEMA}.extraction_errors (
    facility_id    STRING,
    error_message  STRING,
    raw_response   STRING,
    failed_at      TIMESTAMP NOT NULL
  )
  USING DELTA
""")

print("=" * 50)
print(f"facilities_raw: {spark.table(f'{CATALOG}.{SCHEMA}.facilities_raw').count()} rows")
print(f"facilities_trust_signals: {spark.table(f'{CATALOG}.{SCHEMA}.facilities_trust_signals').count()} rows")
print("Setup complete.")
