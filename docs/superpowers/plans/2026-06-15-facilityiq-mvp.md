# FacilityIQ MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deploy a working FacilityIQ app to Databricks Apps with facility search, trust score list, and a basic scorecard — end-to-end from Delta pipeline to live Postgres-backed UI.

**Architecture:** AppKit (TypeScript + React) app on Databricks Apps reads from Lakebase Postgres. Delta tables (`facilities_raw`, `facilities_trust_signals`) are synced into Lakebase via Synced Tables. Analyst actions write to an app-owned `facilityiq.user_actions` Postgres table. Everything is declared in a single `databricks.yml` DABs bundle.

**Tech Stack:** Databricks CLI, AppKit (`@databricks/appkit`), Lakebase Postgres, DABs, Python notebooks (PySpark + OpenAI SDK), React + inline styles (Navy Dark theme).

---

## Pre-flight: Gather environment values

Before starting, you need four values from your Databricks workspace. Run these and record the outputs — you'll need them throughout.

```bash
# Your CLI profile name (look for "Valid: YES")
databricks auth profiles

# Your workspace URL (e.g. https://adb-1234.azuredatabricks.net)
databricks current-user me --profile <PROFILE>

# Your Unity Catalog default catalog (usually "main" or your org name)
databricks unity-catalog catalogs list --profile <PROFILE>
```

Record: `PROFILE`, `WORKSPACE_URL`, `UC_CATALOG` (the catalog where you'll create the `facilityiq` schema).

---

## Task 1: Provision Lakebase project

**Files:** none (CLI only)

- [ ] **Step 1: Create the Lakebase project**

```bash
databricks postgres create-project facilityiq \
  --json '{"spec": {"display_name": "FacilityIQ"}}' \
  --profile <PROFILE>
```

Expected: JSON response with `name: "projects/facilityiq"`. The CLI waits until `READY`. This also auto-creates the `production` branch and `primary` endpoint.

- [ ] **Step 2: List branches and note the branch resource name**

```bash
databricks postgres list-branches projects/facilityiq --profile <PROFILE>
```

Expected: One branch. Record the `name` field, e.g. `projects/facilityiq/branches/production`.

- [ ] **Step 3: List databases and note the database resource name**

```bash
databricks postgres list-databases projects/facilityiq/branches/production --profile <PROFILE>
```

Expected: One database (`databricks_postgres`). Record the `name` field, e.g. `projects/facilityiq/branches/production/databases/databricks-postgres`.

- [ ] **Step 4: List endpoints and note the endpoint resource path**

```bash
databricks postgres list-endpoints projects/facilityiq/branches/production --profile <PROFILE>
```

Expected: One endpoint (type `ENDPOINT_TYPE_READ_WRITE`). Record the `name` field (full path) and `status.hosts.host` value.

- [ ] **Step 5: Register a Lakebase UC catalog for synced tables**

```bash
databricks postgres create-catalog facilityiq-lakebase \
  --json '{
    "spec": {
      "postgres_database": "databricks_postgres",
      "branch": "projects/facilityiq/branches/production"
    }
  }' --profile <PROFILE>
```

Expected: `{"name": "facilityiq-lakebase", ...}`. Record the catalog name (`facilityiq-lakebase`) — this is the `<LAKEBASE_CATALOG>` used in synced table commands.

---

## Task 2: Create `databricks.yml` bundle

**Files:**
- Create: `databricks.yml`

- [ ] **Step 1: Create the bundle file**

Replace `FILL_IN` values with the resource names from Task 1.

```yaml
# databricks.yml
bundle:
  name: facilityiq

variables:
  lakebase_branch:
    description: Lakebase branch resource name
    default: projects/facilityiq/branches/production
  lakebase_database:
    description: Lakebase database resource name
    default: FILL_IN  # e.g. projects/facilityiq/branches/production/databases/databricks-postgres

resources:
  apps:
    facilityiq_app:
      name: facilityiq
      source_code_path: ./app
      resources:
        - name: postgres
          postgres:
            branch: ${var.lakebase_branch}
            database: ${var.lakebase_database}

  jobs:
    trust_extraction_pipeline:
      name: FacilityIQ Trust Extraction Pipeline
      tasks:
        - task_key: setup
          notebook_task:
            notebook_path: ./notebooks/00_setup.py
            source: GIT
        - task_key: extract
          depends_on:
            - task_key: setup
          notebook_task:
            notebook_path: ./notebooks/01_trust_extraction.py
            source: GIT
        - task_key: validate
          depends_on:
            - task_key: extract
          notebook_task:
            notebook_path: ./notebooks/02_validate_signals.py
            source: GIT

targets:
  dev:
    mode: development
    default: true
  prod:
    mode: production
```

- [ ] **Step 2: Validate bundle parses**

```bash
databricks bundle validate --profile <PROFILE>
```

Expected: YAML parsed without errors, resource names shown.

- [ ] **Step 3: Commit**

```bash
git add databricks.yml
git commit -m "feat: add DABs bundle config"
```

---

## Task 3: Scaffold AppKit app

**Files:**
- Create: `app/` (scaffolded by `databricks apps init`)

- [ ] **Step 1: Run `databricks apps init` from the repo root**

Replace the `--set` values with the branch and database resource names from Task 1.

```bash
databricks apps init \
  --name facilityiq \
  --features lakebase \
  --set "lakebase.postgres.branch=projects/facilityiq/branches/production" \
  --set "lakebase.postgres.database=FILL_IN" \
  --run none \
  --profile <PROFILE>
```

This scaffolds `app/` with `server/server.ts`, `client/src/App.tsx`, `app.yaml`, `package.json`.

- [ ] **Step 2: Install dependencies**

```bash
cd app && npm install
```

Expected: `node_modules/` created, no errors.

- [ ] **Step 3: Verify scaffold runs locally (expect placeholder page)**

```bash
npm run dev
```

Expected: Dev server starts at `http://localhost:3000` (or similar). Open in browser — see AppKit default "Minimal Databricks App" page. Stop with Ctrl+C.

- [ ] **Step 4: Add `server/.env` for local dev (do not commit)**

Get the endpoint host:
```bash
databricks postgres get-endpoint \
  projects/facilityiq/branches/production/endpoints/primary \
  --profile <PROFILE> -o json \
  | python3 -c "import json,sys; d=json.load(sys.stdin); print('host:', d['status']['hosts']['host'])"
```

Get an OAuth token:
```bash
databricks postgres generate-database-credential \
  projects/facilityiq/branches/production/endpoints/primary \
  --profile <PROFILE> -o json \
  | python3 -c "import json,sys; d=json.load(sys.stdin); print('token:', d['token'])"
```

Create `app/server/.env` (already in `.gitignore`):
```dotenv
PGHOST=<host from above>
PGPORT=5432
PGDATABASE=databricks_postgres
PGSSLMODE=require
LAKEBASE_ENDPOINT=projects/facilityiq/branches/production/endpoints/primary
```

- [ ] **Step 5: Commit app scaffold (excluding .env)**

```bash
cd ..  # back to repo root
git add app/
git commit -m "feat: scaffold AppKit app with Lakebase feature"
```

---

## Task 4: Initial deploy (required for SP schema ownership)

**Files:** none

- [ ] **Step 1: Deploy the app to Databricks**

```bash
cd app && databricks apps deploy facilityiq --profile <PROFILE>
```

Expected: Deployment succeeds. App URL printed (e.g. `https://facilityiq-<workspace>.databricksapps.com`). The app's Service Principal is now the owner of any schemas it creates at startup — this is what makes local dev work later.

- [ ] **Step 2: Verify deployed app is accessible**

Open the printed URL in a browser. Expect the AppKit placeholder page (not an error). The `facilityiq` Postgres schema does not exist yet — `server.ts` hasn't been implemented. That's fine.

---

## Task 5: Implement Delta table setup notebook

**Files:**
- Modify: `notebooks/00_setup.py`

- [ ] **Step 1: Implement `00_setup.py`**

Replace `YOUR_CATALOG` with your Unity Catalog catalog name (e.g. `main`). Upload the FDR CSV to a Databricks Volume at `dbfs:/FileStore/facilityiq/facilities.csv` or a UC Volume path before running.

```python
# Databricks notebook — run on a cluster, not locally
# Configure these for your workspace
CATALOG = "YOUR_CATALOG"   # e.g. "main"
SCHEMA = "facilityiq"
CSV_PATH = f"dbfs:/FileStore/facilityiq/facilities.csv"  # upload FDR CSV here

spark.sql(f"USE CATALOG {CATALOG}")
spark.sql(f"CREATE SCHEMA IF NOT EXISTS {SCHEMA}")
spark.sql(f"USE SCHEMA {SCHEMA}")

# Load CSV — infers all 51 FDR columns
raw_df = (spark.read
    .format("csv")
    .option("header", "true")
    .option("inferSchema", "true")
    .option("multiLine", "true")
    .option("escape", '"')
    .load(CSV_PATH))

print(f"CSV columns ({len(raw_df.columns)}): {raw_df.columns}")
print(f"CSV row count: {raw_df.count()}")

# Require facility_id column exists
assert "facility_id" in raw_df.columns, "facility_id column not found — check CSV"

# Write to facilities_raw (overwrite on re-run is safe — append-only in prod)
(raw_df.write
    .format("delta")
    .mode("overwrite")
    .option("overwriteSchema", "true")
    .saveAsTable(f"{CATALOG}.{SCHEMA}.facilities_raw"))

# Enable CDF for synced tables (required for Triggered sync mode)
spark.sql(f"""
  ALTER TABLE {CATALOG}.{SCHEMA}.facilities_raw
  SET TBLPROPERTIES (delta.enableChangeDataFeed = true)
""")

# Create trust signals table
spark.sql(f"""
  CREATE TABLE IF NOT EXISTS {CATALOG}.{SCHEMA}.facilities_trust_signals (
    facility_id    STRING NOT NULL,
    dimension      STRING NOT NULL,
    trust_score    FLOAT,
    confidence_tier STRING NOT NULL,
    evidence_text  STRING,
    source_field   STRING,
    contradiction  BOOLEAN NOT NULL DEFAULT FALSE,
    contradiction_detail STRING,
    extraction_model STRING NOT NULL,
    extracted_at   TIMESTAMP NOT NULL
  )
  USING DELTA
  PARTITIONED BY (dimension)
  TBLPROPERTIES (delta.enableChangeDataFeed = true)
""")

# Create extraction errors table (for failed LLM calls)
spark.sql(f"""
  CREATE TABLE IF NOT EXISTS {CATALOG}.{SCHEMA}.extraction_errors (
    facility_id    STRING,
    error_message  STRING,
    raw_response   STRING,
    failed_at      TIMESTAMP NOT NULL
  )
  USING DELTA
""")

print("=" * 50)
print(f"facilities_raw: {spark.table(f'{CATALOG}.{SCHEMA}.facilities_raw').count()} rows")
print(f"facilities_trust_signals: {spark.table(f'{CATALOG}.{SCHEMA}.facilities_trust_signals').count()} rows")
print("Setup complete.")
```

- [ ] **Step 2: Commit**

```bash
git add notebooks/00_setup.py
git commit -m "feat: implement Delta table setup notebook"
```

---

## Task 6: Implement trust extraction prompt

**Files:**
- Modify: `prompts/trust_extraction.py`

- [ ] **Step 1: Write the prompt template**

```python
# prompts/trust_extraction.py

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
```

- [ ] **Step 2: Commit**

```bash
git add prompts/trust_extraction.py
git commit -m "feat: implement trust extraction prompt template"
```

---

## Task 7: Implement LLM extraction pipeline notebook

**Files:**
- Modify: `notebooks/01_trust_extraction.py`

- [ ] **Step 1: Implement the extraction notebook**

```python
# Databricks notebook — run on a cluster after 00_setup.py
import json
import time
from datetime import datetime, timezone
from pyspark.sql import Row

# Add repo to path so we can import the prompt
import sys
sys.path.insert(0, "/Workspace/Repos/<your-repo-path>")  # update to your workspace path
from prompts.trust_extraction import SYSTEM_PROMPT, build_prompt

CATALOG = "YOUR_CATALOG"   # same as 00_setup.py
SCHEMA = "facilityiq"
MODEL = "databricks-meta-llama-3-1-70b-instruct"
FALLBACK_MODEL = "databricks-dbrx-instruct"
BATCH_SIZE = 50  # facilities per batch before a brief pause

# OpenAI-compatible client pointing at Databricks Foundation Model APIs
from openai import OpenAI

token = (dbutils.notebook.entry_point
    .getDbutils().notebook().getContext().apiToken().get())
workspace_url = spark.conf.get("spark.databricks.workspaceUrl")

client = OpenAI(
    api_key=token,
    base_url=f"https://{workspace_url}/serving-endpoints"
)

def call_llm(prompt: str, model: str = MODEL) -> str:
    """Single LLM call, returns raw content string."""
    response = client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": prompt},
        ],
        temperature=0.0,
        max_tokens=1024,
    )
    return response.choices[0].message.content

def extract_signals(facility_row: dict) -> list[dict]:
    """
    Call LLM for one facility, parse JSON, return list of signal dicts.
    Falls back to FALLBACK_MODEL on rate limit. Returns [] on hard error.
    """
    prompt = build_prompt(facility_row)
    for attempt, model in enumerate([MODEL, FALLBACK_MODEL]):
        try:
            raw = call_llm(prompt, model=model)
            parsed = json.loads(raw)
            signals = parsed["dimensions"]
            now = datetime.now(timezone.utc)
            return [
                {
                    "facility_id": facility_row["facility_id"],
                    "dimension": s["dimension"],
                    "trust_score": float(s["trust_score"]) if s.get("trust_score") is not None else None,
                    "confidence_tier": s["confidence_tier"],
                    "evidence_text": s.get("evidence_text"),
                    "source_field": s.get("source_field"),
                    "contradiction": bool(s.get("contradiction", False)),
                    "contradiction_detail": s.get("contradiction_detail"),
                    "extraction_model": model,
                    "extracted_at": now,
                }
                for s in signals
            ]
        except Exception as e:
            if attempt == 0:
                print(f"  Fallback on {facility_row['facility_id']}: {e}")
                time.sleep(2)
                continue
            # Write error row and return empty
            err_df = spark.createDataFrame([Row(
                facility_id=str(facility_row.get("facility_id", "")),
                error_message=str(e),
                raw_response="",
                failed_at=datetime.now(timezone.utc),
            )])
            err_df.write.format("delta").mode("append").saveAsTable(f"{CATALOG}.{SCHEMA}.extraction_errors")
            return []

# Load facilities that don't yet have signals
existing = spark.sql(f"""
  SELECT DISTINCT facility_id FROM {CATALOG}.{SCHEMA}.facilities_trust_signals
""").toPandas()["facility_id"].tolist()

facilities_df = spark.sql(f"""
  SELECT facility_id, facility_name, facility_type, state,
         description, capability, procedure, equipment,
         capacity, year_established
  FROM {CATALOG}.{SCHEMA}.facilities_raw
  WHERE facility_id NOT IN (SELECT DISTINCT facility_id
    FROM {CATALOG}.{SCHEMA}.facilities_trust_signals)
  ORDER BY
    (CASE WHEN description IS NOT NULL THEN 1 ELSE 0 END +
     CASE WHEN capability IS NOT NULL THEN 1 ELSE 0 END) DESC
  LIMIT 10000
""").toPandas()

print(f"Facilities to process: {len(facilities_df)}")

all_signals = []
for i, row in facilities_df.iterrows():
    signals = extract_signals(row.to_dict())
    all_signals.extend(signals)

    if len(all_signals) >= BATCH_SIZE:
        batch_df = spark.createDataFrame(all_signals)
        batch_df.write.format("delta").mode("append").saveAsTable(
            f"{CATALOG}.{SCHEMA}.facilities_trust_signals")
        print(f"  Wrote batch at facility {i+1}/{len(facilities_df)}")
        all_signals = []
        time.sleep(1)  # brief rate limit pause between batches

# Write any remaining signals
if all_signals:
    batch_df = spark.createDataFrame(all_signals)
    batch_df.write.format("delta").mode("append").saveAsTable(
        f"{CATALOG}.{SCHEMA}.facilities_trust_signals")

total = spark.sql(f"SELECT COUNT(*) as n FROM {CATALOG}.{SCHEMA}.facilities_trust_signals").collect()[0]["n"]
errors = spark.sql(f"SELECT COUNT(*) as n FROM {CATALOG}.{SCHEMA}.extraction_errors").collect()[0]["n"]
print(f"Extraction complete. Signals: {total}, Errors: {errors}")
```

- [ ] **Step 2: Commit**

```bash
git add notebooks/01_trust_extraction.py
git commit -m "feat: implement LLM trust extraction pipeline"
```

---

## Task 8: Run the pipeline on a Databricks cluster

**Files:** none (Databricks UI / CLI)

- [ ] **Step 1: Upload the FDR CSV to DBFS**

In the Databricks workspace UI: Data → Add Data → DBFS → upload `facilities.csv` to `/FileStore/facilityiq/facilities.csv`.

Or via CLI:
```bash
databricks fs cp /path/to/local/facilities.csv \
  dbfs:/FileStore/facilityiq/facilities.csv \
  --profile <PROFILE>
```

- [ ] **Step 2: Import notebooks to workspace (or use Git integration)**

Option A — Git integration (recommended): Connect the repo in Databricks workspace under Repos, then notebooks are accessible directly.

Option B — Import: In workspace UI, import each `.py` file as a notebook.

- [ ] **Step 3: Run `00_setup.py` on a cluster**

Open `00_setup.py` in the workspace, attach to any cluster (or serverless), click Run All.

Expected output:
```
CSV columns (51): [...]
CSV row count: 10000
facilities_raw: 10000 rows
facilities_trust_signals: 0 rows
Setup complete.
```

- [ ] **Step 4: Run `01_trust_extraction.py` on a cluster**

Expected output: Progress logs every 50 facilities. Final line shows signal count (~40,000 expected = 10,000 × 4 dimensions) and 0 errors ideally.

This will take ~30-60 min for 10k facilities. Monitor in the notebook output.

---

## Task 9: Configure Lakebase Synced Tables

**Files:** none (CLI only)

Run after the pipeline has written at least some rows to `facilities_trust_signals`.

- [ ] **Step 1: Create synced table for `facilities_raw`**

Replace `YOUR_CATALOG` and `<PROFILE>` with your values.

```bash
databricks postgres create-synced-table \
  "facilityiq-lakebase.public.facilities" \
  --json '{
    "spec": {
      "source_table_full_name": "YOUR_CATALOG.facilityiq.facilities_raw",
      "primary_key_columns": ["facility_id"],
      "scheduling_policy": "SNAPSHOT",
      "branch": "projects/facilityiq/branches/production",
      "postgres_database": "databricks_postgres",
      "create_database_objects_if_missing": true,
      "new_pipeline_spec": {
        "storage_catalog": "YOUR_CATALOG",
        "storage_schema": "default"
      }
    }
  }' --profile <PROFILE>
```

Expected: Long-running operation; CLI waits. Final status: `ONLINE`.

- [ ] **Step 2: Create synced table for `facilities_trust_signals`**

```bash
databricks postgres create-synced-table \
  "facilityiq-lakebase.public.trust_signals" \
  --json '{
    "spec": {
      "source_table_full_name": "YOUR_CATALOG.facilityiq.facilities_trust_signals",
      "primary_key_columns": ["facility_id", "dimension"],
      "scheduling_policy": "SNAPSHOT",
      "branch": "projects/facilityiq/branches/production",
      "postgres_database": "databricks_postgres",
      "create_database_objects_if_missing": true,
      "new_pipeline_spec": {
        "storage_catalog": "YOUR_CATALOG",
        "storage_schema": "default"
      }
    }
  }' --profile <PROFILE>
```

- [ ] **Step 3: Check both synced tables are ONLINE**

```bash
databricks postgres get-synced-table \
  "synced_tables/facilityiq-lakebase.public.facilities" --profile <PROFILE>

databricks postgres get-synced-table \
  "synced_tables/facilityiq-lakebase.public.trust_signals" --profile <PROFILE>
```

Expected: `status.state: ONLINE` for both.

---

## Task 10: Grant app SP read access to synced tables

**Files:** none (SQL via psql)

- [ ] **Step 1: Get the app's Service Principal client ID**

```bash
databricks apps get facilityiq --profile <PROFILE> -o json \
  | python3 -c "import json,sys; d=json.load(sys.stdin); print(d['service_principal_client_id'])"
```

Record the client ID — this is `<SP_CLIENT_ID>` in the next step.

- [ ] **Step 2: Connect to Lakebase as project owner and run GRANT**

```bash
EP=projects/facilityiq/branches/production/endpoints/primary
HOST=$(databricks postgres get-endpoint $EP --profile <PROFILE> -o json \
  | python3 -c "import json,sys; print(json.load(sys.stdin)['status']['hosts']['host'])")
TOKEN=$(databricks postgres generate-database-credential $EP --profile <PROFILE> -o json \
  | python3 -c "import json,sys; print(json.load(sys.stdin)['token'])")

PGPASSWORD="$TOKEN" psql \
  "host=$HOST user=$(databricks current-user me --profile <PROFILE> -o json | python3 -c \"import json,sys; print(json.load(sys.stdin)['user_name'])\") dbname=databricks_postgres sslmode=require" \
  -c "GRANT USAGE ON SCHEMA public TO \"<SP_CLIENT_ID>\";
      GRANT SELECT ON ALL TABLES IN SCHEMA public TO \"<SP_CLIENT_ID>\";
      ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO \"<SP_CLIENT_ID>\";"
```

Expected: `GRANT` printed three times, no errors.

---

## Task 11: Implement `server/server.ts`

**Files:**
- Modify: `app/server/server.ts`

- [ ] **Step 1: Replace the scaffolded `server.ts` with the full implementation**

```typescript
// app/server/server.ts
import { createApp, server, lakebase } from "@databricks/appkit";
import { z } from "zod";

await createApp({
  plugins: [server(), lakebase()],
  async onPluginsReady(appkit) {
    // Create app-owned schema and user_actions table.
    // SP owns this schema because we deployed first (Task 4).
    await appkit.lakebase.query(`
      CREATE SCHEMA IF NOT EXISTS facilityiq;
      CREATE TABLE IF NOT EXISTS facilityiq.user_actions (
        action_id     TEXT PRIMARY KEY,
        facility_id   TEXT NOT NULL,
        analyst_id    TEXT NOT NULL,
        action_type   TEXT NOT NULL CHECK (action_type IN ('note','override','shortlist','flag')),
        dimension     TEXT,
        content       TEXT,
        override_score REAL,
        created_at    TIMESTAMPTZ DEFAULT NOW(),
        updated_at    TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_ua_facility_analyst
        ON facilityiq.user_actions (facility_id, analyst_id, action_type, updated_at DESC);
    `);

    appkit.server.extend((app) => {

      // GET /api/facilities?q=&page=1&limit=25
      app.get("/api/facilities", async (req, res) => {
        const q = String(req.query.q ?? "");
        const page = Math.max(1, parseInt(String(req.query.page ?? "1")));
        const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? "25"))));
        const offset = (page - 1) * limit;
        const search = `%${q}%`;

        const { rows } = await appkit.lakebase.query(`
          SELECT
            f.facility_id,
            f.facility_name,
            f.state,
            f.facility_type,
            AVG(t.trust_score)::real AS overall_trust_score,
            MAX(CASE WHEN t.contradiction THEN 1 ELSE 0 END)::int AS has_contradiction,
            COUNT(t.dimension)::int AS signal_count
          FROM public.facilities f
          LEFT JOIN public.trust_signals t ON f.facility_id = t.facility_id
          WHERE ($1 = '%%' OR
            f.facility_name ILIKE $1 OR
            f.description ILIKE $1 OR
            f.capability ILIKE $1 OR
            f.state ILIKE $1)
          GROUP BY f.facility_id, f.facility_name, f.state, f.facility_type
          ORDER BY overall_trust_score DESC NULLS LAST
          LIMIT $2 OFFSET $3
        `, [search, limit, offset]);

        res.json(rows);
      });

      // GET /api/facilities/:id
      app.get("/api/facilities/:id", async (req, res) => {
        const { id } = req.params;
        const [fr, sr] = await Promise.all([
          appkit.lakebase.query(
            `SELECT facility_id, facility_name, facility_type, state, district,
                    description, capability, procedure, equipment,
                    capacity, year_established
             FROM public.facilities WHERE facility_id = $1`, [id]),
          appkit.lakebase.query(
            `SELECT * FROM public.trust_signals
             WHERE facility_id = $1 ORDER BY dimension`, [id]),
        ]);
        if (fr.rows.length === 0) { res.status(404).json({ error: "Not found" }); return; }
        res.json({ facility: fr.rows[0], trust_signals: sr.rows });
      });

      // GET /api/facilities/:id/actions?analyst_id=<uuid>
      app.get("/api/facilities/:id/actions", async (req, res) => {
        const { id } = req.params;
        const analyst_id = String(req.query.analyst_id ?? "");
        if (!analyst_id) { res.status(400).json({ error: "analyst_id required" }); return; }

        const { rows } = await appkit.lakebase.query(`
          SELECT DISTINCT ON (action_type, COALESCE(dimension, ''))
            action_id, facility_id, analyst_id, action_type,
            dimension, content, override_score, updated_at
          FROM facilityiq.user_actions
          WHERE facility_id = $1 AND analyst_id = $2
          ORDER BY action_type, COALESCE(dimension, ''), updated_at DESC
        `, [id, analyst_id]);

        res.json(rows);
      });

      // POST /api/facilities/:id/actions
      app.post("/api/facilities/:id/actions", async (req, res) => {
        const { id } = req.params;
        const schema = z.object({
          analyst_id:     z.string().uuid(),
          action_type:    z.enum(["note", "override", "shortlist", "flag"]),
          dimension:      z.string().nullable().optional(),
          content:        z.string().nullable().optional(),
          override_score: z.number().min(0).max(100).nullable().optional(),
        });
        const parsed = schema.safeParse(req.body);
        if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }

        const { analyst_id, action_type, dimension, content, override_score } = parsed.data;
        const action_id = crypto.randomUUID();

        const { rows } = await appkit.lakebase.query(`
          INSERT INTO facilityiq.user_actions
            (action_id, facility_id, analyst_id, action_type, dimension, content, override_score)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          RETURNING *
        `, [action_id, id, analyst_id, action_type, dimension ?? null, content ?? null, override_score ?? null]);

        res.status(201).json(rows[0]);
      });
    });
  },
});
```

- [ ] **Step 2: Verify dev server starts without TypeScript errors**

```bash
cd app && npm run dev
```

Expected: Server starts. Check `http://localhost:3000/api/facilities?q=` in browser — should return `[]` (synced tables may be empty locally; that's expected until you set local `.env`).

Stop with Ctrl+C.

- [ ] **Step 3: Commit**

```bash
cd .. && git add app/server/server.ts
git commit -m "feat: implement API routes (facilities, detail, actions)"
```

---

## Task 12: Add shared TypeScript types

**Files:**
- Create: `app/client/src/types.ts`

- [ ] **Step 1: Create `types.ts`**

```typescript
// app/client/src/types.ts

export interface FacilityListItem {
  facility_id: string;
  facility_name: string;
  state: string | null;
  facility_type: string | null;
  overall_trust_score: string | null; // Postgres returns numerics as strings
  has_contradiction: number;
  signal_count: number;
}

export interface TrustSignal {
  id: number;
  facility_id: string;
  dimension: string;
  trust_score: string | null; // Postgres returns as string
  confidence_tier: string;
  evidence_text: string | null;
  source_field: string | null;
  contradiction: boolean;
  contradiction_detail: string | null;
  extraction_model: string;
  extracted_at: string;
}

export interface FacilityDetail {
  facility: {
    facility_id: string;
    facility_name: string;
    facility_type: string | null;
    state: string | null;
    district: string | null;
    description: string | null;
    capability: string | null;
    procedure: string | null;
    equipment: string | null;
    capacity: number | null;
    year_established: number | null;
  };
  trust_signals: TrustSignal[];
}

export interface UserAction {
  action_id: string;
  facility_id: string;
  analyst_id: string;
  action_type: "note" | "override" | "shortlist" | "flag";
  dimension: string | null;
  content: string | null;
  override_score: number | null;
  updated_at: string;
}

// Helpers
export function parseScore(raw: string | null): number | null {
  if (raw === null || raw === undefined) return null;
  const n = parseFloat(String(raw));
  return isNaN(n) ? null : n;
}

export function scoreToInt(raw: string | null): number | null {
  const s = parseScore(raw);
  if (s === null) return null;
  // trust_score is 0.0–1.0 in Delta; convert to 0–100
  return s <= 1 ? Math.round(s * 100) : Math.round(s);
}

export function trustColor(score: number | null): string {
  if (score === null) return "rgba(255,255,255,0.3)";
  if (score >= 70) return "#4ade80";
  if (score >= 40) return "#fbbf24";
  return "#f87171";
}

export function trustLabel(score: number | null): string {
  if (score === null) return "—";
  if (score >= 70) return "HIGH";
  if (score >= 40) return "MED";
  return "LOW";
}
```

- [ ] **Step 2: Commit**

```bash
git add app/client/src/types.ts
git commit -m "feat: add shared TypeScript types and score helpers"
```

---

## Task 13: Implement `App.tsx` split-panel shell

**Files:**
- Modify: `app/client/src/App.tsx`

- [ ] **Step 1: Replace `App.tsx` with the split-panel layout**

```tsx
// app/client/src/App.tsx
import { useState, useEffect } from "react";
import type { FacilityDetail } from "./types";
import SearchPanel from "./components/SearchPanel";
import ScoreCard from "./components/ScoreCard";

// analyst_id is generated once and stored in localStorage
function getAnalystId(): string {
  const stored = localStorage.getItem("facilityiq_analyst_id");
  if (stored) return stored;
  const id = crypto.randomUUID();
  localStorage.setItem("facilityiq_analyst_id", id);
  return id;
}

export const ANALYST_ID = getAnalystId();

export default function App() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<FacilityDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  useEffect(() => {
    if (!selectedId) { setDetail(null); return; }
    setLoadingDetail(true);
    fetch(`/api/facilities/${selectedId}`)
      .then((r) => r.json())
      .then((data: FacilityDetail) => { setDetail(data); setLoadingDetail(false); })
      .catch(() => setLoadingDetail(false));
  }, [selectedId]);

  return (
    <div style={{
      display: "flex", height: "100vh", overflow: "hidden",
      background: "#0B2026", color: "white",
      fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif",
    }}>
      {/* Left panel: search + list */}
      <div style={{
        width: 360, minWidth: 360, flexShrink: 0,
        borderRight: "1px solid rgba(255,255,255,0.06)",
        display: "flex", flexDirection: "column", overflow: "hidden",
      }}>
        <SearchPanel onSelect={setSelectedId} selectedId={selectedId} />
      </div>

      {/* Right panel: scorecard */}
      <div style={{ flex: 1, overflowY: "auto", background: "#0B2026" }}>
        {loadingDetail ? (
          <div style={{ padding: 32, color: "rgba(255,255,255,0.3)", fontSize: 13 }}>Loading...</div>
        ) : detail ? (
          <ScoreCard detail={detail} analystId={ANALYST_ID} />
        ) : (
          <div style={{
            display: "flex", flexDirection: "column", alignItems: "center",
            justifyContent: "center", height: "100%", gap: 8,
            color: "rgba(255,255,255,0.2)",
          }}>
            <div style={{ fontSize: 28 }}>⊞</div>
            <div style={{ fontSize: 12 }}>Select a facility to view its trust scorecard</div>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create `app/client/src/lib/analyst.ts`**

`ANALYST_ID` lives here (not in `App.tsx`) so it can be imported by both `App.tsx` and `SearchPanel.tsx` without a circular dependency.

```typescript
// app/client/src/lib/analyst.ts
function getAnalystId(): string {
  const stored = localStorage.getItem("facilityiq_analyst_id");
  if (stored) return stored;
  const id = crypto.randomUUID();
  localStorage.setItem("facilityiq_analyst_id", id);
  return id;
}
export const ANALYST_ID = getAnalystId();
```

Update `App.tsx` to import from this module instead of defining it inline. Replace the `getAnalystId` function and `ANALYST_ID` declaration at the top of `App.tsx` with:

```tsx
import { ANALYST_ID } from "./lib/analyst";
```

- [ ] **Step 3: Create `app/client/src/components/` directory**

```bash
mkdir -p app/client/src/components app/client/src/lib
```

- [ ] **Step 4: Commit**

```bash
git add app/client/src/App.tsx app/client/src/lib/analyst.ts app/client/src/components/
git commit -m "feat: implement split-panel App shell with analyst ID module"
```

---

## Task 14: Implement `SearchPanel.tsx` and `FacilityCard.tsx`

**Files:**
- Create: `app/client/src/components/SearchPanel.tsx`
- Create: `app/client/src/components/FacilityCard.tsx`

- [ ] **Step 1: Create `FacilityCard.tsx`**

```tsx
// app/client/src/components/FacilityCard.tsx
import type { FacilityListItem } from "../types";
import { scoreToInt, trustColor, trustLabel } from "../types";

interface Props {
  facility: FacilityListItem;
  selected: boolean;
  onClick: () => void;
}

export default function FacilityCard({ facility, selected, onClick }: Props) {
  const score = scoreToInt(facility.overall_trust_score);
  const color = trustColor(score);

  return (
    <div
      onClick={onClick}
      style={{
        padding: "10px 14px",
        borderLeft: `2px solid ${selected ? "#FF3621" : "transparent"}`,
        background: selected ? "rgba(255,255,255,0.04)" : "transparent",
        borderBottom: "1px solid rgba(255,255,255,0.04)",
        cursor: "pointer",
        transition: "background 0.1s",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div style={{ flex: 1, marginRight: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 2, lineHeight: 1.3 }}>
            {facility.facility_name}
          </div>
          <div style={{ fontSize: 9, color: "rgba(255,255,255,0.35)", letterSpacing: "0.3px" }}>
            {[facility.state, facility.facility_type].filter(Boolean).join(" · ")}
          </div>
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color, lineHeight: 1 }}>
            {score ?? "—"}
          </div>
          <div style={{ fontSize: 8, color, fontWeight: 600, letterSpacing: "0.3px" }}>
            {trustLabel(score)}
          </div>
        </div>
      </div>
      {facility.has_contradiction === 1 && (
        <div style={{ fontSize: 8, color: "#FF3621", marginTop: 3, fontWeight: 600 }}>
          ⚠ CONTRADICTION
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create `SearchPanel.tsx`**

```tsx
// app/client/src/components/SearchPanel.tsx
import { useState, useEffect, useRef } from "react";
import type { FacilityListItem } from "../types";
import FacilityCard from "./FacilityCard";

interface Props {
  onSelect: (id: string) => void;
  selectedId: string | null;
}

export default function SearchPanel({ onSelect, selectedId }: Props) {
  const [query, setQuery] = useState("");
  const [facilities, setFacilities] = useState<FacilityListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function fetchFacilities(q: string) {
    setLoading(true);
    fetch(`/api/facilities?q=${encodeURIComponent(q)}&limit=25`)
      .then((r) => r.json())
      .then((data: FacilityListItem[]) => { setFacilities(data); setLoading(false); })
      .catch(() => setLoading(false));
  }

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchFacilities(query), 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query]);

  // Load initial results on mount
  useEffect(() => { fetchFacilities(""); }, []);

  return (
    <>
      {/* App header */}
      <div style={{
        background: "#081519", padding: "10px 16px",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        display: "flex", alignItems: "center", gap: 8, flexShrink: 0,
      }}>
        <div style={{ width: 4, height: 16, background: "#FF3621", borderRadius: 1 }} />
        <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: "1.5px" }}>FACILITYIQ</span>
        <span style={{ fontSize: 9, color: "rgba(255,255,255,0.25)", marginLeft: "auto" }}>
          TRUST DESK · INDIA
        </span>
      </div>

      {/* Search input */}
      <div style={{ padding: "10px 12px", borderBottom: "1px solid rgba(255,255,255,0.06)", flexShrink: 0 }}>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search facilities, specialties, states..."
          style={{
            width: "100%", boxSizing: "border-box",
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 6, padding: "7px 10px",
            color: "white", fontSize: 12, outline: "none",
          }}
        />
      </div>

      {/* Results count */}
      <div style={{
        padding: "5px 14px", fontSize: 9,
        color: "rgba(255,255,255,0.25)", letterSpacing: "0.5px", flexShrink: 0,
      }}>
        {loading ? "Searching..." : `${facilities.length} results`}
      </div>

      {/* Scrollable list */}
      <div style={{ flex: 1, overflowY: "auto" }}>
        {facilities.map((f) => (
          <FacilityCard
            key={f.facility_id}
            facility={f}
            selected={f.facility_id === selectedId}
            onClick={() => onSelect(f.facility_id)}
          />
        ))}
        {!loading && facilities.length === 0 && (
          <div style={{ padding: 16, fontSize: 11, color: "rgba(255,255,255,0.25)" }}>
            No results
          </div>
        )}
      </div>
    </>
  );
}
```

- [ ] **Step 3: Verify locally**

```bash
cd app && npm run dev
```

Open `http://localhost:3000`. Expect: FACILITYIQ header, search input, facility list (if local `.env` is configured with real Postgres credentials). Stop with Ctrl+C.

- [ ] **Step 4: Commit**

```bash
cd .. && git add app/client/src/components/SearchPanel.tsx app/client/src/components/FacilityCard.tsx
git commit -m "feat: implement SearchPanel and FacilityCard components"
```

---

## Task 15: Implement basic `ScoreCard.tsx`

**Files:**
- Create: `app/client/src/components/ScoreCard.tsx`

- [ ] **Step 1: Create `ScoreCard.tsx`**

```tsx
// app/client/src/components/ScoreCard.tsx
import type { FacilityDetail, TrustSignal } from "../types";
import { scoreToInt, trustColor, trustLabel, parseScore } from "../types";

interface Props {
  detail: FacilityDetail;
  analystId: string;
}

function overallScore(signals: TrustSignal[]): number | null {
  const valid = signals
    .filter((s) => s.confidence_tier !== "insufficient_data" && s.trust_score !== null)
    .map((s) => parseScore(s.trust_score) as number);
  if (valid.length === 0) return null;
  return Math.round((valid.reduce((a, b) => a + b, 0) / valid.length) * 100);
}

export default function ScoreCard({ detail }: Props) {
  const { facility, trust_signals } = detail;
  const score = overallScore(trust_signals);
  const color = trustColor(score);
  const hasContradiction = trust_signals.some((s) => s.contradiction);

  return (
    <div style={{ padding: "24px 28px" }}>
      {/* Facility header */}
      <div style={{
        display: "flex", justifyContent: "space-between",
        alignItems: "flex-start", marginBottom: 20,
        paddingBottom: 16, borderBottom: "1px solid rgba(255,255,255,0.06)",
      }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0, marginBottom: 4 }}>
            {facility.facility_name}
          </h1>
          <p style={{
            fontSize: 10, color: "rgba(255,255,255,0.35)", margin: 0,
            letterSpacing: "0.5px", textTransform: "uppercase",
          }}>
            {[facility.state, facility.facility_type, facility.district]
              .filter(Boolean).join(" · ")}
          </p>
        </div>
        <div style={{ textAlign: "right", flexShrink: 0, marginLeft: 16 }}>
          <div style={{ fontSize: 40, fontWeight: 800, lineHeight: 1, color: "white" }}>
            {score ?? "—"}
          </div>
          <div style={{ fontSize: 9, fontWeight: 600, color, letterSpacing: "0.5px" }}>
            OVERALL · {score !== null ? trustLabel(score) : "INSUFFICIENT DATA"}
          </div>
        </div>
      </div>

      {/* Contradiction banner */}
      {hasContradiction && (
        <div style={{
          background: "rgba(255,54,33,0.10)",
          border: "1px solid rgba(255,54,33,0.25)",
          borderRadius: 6, padding: "10px 14px", marginBottom: 16,
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#FF3621", marginBottom: 2 }}>
            ⚠ CONTRADICTION DETECTED
          </div>
          <div style={{ fontSize: 9, color: "rgba(255,255,255,0.45)" }}>
            One or more structured fields conflict with free text. Expand a dimension to see details.
          </div>
        </div>
      )}

      {/* Dimension label */}
      <div style={{
        fontSize: 9, fontWeight: 700, color: "rgba(255,255,255,0.3)",
        letterSpacing: "0.5px", textTransform: "uppercase", marginBottom: 10,
      }}>
        Trust Dimensions
      </div>

      {/* Dimension rows */}
      {trust_signals.map((signal) => {
        const dimScore = scoreToInt(signal.trust_score);
        const dimColor = trustColor(dimScore);
        const isInsufficient = signal.confidence_tier === "insufficient_data";

        return (
          <div key={signal.dimension} style={{
            border: `1px solid ${signal.contradiction ? "rgba(255,54,33,0.25)" : "rgba(255,255,255,0.07)"}`,
            borderRadius: 6, padding: "10px 14px", marginBottom: 8,
          }}>
            <div style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              marginBottom: isInsufficient ? 0 : 8,
            }}>
              <span style={{
                fontSize: 10, fontWeight: 600, letterSpacing: "0.5px",
                textTransform: "uppercase", color: "rgba(255,255,255,0.7)",
              }}>
                {signal.dimension}
                {signal.contradiction && (
                  <span style={{ color: "#FF3621", marginLeft: 6, fontSize: 10 }}>⚠</span>
                )}
              </span>
              {isInsufficient ? (
                <span style={{
                  fontSize: 9, background: "rgba(251,191,36,0.12)",
                  color: "#fbbf24", padding: "2px 8px", borderRadius: 4, fontWeight: 600,
                }}>
                  INSUFFICIENT DATA
                </span>
              ) : (
                <span style={{ fontSize: 12, fontWeight: 700, color: dimColor }}>
                  {dimScore} · {trustLabel(dimScore)}
                </span>
              )}
            </div>
            {!isInsufficient && dimScore !== null && (
              <div style={{ height: 4, background: "rgba(255,255,255,0.06)", borderRadius: 2 }}>
                <div style={{
                  height: "100%", width: `${dimScore}%`,
                  background: dimColor, borderRadius: 2,
                  transition: "width 0.3s ease",
                }} />
              </div>
            )}
            {isInsufficient && (
              <div style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", marginTop: 4 }}>
                {signal.evidence_text}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Verify in browser**

```bash
cd app && npm run dev
```

Click a facility in the list. Right panel should show the facility name, overall score (large white number), and four dimension rows with color-coded bars. Stop with Ctrl+C.

- [ ] **Step 3: Update smoke test heading**

Edit `app/tests/smoke.spec.ts` — find the heading assertion and update it to match the app title:

```typescript
// Replace whatever heading check exists with:
await expect(page.locator('text=FACILITYIQ')).toBeVisible();
```

- [ ] **Step 4: Run `databricks apps validate`**

```bash
databricks apps validate --profile <PROFILE>
```

Expected: Playwright smoke test passes. If it fails on the heading, adjust the selector to match exactly what's rendered.

- [ ] **Step 5: Commit**

```bash
cd .. && git add app/client/src/components/ScoreCard.tsx app/tests/
git commit -m "feat: implement basic ScoreCard with trust dimension bars"
```

---

## Task 16: Deploy and verify

**Files:** none

- [ ] **Step 1: Deploy the app**

```bash
cd app && databricks apps deploy facilityiq --profile <PROFILE>
```

Expected: Deployment succeeds. App URL printed.

- [ ] **Step 2: Verify deployed app**

Open the app URL in a browser. Verify:
- FACILITYIQ header visible with red accent bar
- Search input works — typing returns facilities from the synced Postgres table
- Clicking a facility shows the scorecard in the right panel
- Trust scores are color-coded (green ≥70, amber 40–69, red <40)
- INSUFFICIENT DATA badge appears on the completeness dimension
- CONTRADICTION badge appears on facilities with `has_contradiction = 1`

- [ ] **Step 3: Check app logs if anything looks wrong**

```bash
databricks apps logs facilityiq --profile <PROFILE>
```

- [ ] **Step 4: Commit any fixes, redeploy**

```bash
git add -p  # stage only what changed
git commit -m "fix: <describe what was fixed>"
databricks apps deploy facilityiq --profile <PROFILE>
```

---

**MVP complete.** The app is deployed with facility search, trust score list, and a scorecard with dimension bars. Proceed to the full plan (`2026-06-15-facilityiq-full.md`) to add expandable evidence panels, contradiction details, analyst workbench, and filters.
