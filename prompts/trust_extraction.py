from pathlib import Path

# sql/data_quality/ is the source of truth for all penalty queries.
# Any .sql file in that folder that returns (unique_id, penalty_points) is
# automatically picked up by build_penalty_lookups() at runtime.
# Combined max penalty = 190 across current two files:
#   01_duplicate_phones.sql             → max 50 pts
#   06_address_and_location_quality.sql → max 140 pts

_SQL_DIR = Path(__file__).parent.parent / "sql" / "data_quality"
_MAX_PENALTY = 190.0


def build_penalty_lookups(spark) -> dict[str, int]:
    """
    Read every .sql file in sql/data_quality/, wrap each as a subquery to
    aggregate MAX(penalty_points) per unique_id, then sum across all files.
    Returns {facility_id: total_penalty_points}.
    Files missing unique_id or penalty_points columns are skipped with a warning.
    """
    totals: dict[str, int] = {}
    for path in sorted(_SQL_DIR.glob("*.sql")):
        sql = path.read_text().rstrip().rstrip(";")
        try:
            wrapped = f"""
                SELECT unique_id, MAX(penalty_points) AS penalty_points
                FROM ({sql})
                GROUP BY unique_id
            """
            rows = spark.sql(wrapped).collect()
            for row in rows:
                fid = row["unique_id"]
                pts = int(row["penalty_points"] or 0)
                totals[fid] = totals.get(fid, 0) + pts
            print(f"  {path.name}: {len(rows)} facilities flagged")
        except Exception as e:
            print(f"  {path.name}: skipped — {e}")
    return totals


SYSTEM_PROMPT = """You are a healthcare facility data analyst. Evaluate a facility record and assess trustworthiness of its claims.

RULES:
- Only cite text that actually appears in the source fields. Never invent or infer.
- Return "insufficient_data" confidence_tier if evidence is absent or field coverage is too low.
- capacity and year_established ALWAYS get confidence_tier "insufficient_data" and trust_score null — no exceptions.
- Flag contradictions where a structured field directly conflicts with free text.
- The completeness dimension trust_score and confidence_tier are pre-computed from data quality checks — use the values provided exactly.
- Respond ONLY with valid JSON. No markdown fences, no preamble."""


def _completeness_score(penalty_points: int) -> float:
    return round(max(0.0, 1.0 - penalty_points / _MAX_PENALTY), 2)


def _completeness_tier(trust_score: float) -> str:
    if trust_score >= 0.7:
        return "high"
    if trust_score >= 0.4:
        return "medium"
    if trust_score > 0.0:
        return "low"
    return "insufficient_data"


def build_prompt(facility: dict) -> str:
    penalty = int(facility.get("penalty_points") or 0)
    c_score = _completeness_score(penalty)
    c_tier = _completeness_tier(c_score)

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

DATA QUALITY PENALTIES (aggregated from sql/data_quality/):
total_penalty_points: {penalty}
completeness_trust_score: {c_score}
completeness_confidence_tier: {c_tier}

Return this exact JSON (no extra keys, no markdown):
{{
  "dimensions": [
    {{
      "dimension": "capability",
      "trust_score": <0.0-1.0 or null>,
      "confidence_tier": "<high|medium|low|insufficient_data>",
      "evidence_text": "<exact quote from source, or null>",
      "source_field": "<field name or null>",
      "contradiction": <true|false>,
      "contradiction_detail": "<explanation or null>"
    }},
    {{
      "dimension": "equipment",
      "trust_score": <0.0-1.0 or null>,
      "confidence_tier": "<high|medium|low|insufficient_data>",
      "evidence_text": "<exact quote from source, or null>",
      "source_field": "<field name or null>",
      "contradiction": <true|false>,
      "contradiction_detail": "<explanation or null>"
    }},
    {{
      "dimension": "procedure",
      "trust_score": <0.0-1.0 or null>,
      "confidence_tier": "<high|medium|low|insufficient_data>",
      "evidence_text": "<exact quote from source, or null>",
      "source_field": "<field name or null>",
      "contradiction": <true|false>,
      "contradiction_detail": "<explanation or null>"
    }},
    {{
      "dimension": "completeness",
      "trust_score": {c_score},
      "confidence_tier": "{c_tier}",
      "evidence_text": "total_penalty={penalty}/{int(_MAX_PENALTY)}",
      "source_field": null,
      "contradiction": false,
      "contradiction_detail": null
    }}
  ]
}}"""
