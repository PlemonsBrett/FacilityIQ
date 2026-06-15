# Penalty points are pre-computed from two SQL checks before this prompt runs:
#   sql/data_quality/01_duplicate_phones.sql             → phone_penalty_points  (max 50)
#   sql/data_quality/06_address_and_location_quality.sql → location_penalty_points (max 140)
# Combined max = 190. Completeness trust_score = 1.0 - (total / 190).

_MAX_PENALTY = 190.0

SYSTEM_PROMPT = """You are a healthcare facility data analyst. Evaluate a facility record and assess trustworthiness of its claims.

RULES:
- Only cite text that actually appears in the source fields. Never invent or infer.
- Return "insufficient_data" confidence_tier if evidence is absent or field coverage is too low.
- capacity and year_established ALWAYS get confidence_tier "insufficient_data" and trust_score null — no exceptions.
- Flag contradictions where a structured field directly conflicts with free text.
- The completeness dimension trust_score and confidence_tier are pre-computed from data quality checks — use the values provided exactly.
- Respond ONLY with valid JSON. No markdown fences, no preamble."""


def _completeness_score(phone_penalty: int, location_penalty: int) -> float:
    return round(max(0.0, 1.0 - (phone_penalty + location_penalty) / _MAX_PENALTY), 2)


def _completeness_tier(trust_score: float) -> str:
    if trust_score >= 0.7:
        return "high"
    if trust_score >= 0.4:
        return "medium"
    if trust_score > 0.0:
        return "low"
    return "insufficient_data"


def build_prompt(facility: dict) -> str:
    phone_penalty = int(facility.get("phone_penalty_points") or 0)
    location_penalty = int(facility.get("location_penalty_points") or 0)
    c_score = _completeness_score(phone_penalty, location_penalty)
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

DATA QUALITY PENALTIES (pre-computed from sql/data_quality/):
phone_penalty_points: {phone_penalty}  (source: 01_duplicate_phones.sql, percentile-ranked)
location_penalty_points: {location_penalty}  (source: 06_address_and_location_quality.sql)
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
      "evidence_text": "phone_penalty={phone_penalty}, location_penalty={location_penalty}, total={phone_penalty + location_penalty}/190",
      "source_field": null,
      "contradiction": false,
      "contradiction_detail": null
    }}
  ]
}}"""
