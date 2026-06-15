# Databricks notebook — run on a cluster, not locally
# Configure these for your workspace
CATALOG = "YOUR_CATALOG"   # e.g. "main"
SCHEMA = "facilityiq"
CSV_PATH = "dbfs:/FileStore/facilityiq/facilities.csv"  # upload FDR CSV here

import re
for _var, _val in [("CATALOG", CATALOG), ("SCHEMA", SCHEMA)]:
    assert re.fullmatch(r"[a-zA-Z0-9_]+", _val), f"Invalid {_var}: {_val!r}"

spark.sql(f"USE CATALOG {CATALOG}")
spark.sql(f"CREATE SCHEMA IF NOT EXISTS {SCHEMA}")
spark.sql(f"USE SCHEMA {SCHEMA}")

# Load CSV — infers all 51 FDR columns
raw_df = (spark.read
    .format("csv")
    .option("header", "true")
    .option("inferSchema", "true")
    .option("multiLine", "true")
    .option("escape", '"')
    .load(CSV_PATH))

print(f"CSV columns ({len(raw_df.columns)}): {raw_df.columns}")
assert "facility_id" in raw_df.columns, "facility_id column not found — check CSV"
raw_count = raw_df.count()
print(f"CSV row count: {raw_count}")
assert raw_count > 0, f"CSV loaded 0 rows from {CSV_PATH} — check the path and file"

# Write to facilities_raw (overwrite on re-run is safe — append-only in prod)
(raw_df.write
    .format("delta")
    .mode("overwrite")
    .option("overwriteSchema", "true")
    .saveAsTable(f"{CATALOG}.{SCHEMA}.facilities_raw"))

# Enable CDF for synced tables (required for Triggered sync mode)
spark.sql(f"""
  ALTER TABLE {CATALOG}.{SCHEMA}.facilities_raw
  SET TBLPROPERTIES (delta.enableChangeDataFeed = true)
""")

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
