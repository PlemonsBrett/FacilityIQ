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
      "trust_score": null,
      "confidence_tier": "insufficient_data",
      "evidence_text": "capacity and year_established have <25% and 48% dataset coverage respectively",
      "source_field": null,
      "contradiction": false,
      "contradiction_detail": null
    }}
  ]
}}"""
