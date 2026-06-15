# Combined max penalty = 190. Completeness trust_score = 1.0 - (total / 190).
#   PHONE_PENALTY_SQL    → max 50  pts (percentile-ranked)
#   LOCATION_PENALTY_SQL → max 140 pts (fixed weights)

_MAX_PENALTY = 190.0

SOURCE_TABLE = "databricks_virtue_foundation_dataset_dais_2026.virtue_foundation_dataset.facilities"

PHONE_PENALTY_SQL = f"""
WITH exploded_phones AS (
  SELECT
    unique_id,
    regexp_replace(phone, '[^0-9]', '') AS phone_normalized
  FROM {SOURCE_TABLE}
  LATERAL VIEW explode(from_json(phone_numbers, 'ARRAY<STRING>')) exploded AS phone
  WHERE phone_numbers IS NOT NULL
    AND phone_numbers NOT IN ('null', '[]')
),
dupes AS (
  SELECT
    phone_normalized,
    COUNT(DISTINCT unique_id) AS duplicate_count
  FROM exploded_phones
  WHERE phone_normalized IS NOT NULL
    AND length(phone_normalized) >= 7
  GROUP BY phone_normalized
  HAVING COUNT(DISTINCT unique_id) > 1
),
ranked AS (
  SELECT
    phone_normalized,
    duplicate_count,
    PERCENT_RANK() OVER (ORDER BY duplicate_count) AS pct_rank
  FROM dupes
)
SELECT
  e.unique_id AS facility_id,
  MAX(CASE
    WHEN r.pct_rank >= 0.90 THEN 50
    WHEN r.pct_rank >= 0.60 THEN 30
    ELSE 10
  END) AS phone_penalty_points
FROM exploded_phones e
INNER JOIN ranked r ON e.phone_normalized = r.phone_normalized
GROUP BY e.unique_id
"""

LOCATION_PENALTY_SQL = f"""
SELECT
  unique_id AS facility_id,
  (
    CASE WHEN address_city IS NULL OR trim(address_city) = '' OR lower(trim(address_city)) IN ('na', 'n/a', 'unknown') THEN 10 ELSE 0 END
    + CASE WHEN address_stateOrRegion IS NULL OR trim(address_stateOrRegion) = '' OR lower(trim(address_stateOrRegion)) IN ('na', 'n/a', 'unknown') THEN 25 ELSE 0 END
    + CASE WHEN lower(trim(address_country)) NOT IN ('india', 'in') THEN 30 ELSE 0 END
    + CASE WHEN latitude IS NULL OR longitude IS NULL THEN 5 ELSE 0 END
    + CASE WHEN latitude IS NOT NULL AND (latitude < 6 OR latitude > 38) THEN 35 ELSE 0 END
    + CASE WHEN longitude IS NOT NULL AND (longitude < 68 OR longitude > 98) THEN 35 ELSE 0 END
  ) AS location_penalty_points
FROM {SOURCE_TABLE}
WHERE
  address_city IS NULL OR trim(address_city) = '' OR lower(trim(address_city)) IN ('na', 'n/a', 'unknown')
  OR address_stateOrRegion IS NULL OR trim(address_stateOrRegion) = '' OR lower(trim(address_stateOrRegion)) IN ('na', 'n/a', 'unknown')
  OR lower(trim(address_country)) NOT IN ('india', 'in')
  OR latitude IS NULL OR longitude IS NULL
  OR latitude < 6 OR latitude > 38
  OR longitude < 68 OR longitude > 98
"""

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

DATA QUALITY PENALTIES:
phone_penalty_points: {phone_penalty}
location_penalty_points: {location_penalty}
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
