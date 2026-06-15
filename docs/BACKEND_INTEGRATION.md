# FacilityIQ — Backend ↔ Frontend Integration

**Purpose:** the data contract the Streamlit/AppKit frontend wires against. Lists every table the app reads and writes, their schemas, how they join, and the order the pipeline must run.

All tables live in **`workspace.facilityiq`** (adjust if your catalog/schema differ). The frontend reaches them via `spark.sql(...)` in the `app/services/` layer.

---

## 1. Data Flow

```
External raw  ──►  facilities_bronze  ──►  facilities_silver  ──►  facilities_gold ◄── facilities_overrides
(51-col source)     (39-col landing)       (typed + cleaned)        (analyst-ready)     (user data edits)

facilities_silver ──► (LLM trust extraction) ──► facilities_trust_signals
facilities_*      ──► (SQL quality checks)   ──► facilities_quality_scores ──► facilities_email_outreach

Frontend writes:  facilities_overrides (data edits) · facilities_user_actions (notes/shortlist/flag/score override)
```

**Join key:** the facility identifier is `unique_id` in the medallion tables and `facility_id` in the signal/score/action tables. **They are the same value** — join `facilities_gold.unique_id = facilities_trust_signals.facility_id`.

---

## 2. Tables the Frontend READS

### 2.1 `facilities_gold` — analyst-ready facility records
One row per facility. Silver with the latest analyst overrides merged in. Source: [sql/gold/facilities_gold.sql](../sql/gold/facilities_gold.sql).

Key columns the UI uses:

| Column | Type | Notes |
|---|---|---|
| `unique_id` | STRING | Facility PK. Join key to all signal/score tables. |
| `name` | STRING | Facility name (override-aware). |
| `facility_type_id` | STRING | e.g. `hospital`, `clinic`. |
| `address_city`, `address_state_or_region`, `address_country` | STRING | Location. |
| `official_phone`, `email`, `official_website` | STRING | Cleaned contacts. |
| `capacity`, `number_doctors`, `year_established` | INT | Nullable; low coverage. |
| `description`, `affiliation_type_ids` | STRING / ARRAY<STRING> | Free text + tags. |
| `latitude`, `longitude` | DOUBLE | **Currently ~all NULL** — geolocation absent in the 39-col source. |
| `overridden_fields` | ARRAY<STRING> | Which columns were analyst-overridden (for a "edited" badge). |

### 2.2 `facilities_trust_signals` — LLM claim-trust assessment
**One row per `(facility_id, dimension)`**, partitioned by `dimension`. Dimensions: `capability`, `equipment`, `procedure`, `completeness`. Source: [prompts/trust_signals_writer.py](../prompts/trust_signals_writer.py).

| Column | Type | Notes |
|---|---|---|
| `facility_id` | STRING | = `facilities_gold.unique_id`. |
| `dimension` | STRING | One of the four dimensions. |
| `trust_score` | DOUBLE | 0.0–1.0, or NULL when `insufficient_data`. |
| `confidence_tier` | STRING | `high` \| `medium` \| `low` \| `insufficient_data`. |
| `evidence_text` | STRING | Exact source quote shown in the UI. |
| `source_field` | STRING | Field the quote came from. |
| `contradiction` | BOOLEAN | Drives the contradiction badge. |
| `contradiction_detail` | STRING | Explanation when `contradiction = true`. |
| `extraction_model`, `extracted_at` | STRING / TIMESTAMP | Provenance. |

> **Overall trust score** (the big number in the UI) = `AVG(trust_score)` across a facility's dimensions, ignoring rows where `trust_score IS NULL` (i.e. `insufficient_data` is excluded). `completeness` is always `insufficient_data`/NULL, so it never affects the average.

### 2.3 `facilities_quality_scores` — record-integrity score (SEPARATE from trust)
One row per flagged facility. Source: [prompts/quality_score.py](../prompts/quality_score.py).

| Column | Type | Notes |
|---|---|---|
| `facility_id` | STRING | = `facilities_gold.unique_id`. |
| `quality_score` | INT | 0–100. `100 − total_penalty`, floored at 0. |
| `quality_tier` | STRING | `high_quality` (85+) \| `needs_review` (65+) \| `low_quality` (40+) \| `critical_issue`. |
| `total_penalty_points` | INT | Sum of penalties across checks. |
| `issues` | ARRAY<STRING> | Human-readable issue strings (e.g. "Phone number shared with 8 facilities"). |
| `computed_at` | TIMESTAMP | |

> Show this as a **second badge** next to the trust score — they answer different questions. Trust = "are the claims evidence-backed?"; Quality = "is the record itself reliable?". A high trust + low quality facility should be surfaced for review. Facilities with no issues have **no row** here (treat as `quality_score = 100`).

### 2.4 `facilities_email_outreach` — per-email data state (for the outreach flow)
Keyed by `email`. Source: [prompts/email_outreach.py](../prompts/email_outreach.py).

| Column | Type | Notes |
|---|---|---|
| `email` | STRING | Primary key. |
| `facility_count` | INT | How many facilities share this email. |
| `facility_ids`, `facility_names`, `states`, `cities` | ARRAY<STRING> | Associated facilities + locations. |
| `is_shared` | BOOLEAN | `facility_count > 1`. |
| `min_quality_score`, `avg_quality_score` | INT | Quality of the associated facilities. |
| `issues` | ARRAY<STRING> | Aggregated data issues to mention in the outreach. |
| `computed_at` | TIMESTAMP | |

---

## 3. Tables the Frontend WRITES

### 3.1 `facilities_overrides` — analyst data corrections
Append-only audit log; **gold applies the latest row per `(facility_id, field_name)`**. Source: [sql/gold/facilities_overrides.sql](../sql/gold/facilities_overrides.sql).

| Column | Type | Notes |
|---|---|---|
| `facility_id` | STRING | Target facility. |
| `field_name` | STRING | Gold column to override (e.g. `capacity`, `address_city`, `email`). |
| `new_value` | STRING | Stored as text; cast on apply in gold. |
| `analyst_id` | STRING | Who made the edit. |
| `reason` | STRING | Why (recommended/required by UI). |
| `updated_at` | TIMESTAMP | Latest-wins ordering. |

**Write pattern (append only):**
```python
override_df.write.format("delta").mode("append") \
    .saveAsTable("workspace.facilityiq.facilities_overrides")
```
The edit becomes visible after `facilities_gold.sql` is re-run (gold is rebuilt from silver + overrides).

### 3.2 `facilities_user_actions` — notes / shortlist / flag / score override
Append-only analyst action log (per CLAUDE.md). Effective state = latest row per `(facility_id, analyst_id, action_type, dimension)` by `updated_at`. `action_type` ∈ `note | override | shortlist | flag`.

> **Status:** defined in the architecture but not yet created by a script. When implementing, mirror the append-only + latest-wins pattern above. Note this is distinct from `facilities_overrides`: this logs *trust-dimension score overrides and workbench actions*; `facilities_overrides` logs *raw data-field corrections* applied in gold.

---

## 4. Email Outreach Draft (backend helper)

`build_email_draft(user_name, record)` in [prompts/email_outreach.py](../prompts/email_outreach.py) returns the friendly draft text from a `facilities_email_outreach` row. The frontend supplies the logged-in user's name, lets the user review/edit, then sends.

```python
from prompts.email_outreach import build_email_draft
row = spark.sql("SELECT * FROM workspace.facilityiq.facilities_email_outreach WHERE email = :e", args={"e": email}).first().asDict()
draft = build_email_draft(current_user_name, row)
```

Send + recipient-confirmation status is **not yet persisted** — when built, add an append-only outreach-status table (same pattern as §3).

---

## 5. Pipeline Run Order

1. `sql/bronze/facilities_bronze.sql`
2. `sql/silver/facilities_silver.sql`
3. `sql/gold/facilities_overrides.sql` *(create once; never drop)*
4. `sql/gold/facilities_gold.sql` *(re-run to apply new overrides)*
5. `notebooks/01_trust_extraction.py` → builds `facilities_quality_scores`, `facilities_email_outreach`, then `facilities_trust_signals`

---

## 6. Open Integration Items

- **Geolocation:** `latitude`/`longitude` are absent in the 39-column source, so gold's are NULL and `06_address_and_location_quality.sql` flags every facility. Needs a coordinate source or that check relaxed.
- **Source of truth for quality/trust:** the `sql/data_quality/` checks and trust extraction still read the **external 51-column** table, which has columns the 39-column medallion lacks (`phone_numbers`, `capability`, `procedure`, `equipment`). Decide whether to repoint these at `facilities_silver`/`facilities_gold`.
- **`facilities_user_actions`** table not yet scripted (see §3.2).
- **Outreach status** persistence not yet built (see §4).
