# FacilityIQ Data Validation Checks

**Version:** 1.0  
**Date:** June 15, 2026  
**Status:** Draft  
**Purpose:** Define facility-level data validation checks that produce a Quality Score for each facility record.

---

## 1. Why This Matters

FacilityIQ already answers: *Can we trust what this facility claims?*

The data quality layer answers a different but equally important question: *Can we trust this facility record at all?*

A facility may have reasonable free-text evidence, but if its phone number, email address, coordinates, or identity fields are reused across many unrelated facilities, that is a strong sign that the underlying record needs review. These checks should create a separate **Quality Score** that helps planners and analysts spot suspicious records before relying on trust scores.

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

## 6. Suggested Output Table

Create a derived Delta table with one row per validation issue.

```sql
CREATE TABLE facilities_quality_issues (
  issue_id          STRING NOT NULL,
  facility_id       STRING NOT NULL,
  check_name        STRING NOT NULL,
  severity          STRING NOT NULL, -- 'critical' | 'high' | 'medium' | 'low'
  penalty_points    INT NOT NULL,
  issue_summary     STRING NOT NULL,
  issue_detail      STRING,
  evidence_value    STRING,
  related_count     INT,
  related_facilities ARRAY<STRING>,
  detected_at       TIMESTAMP NOT NULL
)
USING DELTA;
```

Create a second table with one row per facility.

```sql
CREATE TABLE facilities_quality_scores (
  facility_id        STRING NOT NULL,
  quality_score      INT NOT NULL,
  quality_tier       STRING NOT NULL, -- 'high_quality' | 'needs_review' | 'low_quality' | 'critical_issue'
  issue_count        INT NOT NULL,
  critical_count     INT NOT NULL,
  high_count         INT NOT NULL,
  medium_count       INT NOT NULL,
  low_count          INT NOT NULL,
  computed_at        TIMESTAMP NOT NULL
)
USING DELTA;
```

---

## 7. Example PySpark Checks

### Duplicate Email

```python
from pyspark.sql import functions as F

email_counts = (
    facilities_raw
    .withColumn("email_normalized", F.lower(F.trim(F.col("email"))))
    .filter(F.col("email_normalized").isNotNull())
    .filter(F.col("email_normalized") != "")
    .groupBy("email_normalized")
    .agg(
        F.countDistinct("facility_id").alias("facility_count"),
        F.collect_set("facility_id").alias("related_facilities"),
    )
    .filter(F.col("facility_count") > 1)
)
```

### Duplicate Phone

```python
phone_counts = (
    facilities_raw
    .withColumn("phone_normalized", F.regexp_replace(F.col("phone"), r"[^0-9]", ""))
    .filter(F.length("phone_normalized") >= 7)
    .groupBy("phone_normalized")
    .agg(
        F.countDistinct("facility_id").alias("facility_count"),
        F.collect_set("facility_id").alias("related_facilities"),
    )
    .filter(F.col("facility_count") > 1)
)
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
