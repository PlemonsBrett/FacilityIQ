# FacilityIQ

> **Databricks Data + AI Summit 2026 Hackathon — Track 1: Facility Trust Desk**

FacilityIQ helps non-technical healthcare planners evaluate the trustworthiness of facility claims across 10,000 India healthcare records — grounding every score in cited evidence and surfacing uncertainty honestly.

---

## The Problem

India's healthcare facility dataset is messy. Structured fields conflict with free text. Coverage is uneven — capacity data exists for only 25% of facilities. Planners making referral and resource decisions can't tell if a facility actually does what it claims.

FacilityIQ fixes that.

---

## What It Does

- **Trust Scoring** — per-facility scores across capability, equipment, and procedure dimensions
- **Evidence Citations** — every score traces back to the exact sentence in the source text
- **Uncertainty Badges** — low-coverage fields (capacity, year established) are flagged honestly, never scored
- **Contradiction Detection** — flags where structured fields directly conflict with free text
- **Analyst Workbench** — notes, overrides, shortlists, and flags that persist across sessions via Delta Lake

---

## Demo Flow

1. Open FacilityIQ → search "dialysis, Maharashtra"
2. See ranked trust scores with contradiction indicators
3. Drill into a facility → view Trust Scorecard with cited evidence
4. Spot a contradiction alert → flag for review
5. Add a note → close the app → reopen → note is still there

---

## Tech Stack

| Layer | Technology |
|---|---|
| Platform | Databricks Free Edition |
| App Framework | Streamlit (Databricks Apps) |
| Storage | Delta Lake (Unity Catalog) |
| LLM | Databricks Foundation Model APIs (Llama 3.1 70B) |
| Orchestration | Databricks Workflows |

---

## Docs

- [Product Requirements Document](docs/PRD.md)
- [Technical Design Document](docs/TDD.md)

---

## Repository Structure

```plaintext
facilityiq/
├── docs/
│   ├── PRD.md
│   └── TDD.md
├── notebooks/
│   ├── 00_setup.py           # Delta table setup, raw data load
│   ├── 01_trust_extraction.py # LLM batch pipeline
│   └── 02_validate_signals.py # Extraction quality checks
├── app/
│   ├── main.py
│   ├── components/
│   ├── services/
│   └── utils/
├── prompts/
│   └── trust_extraction.py
└── requirements.txt
```

---

## Team

Built at Databricks Data + AI Summit 2026 Hackathon — June 15–16, 2026.
