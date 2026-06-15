# FacilityIQ

> **Databricks Data + AI Summit 2026 Hackathon — Track 1: Facility Trust Desk**

FacilityIQ helps non-technical healthcare planners evaluate the trustworthiness of facility claims across 10,000 India healthcare records — grounding every score in cited evidence and surfacing uncertainty honestly.

---

## The Problem

The Virtue Foundation's **VF Match** platform already does facility discovery well — mapping facilities, surfacing medical deserts, connecting volunteers to underserved regions. What it doesn't have is **trust**.

India's healthcare facility dataset is messy: structured fields conflict with free text, capacity data exists for only 25% of facilities, and claimed capabilities can't be verified at face value. Planners making referral and resource decisions can't tell if a facility actually does what it claims.

**FacilityIQ is the trust layer VF Match is missing for India.**

> *"VF Match shows you facilities. FacilityIQ tells you whether to trust them."*

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
| --- | --- |
| Platform | Databricks Free Edition |
| App Framework | Streamlit (Databricks Apps) |
| Storage | Delta Lake (Unity Catalog) |
| LLM | Databricks Foundation Model APIs (Llama 3.1 70B) |
| Orchestration | Databricks Workflows |

---

## Local Development

Dependencies are managed with [uv](https://docs.astral.sh/uv/). Python 3.12 required.

```bash
# Install uv (if not already installed)
curl -LsSf https://astral.sh/uv/install.sh | sh

# Install dependencies
uv sync

# Run the app locally (limited without a Databricks cluster)
uv run streamlit run app/main.py
```

> **Note on Databricks compatibility:** uv is for local development only. Databricks Apps reads a `requirements.txt` at deploy time, and notebooks/workflows run `%pip install` on the cluster — neither uses uv directly. When dependencies change, regenerate `requirements.txt` with:
> ```bash
> uv export --format requirements-txt --no-hashes -o requirements.txt
> ```

---

## Docs

- [Product Requirements Document](docs/PRD.md)
- [Technical Design Document](docs/TDD.md)

---

## Repository Structure

```
DBX-For-Good/
├── docs/
│   ├── PRD.md                 # Product requirements
│   └── TDD.md                 # Technical design
├── notebooks/
│   ├── 00_setup.py            # Delta table setup, raw data load
│   ├── 01_trust_extraction.py # LLM batch pipeline
│   └── 02_validate_signals.py # Extraction quality checks
├── app/
│   ├── main.py                # Streamlit entry point
│   ├── components/            # UI panels
│   ├── services/              # Data access layer
│   └── utils/                 # Delta client, session helpers
├── prompts/
│   └── trust_extraction.py    # LLM prompt template
└── pyproject.toml             # Dependencies (managed with uv)
```

Notebooks run on a Databricks cluster in order: `00_setup.py` → `01_trust_extraction.py` → `02_validate_signals.py`.

---

## Team

Built at Databricks Data + AI Summit 2026 Hackathon — June 15–16, 2026.
