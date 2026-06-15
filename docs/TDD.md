# FacilityIQ — Technical Design Document

**Version:** 1.0  
**Date:** June 15, 2026  
**Track:** Facility Trust Desk  
**Hackathon:** Databricks Data + AI Summit 2026  
**Status:** Active

---

## 1. System Overview

FacilityIQ is a Databricks App that processes a 10,000-record healthcare facility dataset through an LLM-powered trust extraction pipeline, then exposes a non-technical analyst interface for searching, scoring, citing evidence, and persisting decisions.

```
┌─────────────────────────────────────────────────────────────────┐
│                        FacilityIQ System                        │
│                                                                 │
│  ┌──────────────┐    ┌──────────────────┐    ┌──────────────┐  │
│  │  Raw Dataset │───▶│  Trust Extraction │───▶│  Delta Lake  │  │
│  │  (FDR CSV)   │    │  Pipeline (LLM)  │    │  (3 tables)  │  │
│  └──────────────┘    └──────────────────┘    └──────┬───────┘  │
│                                                      │          │
│                                              ┌───────▼───────┐  │
│                                              │ Streamlit App │  │
│                                              │  (Databricks  │  │
│                                              │    Apps)      │  │
│                                              └───────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Tech Stack

| Layer | Technology | Rationale |
|---|---|---|
| Compute | Databricks Free Edition | Hackathon requirement |
| Storage | Delta Lake (Unity Catalog) | ACID persistence, time travel, analyst action log |
| LLM | Databricks Foundation Model APIs (Meta Llama 3.1 70B or DBRX Instruct) | Native to Databricks, no external API key needed |
| Orchestration | Databricks Workflow (single-run batch job) | Runs extraction pipeline once, writes to Delta |
| App Framework | Streamlit on Databricks Apps | Cleanest non-technical UX, native Databricks support |
| Query Layer | Databricks SQL / PySpark | Facility search, filter, and retrieval |
| Version Control | GitHub (public repo) | Hackathon submission requirement |

---

## 3. Data Architecture

### 3.1 Source Table: `facilities_raw`

The provided FDR dataset loaded as a Delta table. All 51 columns preserved. No mutations — treated as append-only source of truth.

Key fields used by the trust pipeline:

| Field | Coverage | Usage |
|---|---|---|
| `description` | 100% | Primary free-text source for trust extraction |
| `capability` | 99.7% | Cross-referenced against structured capability fields |
| `procedure` | 92.5% | Procedure claim extraction |
| `equipment` | 77% | Equipment claim extraction |
| `year_established` | 48% | Completeness signal only — low coverage flagged |
| `capacity` | 25% | Completeness signal only — low coverage flagged, score suppressed |

---

### 3.2 Derived Table: `facilities_trust_signals`

Produced by the LLM extraction pipeline. One row per `(facility_id, dimension)`.

```sql
CREATE TABLE facilities_trust_signals (
  facility_id       STRING NOT NULL,
  dimension         STRING NOT NULL,   -- 'capability' | 'equipment' | 'procedure' | 'completeness'
  trust_score       FLOAT,             -- 0.0 to 1.0; NULL if insufficient data
  confidence_tier   STRING NOT NULL,   -- 'high' | 'medium' | 'low' | 'insufficient_data'
  evidence_text     STRING,            -- Exact sentence(s) from source that produced the score
  source_field      STRING,            -- e.g. 'description', 'capability'
  contradiction     BOOLEAN NOT NULL DEFAULT FALSE,
  contradiction_detail STRING,         -- Human-readable explanation if contradiction=TRUE
  extraction_model  STRING NOT NULL,   -- Model version used (for reproducibility)
  extracted_at      TIMESTAMP NOT NULL
)
USING DELTA
PARTITIONED BY (dimension);
```

---

### 3.3 Persistence Table: `facilities_user_actions`

Stores all analyst workbench actions. Written by the Streamlit app on user interaction.

```sql
CREATE TABLE facilities_user_actions (
  action_id         STRING NOT NULL,   -- UUID
  facility_id       STRING NOT NULL,
  analyst_id        STRING NOT NULL,   -- session-scoped for hackathon; expandable to auth later
  action_type       STRING NOT NULL,   -- 'note' | 'override' | 'shortlist' | 'flag'
  dimension         STRING,            -- NULL for notes/flags; dimension name for overrides
  content           STRING,            -- Note text, override reason, or shortlist name
  override_score    FLOAT,             -- Only for action_type = 'override'
  created_at        TIMESTAMP NOT NULL,
  updated_at        TIMESTAMP NOT NULL
)
USING DELTA;
```

---

## 4. LLM Trust Extraction Pipeline

### 4.1 Overview

A Databricks Workflow notebook that processes each facility record through a structured LLM prompt, extracts trust signals per dimension, and writes results to `facilities_trust_signals`.

### 4.2 Batch Processing Strategy

```python
# Pseudocode — full implementation in notebooks/01_trust_extraction.py

from pyspark.sql import functions as F
from databricks_genai_inference import ChatCompletion  # or openai-compatible SDK

BATCH_SIZE = 50  # Process 50 facilities per LLM call to manage rate limits

def extract_trust_signals(facility_row: dict) -> list[dict]:
    """
    For a single facility, call LLM with structured prompt.
    Returns list of trust signal dicts (one per dimension).
    """
    prompt = build_extraction_prompt(facility_row)
    response = ChatCompletion.create(
        model="databricks-meta-llama-3-1-70b-instruct",
        messages=[{"role": "user", "content": prompt}],
        temperature=0.0,  # Deterministic extraction
        max_tokens=1024,
    )
    return parse_trust_response(response)
```

### 4.3 Extraction Prompt Design

The prompt is the core of the trust pipeline. It must be:

- Deterministic (temperature=0)
- Structured output (JSON)
- Evidence-grounded (no hallucination — cite only what exists in the text)
- Uncertainty-aware (return `confidence_tier: "insufficient_data"` if the text doesn't support a score)

```python
EXTRACTION_SYSTEM_PROMPT = """
You are a healthcare facility data analyst. Your job is to evaluate a facility record
and assess the trustworthiness of its claims.

You MUST:
- Only cite text that actually appears in the source fields provided
- Return "insufficient_data" if the text does not support a score
- Flag contradictions where structured fields conflict with free text
- Never invent or infer information not present in the source

Respond ONLY with valid JSON. No preamble, no markdown fences.
"""

def build_extraction_prompt(facility: dict) -> str:
    return f"""
Analyze this healthcare facility record and return a trust assessment.

STRUCTURED FIELDS:
- facility_type: {facility.get('facility_type', 'N/A')}
- state: {facility.get('state', 'N/A')}
- capacity: {facility.get('capacity', 'NOT PROVIDED')}
- year_established: {facility.get('year_established', 'NOT PROVIDED')}

FREE TEXT FIELDS:
- description: {facility.get('description', '')}
- capability: {facility.get('capability', '')}
- procedure: {facility.get('procedure', '')}
- equipment: {facility.get('equipment', '')}

Return JSON with this exact schema:
{{
  "dimensions": [
    {{
      "dimension": "capability",
      "trust_score": <float 0.0-1.0 or null if insufficient>,
      "confidence_tier": "<high|medium|low|insufficient_data>",
      "evidence_text": "<exact quote from source text, or null>",
      "source_field": "<field name the evidence came from>",
      "contradiction": <true|false>,
      "contradiction_detail": "<explanation if contradiction=true, else null>"
    }},
    // repeat for: equipment, procedure, completeness
  ]
}}
"""
```

### 4.4 Contradiction Detection Logic

A contradiction is flagged when the LLM identifies that a structured field (e.g., `icu_available: "Yes"`) materially conflicts with the free-text content (e.g., description says "basic outpatient clinic with no inpatient facilities").

The LLM handles this inline during extraction. No separate pass needed.

**Contradiction severity tiers:**

- `HIGH` — direct factual conflict (structured says Yes, text says No)
- `MEDIUM` — structural field present but text is silent / vague
- `LOW` — minor inconsistency (e.g., outdated year vs. text context)

### 4.5 Field Coverage Handling

Fields with known low coverage must never generate false confidence:

```python
LOW_COVERAGE_FIELDS = {
    "capacity": 0.25,          # 25% — score suppressed, always "insufficient_data"
    "year_established": 0.48,  # 48% — treated as weak signal only
}

def apply_coverage_guard(signal: dict, field: str) -> dict:
    if field in LOW_COVERAGE_FIELDS and LOW_COVERAGE_FIELDS[field] < 0.50:
        signal["confidence_tier"] = "insufficient_data"
        signal["trust_score"] = None
        signal["evidence_text"] = f"Field '{field}' has {LOW_COVERAGE_FIELDS[field]*100:.0f}% dataset coverage — not reliable as evidence"
    return signal
```

---

## 5. Application Layer

### 5.1 Streamlit App Structure

```
app/
├── main.py                  # App entry point, Databricks App config
├── components/
│   ├── search_panel.py      # Search bar, filters, results list
│   ├── trust_scorecard.py   # Per-facility scorecard with evidence panels
│   ├── analyst_workbench.py # Notes, overrides, shortlist, flags
│   └── uncertainty_badge.py # Reusable confidence/uncertainty UI component
├── services/
│   ├── facility_service.py  # Query layer — search, fetch, filter
│   ├── trust_service.py     # Fetch trust signals for a facility
│   └── action_service.py    # Read/write analyst actions to Delta
└── utils/
    ├── delta_client.py      # Delta Lake connection helpers
    └── session.py           # Session state management
```

### 5.2 Key UI Components

**Trust Score Badge**

```
┌─────────────────────────────────┐
│ CAPABILITY TRUST                │
│                                 │
│  ████████████░░░░  72 / 100    │
│  Confidence: MEDIUM             │
│                                 │
│  📄 Evidence:                   │
│  "Equipped with dialysis units  │
│   and nephrology consultation   │
│   services available on-site."  │
│  Source: description            │
└─────────────────────────────────┘
```

**Contradiction Alert**

```
┌─────────────────────────────────┐
│ ⚠️  CONTRADICTION DETECTED      │
│                                 │
│  Structured field:              │
│  icu_available = "Yes"          │
│                                 │
│  Free text says:                │
│  "basic outpatient services     │
│   only — no inpatient beds"     │
│                                 │
│  Severity: HIGH                 │
│  Recommendation: Do not rely    │
│  on structured ICU field.       │
└─────────────────────────────────┘
```

**Insufficient Data Badge**

```
┌─────────────────────────────────┐
│ CAPACITY                        │
│                                 │
│  ⚠️  INSUFFICIENT DATA          │
│  This field has 25% dataset     │
│  coverage. Score suppressed.    │
│  Do not use for planning.       │
└─────────────────────────────────┘
```

### 5.3 Search & Filter Query

```python
def search_facilities(
    query: str,
    state: str | None = None,
    min_trust_score: float = 0.0,
    has_contradiction: bool | None = None,
    limit: int = 25,
    offset: int = 0,
) -> DataFrame:
    """
    Full-text search across facility fields with optional filters.
    Joins with trust signals for score display.
    Returns paginated results.
    """
    base_sql = f"""
        SELECT
            f.facility_id,
            f.facility_name,
            f.state,
            f.facility_type,
            AVG(t.trust_score) AS overall_trust_score,
            MAX(CASE WHEN t.contradiction THEN 1 ELSE 0 END) AS has_contradiction,
            MIN(t.confidence_tier) AS min_confidence_tier
        FROM facilities_raw f
        LEFT JOIN facilities_trust_signals t ON f.facility_id = t.facility_id
        WHERE (
            f.description LIKE '%{query}%'
            OR f.capability LIKE '%{query}%'
            OR f.facility_name LIKE '%{query}%'
        )
        {f"AND f.state = '{state}'" if state else ""}
        {f"AND t.contradiction = TRUE" if has_contradiction else ""}
        GROUP BY f.facility_id, f.facility_name, f.state, f.facility_type
        HAVING AVG(t.trust_score) >= {min_trust_score}
        ORDER BY overall_trust_score DESC
        LIMIT {limit} OFFSET {offset}
    """
    return spark.sql(base_sql)
```

### 5.4 Analyst Action Persistence

```python
def save_analyst_action(
    facility_id: str,
    analyst_id: str,
    action_type: str,  # 'note' | 'override' | 'shortlist' | 'flag'
    content: str,
    dimension: str | None = None,
    override_score: float | None = None,
) -> None:
    """
    Write analyst workbench action to Delta Lake.
    Upserts on (facility_id, analyst_id, action_type, dimension).
    """
    action_df = spark.createDataFrame([{
        "action_id": str(uuid4()),
        "facility_id": facility_id,
        "analyst_id": analyst_id,
        "action_type": action_type,
        "dimension": dimension,
        "content": content,
        "override_score": override_score,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
    }])
    
    action_df.write.format("delta") \
        .mode("append") \
        .saveAsTable("facilities_user_actions")
```

---

## 6. Repository Structure

```
facilityiq/
├── README.md
├── docs/
│   ├── PRD.md                        # This document's companion
│   └── TDD.md                        # This document
├── notebooks/
│   ├── 00_setup.py                   # Create Delta tables, load raw CSV
│   ├── 01_trust_extraction.py        # LLM batch pipeline
│   └── 02_validate_signals.py        # Spot-check extraction quality
├── app/
│   ├── main.py                       # Streamlit entry point
│   ├── components/
│   │   ├── search_panel.py
│   │   ├── trust_scorecard.py
│   │   ├── analyst_workbench.py
│   │   └── uncertainty_badge.py
│   ├── services/
│   │   ├── facility_service.py
│   │   ├── trust_service.py
│   │   └── action_service.py
│   └── utils/
│       ├── delta_client.py
│       └── session.py
├── prompts/
│   └── trust_extraction.py           # Versioned prompt templates
├── requirements.txt
└── databricks.yml                    # Databricks Asset Bundle config
```

---

## 7. Implementation Phases

Given the hackathon timeline (June 15 evening → June 16, 3 PM Devpost submission):

| Phase | Tasks | Owner | Target |
|---|---|---|---|
| **P0 — Foundation** | Load dataset to Delta, create tables, validate schema | Data/Infra | Night of June 15 |
| **P1 — Pipeline** | Build + run LLM extraction notebook across all 10k facilities | ML | Night of June 15 |
| **P2 — App Core** | Search panel, trust scorecard with evidence display | Frontend | Morning June 16 |
| **P3 — Persistence** | Analyst workbench (notes, overrides, shortlist, flags) | Backend | Morning June 16 |
| **P4 — Polish** | Contradiction UI, uncertainty badges, demo flow rehearsal | All | Afternoon June 16 |
| **P5 — Submit** | Devpost write-up, repo cleanup, Databricks App link | All | By 3:00 PM June 16 |

---

## 8. Key Technical Decisions

### ADR-001: Streamlit over Gradio

**Decision:** Use Streamlit for the app framework.  
**Rationale:** Streamlit's component model maps cleanly to the trust scorecard UX (expandable sections, badges, state management). Gradio is better suited for model I/O demos, not multi-panel analyst tools.

### ADR-002: Single LLM pass per facility

**Decision:** Extract all dimensions in one prompt call per facility rather than separate calls per dimension.  
**Rationale:** Reduces API calls by 4x, enables cross-dimension contradiction detection in a single context window, and keeps cost/latency manageable for 10k records.

### ADR-003: Trust score suppression for low-coverage fields

**Decision:** Suppress trust scores (return `null`) for fields with <50% dataset coverage rather than scoring them with low confidence.  
**Rationale:** A visible "Insufficient Data" badge is more honest and more useful to a planner than a low score that implies the field was assessed. Aligns directly with judging criterion #2 (Evidence and Uncertainty).

### ADR-004: Append-only action log

**Decision:** `facilities_user_actions` is append-only; latest action per `(facility_id, analyst_id, action_type, dimension)` is the effective state.  
**Rationale:** Provides a full audit trail of analyst decisions. Delta's time travel makes this essentially free. Overrides are resolved at read time by taking `MAX(updated_at)`.

---

## 9. Risk Register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| LLM extraction takes too long for 10k records | Medium | High | Process top 2k records first; use parallel Spark UDF if needed |
| Foundation Model API rate limits hit | Medium | High | Batch with sleep intervals; fall back to smaller model (DBRX) |
| Streamlit app state lost on Databricks App restart | Low | Medium | All state persisted to Delta; app rehydrates on load |
| Prompt produces malformed JSON | Low | Medium | Wrap all LLM calls in try/except; write failed rows to `extraction_errors` table |
| Dataset schema differs from expected | Low | High | Run `00_setup.py` schema validation before pipeline kicks off |
