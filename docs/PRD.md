# FacilityIQ — Product Requirements Document

**Version:** 1.0  
**Date:** June 15, 2026  
**Track:** Facility Trust Desk  
**Hackathon:** Databricks Data + AI Summit 2026  
**Status:** Active

 ---

## 1. Problem Statement

Healthcare planners in India are making facility referral and resource allocation decisions using a dataset of 10,000 facility records that is structurally inconsistent, free-text-heavy, and of variable quality. Fields like `capacity` (25% coverage) and `year_established` (48% coverage) are unreliable, while claimed capabilities, equipment, and procedures appear in unstructured text that cannot be trusted at face value.

Today, a planner has no systematic way to:

- Verify whether a facility can actually do what it claims
- Understand *why* a trust score is high or low
- Persist their analysis decisions across sessions
- Know when they should doubt the data rather than act on it

The result is decisions made on weak or unverified evidence — with real patient outcomes at stake.

 ---

## 2. Goals

- **G1:** Give non-technical healthcare planners a single, intuitive interface to evaluate facility trustworthiness
- **G2:** Surface evidence directly from the underlying facility text for every trust signal — no black boxes
- **G3:** Communicate data uncertainty honestly and visibly, not buried in footnotes
- **G4:** Persist analyst work (notes, overrides, shortlists, flags) across sessions via Delta Lake
- **G5:** Flag claim contradictions — where structured fields and free text conflict — as a first-class insight

 ---

## 3. Non-Goals

- **NG1:** Real-time or live data ingestion — dataset is fixed at 10k records for this iteration
- **NG2:** Patient-facing features — this is a planner tool only
- **NG3:** Multi-language support — English UI, dataset is English
- **NG4:** Geographic map visualization — out of scope for v1
- **NG5:** Integration with external data sources beyond the provided FDR dataset

 ---

## 4. User Persona

### Maya — Healthcare Infrastructure Planner

> *"I need to know if I can trust what this facility says it can do. I don't have time to read 10,000 records, but I can't afford to refer a patient somewhere that can't actually treat them."*

| Attribute | Detail |
| --- | --- |
| Role | Healthcare facility planner / procurement analyst |
| Technical level | Non-technical — comfortable with Excel, not SQL |
| Primary goal | Identify trustworthy facilities for referral or resource allocation |
| Pain point | Cannot verify facility claims; dataset is inconsistent and hard to read |
| Session behavior | Searches by specialty or geography, builds shortlists, adds notes, resumes work across days |

 ---

## 5. Core User Flows

### Flow 1: Facility Search & Trust Overview

```plaintext
Maya opens FacilityIQ
  → Enters search query ("dialysis centers, Maharashtra")
  → Sees ranked list of matching facilities with:
      - Trust Score (0–100, color-coded: green/yellow/red)
      - Confidence Tier (High / Medium / Low / Insufficient Data)
      - Quick-flag indicators (contradiction detected, missing fields)
  → Selects a facility to drill down
```

### Flow 2: Facility Trust Scorecard

```plaintext
Maya views a facility detail page
  → Sees Trust Score broken into dimensions:
      - Capability Trust
      - Equipment Trust
      - Procedure Trust
      - Data Completeness
  → Expands any dimension to see:
      - The exact source text that supports the score
      - Confidence level with reason
      - Contradiction flag if structured field conflicts with free text
```

### Flow 3: Analyst Workbench (Persist Actions)

```plaintext
Maya takes action on a facility:
  → Adds a note ("Follow up — ICU claim needs verification")
  → Overrides a trust score with a reason ("Verified via phone — confirmed")
  → Adds to shortlist or flags for review
  → All actions persist to Delta Lake
  → On next session, Maya's workbench state is fully restored
```

### Flow 4: Contradiction Alert

```
Maya sees a red contradiction badge on a facility
  → Clicks to expand
  → Sees: Structured field says "ICU: Yes"
           Free text says "basic outpatient services only — no inpatient beds"
  → FacilityIQ labels this: HIGH CONTRADICTION — do not rely on structured field
  → Maya flags for manual review
```

 ---

## 6. Functional Requirements

### 6.1 Search & Filter

| ID | Requirement | Priority |
| --- | --- | --- |
| F-01 | Full-text search across facility name, location, specialty, and capability fields | P0 |
| F-02 | Filter by state/region, facility type, trust score tier | P0 |
| F-03 | Sort by trust score (desc), completeness, or name | P0 |
| F-04 | Paginated results with at least 25 records per page | P1 |

### 6.2 Trust Scoring

| ID | Requirement | Priority |
| --- | --- | --- |
| F-05 | Per-facility trust score (0–100) computed across capability, equipment, and procedure dimensions | P0 |
| F-06 | Each dimension score is traceable to at least one cited sentence from the source text | P0 |
| F-07 | Fields with <50% dataset coverage (capacity, year_established) must display explicit uncertainty badge — score suppressed or labeled "Insufficient Data" | P0 |
| F-08 | Contradiction detection: flag facilities where structured field and free text materially conflict | P0 |
| F-09 | Confidence tier label (High / Medium / Low / Insufficient Data) displayed prominently per dimension | P0 |

### 6.3 Evidence Display

| ID | Requirement | Priority |
| --- | --- | --- |
| F-10 | Every trust signal must display the exact sentence(s) from source text that produced it | P0 |
| F-11 | Evidence quotes are highlighted inline — distinct visual treatment from analyst notes | P0 |
| F-12 | Source field name (e.g., `description`, `capability`) must be labeled on each citation | P1 |

### 6.4 Analyst Workbench (Persistence)

| ID | Requirement | Priority |
| --- | --- | --- |
| F-13 | Analyst can add free-text notes per facility | P0 |
| F-14 | Analyst can override any dimension trust score with a mandatory reason field | P0 |
| F-15 | Analyst can add/remove facilities from a named shortlist | P0 |
| F-16 | Analyst can flag a facility for review | P0 |
| F-17 | All actions persist to Delta Lake — survive page refresh and new session | P0 |
| F-18 | Workbench state (shortlists, notes, flags) visible in search results list view | P1 |

 ---

## 7. Non-Functional Requirements

| ID | Requirement |
| --- | --- |
| NF-01 | App runs on Databricks Free Edition — no paid compute dependencies |
| NF-02 | Facility detail page loads within 3 seconds for cached trust signals |
| NF-03 | LLM extraction batch job completes for all 10k facilities within available hack time |
| NF-04 | UI is usable without any SQL, JSON, or technical knowledge |
| NF-05 | App is publicly accessible for demo purposes during judging window |

 ---

## 8. Success Metrics (Judging Alignment)

| Judging Criterion | How FacilityIQ Addresses It |
| --- | --- |
| **Product judgment** | Clear persona (Maya), single coherent workflow, no technical leakage into UI |
| **Evidence & uncertainty** | Every score cites source text; uncertainty is a first-class visual element, not hidden |
| **Technical execution** | Delta persistence, LLM batch pipeline, Databricks App stack used end-to-end |
| **Ambition** | Claim contradiction detection is a non-trivial, novel insight layer on top of raw scoring |

 ---

## 9. Out of Scope (v1)

- Map/choropleth visualization of facility distribution
- Multi-user collaboration (concurrent analyst sessions)
- External data enrichment beyond the FDR dataset
- Export to PDF or Excel
- Role-based access control
