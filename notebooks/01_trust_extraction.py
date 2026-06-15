# Databricks notebook source
import json
import time
from datetime import datetime, timezone
from pyspark.sql import Row

SYSTEM_PROMPT = """You are a healthcare facility data analyst. Evaluate a facility record and assess trustworthiness of its claims.

RULES:
- Only cite text that actually appears in the source fields. Never invent or infer.
- Return "insufficient_data" confidence_tier if evidence is absent or field coverage is too low.
- capacity and year_established ALWAYS get confidence_tier "insufficient_data" and trust_score null — no exceptions.
- Flag contradictions where a structured field directly conflicts with free text.
- Respond ONLY with valid JSON. No markdown fences, no preamble."""


def build_prompt(facility: dict) -> str:
    return f"""Analyze this healthcare facility and return a trust assessment for four dimensions.

STRUCTURED FIELDS:
facility_id: {facility.get("facility_id", "N/A")}
facility_type: {facility.get("facility_type", "N/A")}
state: {facility.get("state", "N/A")}
capacity: {facility.get("capacity", "NOT PROVIDED")}
year_established: {facility.get("year_established", "NOT PROVIDED")}

FREE TEXT FIELDS:
description: {str(facility.get("description", ""))[:1500]}
capability: {str(facility.get("capability", ""))[:800]}
procedure: {str(facility.get("procedure", ""))[:800]}
equipment: {str(facility.get("equipment", ""))[:800]}

Return this exact JSON (no extra keys, no markdown):
{{{{
  "dimensions": [
    {{{{
      "dimension": "capability",
      "trust_score": <0.0-1.0 or null>,
      "confidence_tier": "<high|medium|low|insufficient_data>",
      "evidence_text": "<exact quote from source, or null>",
      "source_field": "<field name or null>",
      "contradiction": <true|false>,
      "contradiction_detail": "<explanation or null>"
    }}}},
    {{{{
      "dimension": "equipment",
      "trust_score": <0.0-1.0 or null>,
      "confidence_tier": "<high|medium|low|insufficient_data>",
      "evidence_text": "<exact quote from source, or null>",
      "source_field": "<field name or null>",
      "contradiction": <true|false>,
      "contradiction_detail": "<explanation or null>"
    }}}},
    {{{{
      "dimension": "procedure",
      "trust_score": <0.0-1.0 or null>,
      "confidence_tier": "<high|medium|low|insufficient_data>",
      "evidence_text": "<exact quote from source, or null>",
      "source_field": "<field name or null>",
      "contradiction": <true|false>,
      "contradiction_detail": "<explanation or null>"
    }}}},
    {{{{
      "dimension": "completeness",
      "trust_score": null,
      "confidence_tier": "insufficient_data",
      "evidence_text": "capacity and year_established have <25% and 48% dataset coverage respectively",
      "source_field": null,
      "contradiction": false,
      "contradiction_detail": null
    }}}}
  ]
}}}}\
"""

CATALOG = "workspace"   # same as 00_setup.py
SCHEMA = "facilityiq"
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

def call_llm(prompt: str, model: str = MODEL) -> str:
    """Single LLM call, returns raw content string."""
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
            # Write error row and return empty
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
    signals = extract_signals(row.to_dict())
    all_signals.extend(signals)

    if len(all_signals) >= BATCH_SIZE:
        batch_df = spark.createDataFrame(all_signals)
        batch_df.write.format("delta").mode("append").saveAsTable(
            f"{CATALOG}.{SCHEMA}.facilities_trust_signals")
        print(f"  Wrote batch at facility {i+1}/{len(facilities_df)}")
        all_signals = []
        time.sleep(1)  # brief rate limit pause between batches

# Write any remaining signals
if all_signals:
    batch_df = spark.createDataFrame(all_signals)
    batch_df.write.format("delta").mode("append").saveAsTable(
        f"{CATALOG}.{SCHEMA}.facilities_trust_signals")

total = spark.sql(f"SELECT COUNT(*) as n FROM {CATALOG}.{SCHEMA}.facilities_trust_signals").collect()[0]["n"]
errors = spark.sql(f"SELECT COUNT(*) as n FROM {CATALOG}.{SCHEMA}.extraction_errors").collect()[0]["n"]
print(f"Extraction complete. Signals: {total}, Errors: {errors}")
