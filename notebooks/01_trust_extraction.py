# Databricks notebook source
import json
import os
import sys
import time
from datetime import datetime, timezone
from pyspark.sql import Row

# Add repo root to path so we can import from prompts/
sys.path.insert(0, os.path.abspath(".."))
from prompts.trust_extraction import SYSTEM_PROMPT, build_prompt, build_penalty_lookups

CATALOG = "workspace"   # same as 00_setup.py
SCHEMA = "facilityiq"
SOURCE_TABLE = "databricks_virtue_foundation_dataset_dais_2026.virtue_foundation_dataset.facilities"
MODEL = "databricks-meta-llama-3-1-70b-instruct"
FALLBACK_MODEL = "databricks-dbrx-instruct"
BATCH_SIZE = 50  # accumulated signals before flushing to Delta (~12-13 facilities at 4 signals each)

# OpenAI-compatible client pointing at Databricks Foundation Model APIs
from openai import OpenAI

token = (dbutils.notebook.entry_point
    .getDbutils().notebook().getContext().apiToken().get())
workspace_url = spark.conf.get("spark.databricks.workspaceUrl")

client = OpenAI(
    api_key=token,
    base_url=f"https://{workspace_url}/serving-endpoints"
)

# COMMAND ----------
# Step 1: Run all sql/data_quality/ checks and build a merged penalty lookup.
# Any .sql file returning (unique_id, penalty_points) is picked up automatically.

print("Building penalty lookups from sql/data_quality/...")
penalty_lookup = build_penalty_lookups(spark)
print(f"Total facilities with penalties: {len(penalty_lookup)}")

# COMMAND ----------
# Step 2: LLM extraction loop

def call_llm(prompt: str, model: str = MODEL) -> str:
    response = client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": prompt},
        ],
        temperature=0.0,
        max_tokens=1024,
    )
    return response.choices[0].message.content

def extract_signals(facility_row: dict) -> list[dict]:
    """
    Call LLM for one facility, parse JSON, return list of signal dicts.
    Falls back to FALLBACK_MODEL on rate limit. Returns [] on hard error.
    """
    prompt = build_prompt(facility_row)
    for attempt, model in enumerate([MODEL, FALLBACK_MODEL]):
        raw = None
        try:
            raw = call_llm(prompt, model=model)
            parsed = json.loads(raw)
            signals = parsed["dimensions"]
            now = datetime.now(timezone.utc)
            return [
                {
                    "facility_id": facility_row["facility_id"],
                    "dimension": s["dimension"],
                    "trust_score": float(s["trust_score"]) if s.get("trust_score") is not None else None,
                    "confidence_tier": s["confidence_tier"],
                    "evidence_text": s.get("evidence_text"),
                    "source_field": s.get("source_field"),
                    "contradiction": bool(s.get("contradiction", False)),
                    "contradiction_detail": s.get("contradiction_detail"),
                    "extraction_model": model,
                    "extracted_at": now,
                }
                for s in signals
            ]
        except Exception as e:
            if attempt == 0:
                print(f"  Fallback on {facility_row['facility_id']}: {e}")
                time.sleep(2)
                continue
            err_df = spark.createDataFrame([Row(
                facility_id=str(facility_row.get("facility_id", "")),
                error_message=str(e),
                raw_response=raw or "",
                failed_at=datetime.now(timezone.utc),
            )])
            err_df.write.format("delta").mode("append").saveAsTable(f"{CATALOG}.{SCHEMA}.extraction_errors")
            return []

# Load facilities that don't yet have signals
facilities_df = spark.sql(f"""
  SELECT facility_id, facility_name, facility_type, state,
         description, capability, procedure, equipment,
         capacity, year_established
  FROM {CATALOG}.{SCHEMA}.facilities_raw
  WHERE facility_id NOT IN (SELECT DISTINCT facility_id
    FROM {CATALOG}.{SCHEMA}.facilities_trust_signals)
  ORDER BY
    (CASE WHEN description IS NOT NULL THEN 1 ELSE 0 END +
     CASE WHEN capability IS NOT NULL THEN 1 ELSE 0 END) DESC
  LIMIT 10000
""").toPandas()

print(f"Facilities to process: {len(facilities_df)}")

all_signals = []
for i, row in facilities_df.iterrows():
    fid = row["facility_id"]
    row_dict = row.to_dict()
    row_dict["penalty_points"] = penalty_lookup.get(fid, 0)

    signals = extract_signals(row_dict)
    all_signals.extend(signals)

    if len(all_signals) >= BATCH_SIZE:
        batch_df = spark.createDataFrame(all_signals)
        batch_df.write.format("delta").mode("append").saveAsTable(
            f"{CATALOG}.{SCHEMA}.facilities_trust_signals")
        print(f"  Wrote batch at facility {i+1}/{len(facilities_df)}")
        all_signals = []
        time.sleep(1)

# Write any remaining signals
if all_signals:
    batch_df = spark.createDataFrame(all_signals)
    batch_df.write.format("delta").mode("append").saveAsTable(
        f"{CATALOG}.{SCHEMA}.facilities_trust_signals")

total = spark.sql(f"SELECT COUNT(*) as n FROM {CATALOG}.{SCHEMA}.facilities_trust_signals").collect()[0]["n"]
errors = spark.sql(f"SELECT COUNT(*) as n FROM {CATALOG}.{SCHEMA}.extraction_errors").collect()[0]["n"]
print(f"Extraction complete. Signals: {total}, Errors: {errors}")
