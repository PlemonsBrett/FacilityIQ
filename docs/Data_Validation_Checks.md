# FacilityIQ Data Validation Checks

**Version:** 1.0  
**Date:** June 15, 2026  
**Status:** Draft  
**Purpose:** Define facility-level data validation checks that produce a Quality Score for each facility record.

---

## 1. Why This Matters

FacilityIQ already answers: *Can we trust what this facility claims?*

The data quality layer answers a different but equally important question: *Can we trust this facility record at all?*

A facility may have reasonable free-text evidence, but if its phone number, email address, coordinates, or identity fields are reused across many unrelated facilities, that is a strong sign that the underlying record needs review. These checks should create a separate **Quality Score** that helps planners and analysts spot suspicious records before relying on trust scores. For the hackathon, the fastest path is query-only: run reusable Databricks SQL checks directly against the source table and review the 100 lowest-scoring facilities.

---

## 2. Quality Score Overview

Each facility receives a **Quality Score from 0 to 100**.

Suggested interpretation:

| Score Range | Label | Meaning |
|---|---|---|
| 85-100 | High Quality | Record looks internally consistent and complete |
| 65-84 | Needs Review | Minor quality issues or missing fields |
| 40-64 | Low Quality | Multiple quality issues; review before use |
| 0-39 | Critical Issue | Strong evidence that the record is wrong, duplicated, or unsafe to trust |

The Quality Score should be displayed separately from the Trust Score. Trust Score evaluates facility claims; Quality Score evaluates the reliability of the record itself.

---

## 3. Proposed Scoring Model

Start each facility at 100 points, then subtract points for failed checks.

| Severity | Suggested Penalty | Example |
|---|---:|---|
| Critical | -40 to -60 | Same phone number reused across many unrelated facilities |
| High | -20 to -35 | Duplicate email across multiple facilities |
| Medium | -10 to -20 | Missing facility type or invalid state |
| Low | -3 to -10 | Formatting issue, suspicious punctuation, weak address |

Scores should floor at 0. Each penalty should create a visible validation issue with an explanation and severity.

Reusable query scripts live in `sql/data_quality/`:

| Script | Purpose |
|---|---|
| `01_duplicate_phones.sql` | Finds phone numbers reused across facilities |
| `02_duplicate_emails.sql` | Finds email addresses reused across facilities |
| `03_duplicate_facility_identity.sql` | Finds likely duplicate facility records |
| `04_missing_core_fields.sql` | Finds records missing name, type, location, or contacts |
| `05_invalid_contact_formats.sql` | Finds malformed or placeholder emails/phones |
| `06_address_and_location_quality.sql` | Finds weak locations and coordinates outside India |
| `07_text_field_quality.sql` | Finds thin or duplicated evidence-bearing text |
| `08_top_100_worst_quality_scores.sql` | Combines checks into a query-only Quality Score and returns the 100 worst facilities |

---

## 4. High-Priority Validation Checks

### 4.1 Duplicate Email Across Facilities

**Goal:** Detect when the same email address appears on multiple facility records.

This is often suspicious because most facilities should have distinct contact identities. A reused generic email may be legitimate for a chain, government network, or central office, but it still deserves visibility.

**Check:**

- Normalize email values by trimming whitespace and lowercasing.
- Exclude empty, null, placeholder, or obviously invalid emails.
- Count distinct `facility_id` values per normalized email.
- Flag any email attached to more than one facility.

**Severity guidance:**

| Pattern | Severity |
|---|---|
| Same email on 2 facilities with same parent/network | Medium |
| Same email on 2-5 unrelated facilities | High |
| Same email on 6+ facilities | Critical |
| Placeholder email such as `test@example.com` | Critical |

**Example issue text:**

> This email appears on 8 facility records. Contact information may have been copied or assigned generically.

### 4.2 Duplicate Phone Number Across Facilities

**Goal:** Detect phone numbers reused across multiple facilities.

Duplicate phone numbers are a strong data quality signal. Some duplicates may be valid for a hospital system, central appointment line, or district office, but many repeated phone numbers suggest copied records, stale contact data, or records that do not represent distinct facilities.

**Check:**

- Normalize phone numbers by removing punctuation, spaces, country prefixes, and leading zeros where appropriate.
- Exclude null, blank, or placeholder values.
- Count distinct `facility_id` values per normalized phone number.
- Flag phone numbers attached to multiple facilities.

**Severity guidance:**

| Pattern | Severity |
|---|---|
| Same phone number on 2 nearby related facilities | Medium |
| Same phone number on 2-5 unrelated facilities | High |
| Same phone number on 6+ facilities | Critical |
| Phone number has too few digits after normalization | High |

**Example issue text:**

> This phone number is shared by 12 facilities. The record may not have facility-specific contact information.

### 4.3 Duplicate Facility Identity

**Goal:** Detect likely duplicate facility records.

**Check:**

- Normalize facility name, address, city, state, and postal code.
- Flag exact matches on normalized name plus location.
- Flag fuzzy matches where name similarity is high and geographic/location fields are similar.

**Severity guidance:**

| Pattern | Severity |
|---|---|
| Same normalized name and same address | Critical |
| Same normalized name and same city/state | High |
| Similar name and nearby address | Medium |

### 4.4 Missing Core Identity Fields

**Goal:** Flag records that cannot be safely interpreted.

**Required or near-required fields:**

- Facility name
- Facility type
- State or region
- District/city, if available
- At least one usable contact field
- At least one descriptive/capability field

**Severity guidance:**

| Missing Field | Severity |
|---|---|
| Facility name | Critical |
| State/region | High |
| Facility type | Medium |
| All contact fields | Medium |
| Description/capability text | High |

### 4.5 Invalid Contact Formats

**Goal:** Catch malformed or placeholder contact values.

**Email examples to flag:**

- Missing `@`
- Missing domain
- Known placeholders such as `na`, `none`, `test@example.com`, `abc@xyz.com`
- Multiple emails jammed into one field without clean parsing

**Phone examples to flag:**

- Too few digits
- All repeated digits, such as `0000000000` or `9999999999`
- Values that are not phone-like after normalization

### 4.6 Contradictory Structured Fields

**Goal:** Detect conflicts inside structured data before comparing with free text.

**Examples:**

- `capacity = 0` while facility type is a hospital
- `year_established` is in the future
- `year_established` is implausibly old
- Facility claims inpatient services but bed/capacity fields are empty or zero

### 4.7 Low-Coverage Field Guardrails

**Goal:** Prevent missingness from being mistaken for negative evidence.

Fields known to have poor coverage, such as `capacity` and `year_established`, should not be used to penalize a facility too heavily by themselves. Instead, missing low-coverage fields should generate visible uncertainty.

Suggested behavior:

- Missing `capacity`: low or no penalty, but show "low dataset coverage" warning.
- Present but invalid `capacity`: medium or high penalty.
- Missing `year_established`: low penalty or warning only.
- Future `year_established`: high penalty.

---

## 5. Medium-Priority Validation Checks

### 5.1 Address Quality

Flag addresses that are too short, contain placeholders, or lack useful locality details.

Examples:

- `NA`
- `Unknown`
- `India`
- Same address reused across unrelated facilities

### 5.2 Geographic Consistency

If latitude/longitude are available:

- Coordinates should be valid numeric values.
- Coordinates should fall within India.
- Coordinates should roughly align with the stated state or district.
- Multiple unrelated facilities at the exact same coordinates should be flagged.

### 5.3 Facility Type Consistency

Compare facility type against description/capability text.

Examples:

- Facility type says hospital, description says pharmacy.
- Facility type says diagnostic center, procedures indicate major surgery.
- Facility type says clinic, but text claims ICU and inpatient beds.

### 5.4 Text Quality

Flag records where text fields are unlikely to support evidence-based scoring.

Examples:

- Very short description
- Repeated boilerplate text across many facilities
- Garbled encoding
- Excessive punctuation or nonsensical text
- Description exactly duplicates capability, procedure, and equipment fields

---

## 6. Query-Only Output

For now, do not create persistent tables. Use the SQL scripts as repeatable analysis queries.

The main review query is:

```text
sql/data_quality/08_top_100_worst_quality_scores.sql
```

It returns:

- Facility identity fields
- `quality_score`
- `quality_tier`
- Issue counts by severity
- A list of issue summaries explaining why the facility scored poorly

If the team later wants persistence, the query output can be converted into Delta tables. Until then, query-only scoring keeps iteration fast and avoids managing extra tables during the hackathon.

---

## 7. Example Databricks SQL Check

The duplicate phone script follows this pattern:

```sql
WITH exploded_phones AS (
  SELECT
    unique_id,
    name,
    facilityTypeId,
    address_city,
    address_stateOrRegion,
    address_country,
    phone AS raw_phone,
    regexp_replace(phone, '[^0-9]', '') AS phone_normalized
  FROM databricks_virtue_foundation_dataset_dais_2026.virtue_foundation_dataset.facilities
  LATERAL VIEW explode(from_json(phone_numbers, 'ARRAY<STRING>')) exploded AS phone
  WHERE phone_numbers IS NOT NULL
    AND phone_numbers != 'null'
    AND phone_numbers != '[]'
),
dupes AS (
  SELECT phone_normalized, COUNT(DISTINCT unique_id) AS duplicate_count
  FROM exploded_phones
  WHERE phone_normalized IS NOT NULL
    AND length(phone_normalized) >= 7
  GROUP BY phone_normalized
  HAVING COUNT(DISTINCT unique_id) > 1
)
SELECT *
FROM exploded_phones e
INNER JOIN dupes d
  ON e.phone_normalized = d.phone_normalized
ORDER BY d.duplicate_count DESC, e.phone_normalized, e.name;
```

---

## 8. UI Recommendations

Add the Quality Score wherever the Trust Score appears, but keep the meaning distinct.

Suggested list-view indicators:

- Quality Score badge
- Duplicate contact warning icon
- Missing identity warning
- Critical issue count

Suggested facility-detail panel:

- Overall Quality Score
- Validation issue list grouped by severity
- Related facilities for duplicate email/phone checks
- Explanation of whether an issue affects record quality, claim trust, or both

Example message:

> Quality Score: 38 / 100. Critical duplicate-contact issue detected: this phone number appears on 14 facility records.

---

## 9. Relationship To Trust Score

Quality Score should not automatically replace Trust Score. Instead:

- Trust Score says whether facility claims are evidence-supported.
- Quality Score says whether the facility record has data integrity problems.
- A high Trust Score plus low Quality Score should trigger manual review.
- A low Trust Score plus low Quality Score should be treated as especially risky.
- A high Quality Score does not guarantee facility claims are true; it only means the record is cleaner.

For demo purposes, duplicate email and duplicate phone checks are excellent first validations because they are easy to explain, easy to compute, and immediately intuitive to judges.
