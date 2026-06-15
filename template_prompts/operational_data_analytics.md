# About DevHub

This prompt originates from DevHub — the developer hub for building data apps and AI agents on the Databricks developer stack: **Lakebase** (managed serverless Postgres), **Agent Bricks** (production AI agents), **Databricks Apps** (secure serverless hosting for internal apps), and **AppKit** (the open-source TypeScript SDK that wires them together).

- Website: https://developers.databricks.com
- GitHub: https://github.com/databricks/devhub
- Report issues: https://github.com/databricks/devhub/issues

A complete index of every DevHub doc and template is at https://developers.databricks.com/llms.txt — fetch it whenever you need a template, recipe, or doc beyond what is included in this prompt. If a step in this prompt is unclear, the matching DevHub page almost certainly clarifies it.

---

# Working with DevHub prompts

Follow these rules every time you act on a DevHub prompt.

## Read first, then act

- Read the entire prompt before executing any steps. DevHub prompts often include overlapping setup commands across sections; later sections frequently contain more complete versions of an earlier step.
- Do not infer or assume when provisioning Databricks resources (catalogs, schemas, Lakebase instances, Genie spaces, serving endpoints). Ask the user whether to create new resources or reuse existing ones.
- If you run into trouble, fetch additional templates and docs from https://developers.databricks.com (the index lives at https://developers.databricks.com/llms.txt). For example, if Genie setup fails, fetch the Genie docs and templates instead of guessing.

## Implementation guidance

The template below describes **what to build**, not how to build it. Your installed Databricks agent skills contain all implementation patterns, code examples, CLI commands, and configuration needed. Use them to implement the template. Before continuing, always run `databricks aitools version`. **If skills are missing or it reports a newer release: STOP. Install skills if missing or update if outdated before proceeding — do not work around a missing or stale install.** A stale `.agents/skills/` copy silently shadows a fresh global install, so always check both scopes.

## Engage the user in a conversation

Unless the user has explicitly told you to "just do it", treat every DevHub prompt as the start of a conversation, not an unattended script. The user knows their domain best; DevHub knows the Databricks stack. Both are required to build a successful system.

Follow these rules every time you ask a question:

1. **One question at a time.** Never ask multiple questions in a single message.
2. **Always include a final option for "Not sure — help me decide"** so the user is never stuck.
3. **Prefer interactive multiple-choice UI when available.** Before asking your first question, check your available tools for any structured-question or multiple-choice capability. If one exists, **always** use it instead of plain text. Known tools by environment:
   - **Cursor**: use the `AskQuestion` tool.
   - **Claude Code**: use the `MultipleChoice` tool (from the `mcp__desktopCommander` server, or built-in depending on setup).
   - **Other agents**: look for any tool whose description mentions "multiple choice", "question", "ask", "poll", or "select".
4. **Fall back to a formatted text list** only when you have confirmed no interactive tool is available. Use markdown list syntax so each option renders on its own line, and tell the user they can reply with just the letter or number.

### Example: Cursor (`AskQuestion` tool)

```
AskQuestion({
  questions: [{
    id: "app-type",
    prompt: "What kind of app would you like to build?",
    options: [
      { id: "dashboard", label: "A data dashboard" },
      { id: "chatbot", label: "An AI-powered chatbot" },
      { id: "crud", label: "A CRUD app with Lakebase" },
      { id: "other", label: "Something else (describe it)" },
      { id: "unsure", label: "Not sure — help me decide" }
    ]
  }]
})
```

### Example: plain text fallback

Only use this when no interactive tool is available:

What kind of app would you like to build? Reply with the letter to choose:

- a) A data dashboard
- b) An AI-powered chatbot
- c) A CRUD app with Lakebase
- d) Something else (describe it)
- e) Not sure — help me decide

## Default workflow

Unless instructed otherwise, follow this workflow:

1. Understand the user's intent and goals (see the intent block below for what the user just copied).
2. Verify the local Databricks dev environment (the "Verify your local Databricks dev environment" block in the intent section).
3. Ask follow-up questions where needed and walk the user through the build step by step.
4. Build the app or agent.
5. Make it look great (see "Make it look great" below).
6. Run and test locally.
7. Deploy to production. **Ask the user for confirmation first, unless they have already given an explicit go-ahead.**
8. If deployed, run and test deployed app (see "Run and test deployed app" below).

## Make it look great

The default templates that AppKit provides are intentionally minimal — a starting point, not a finished product. **Do not stop there.** Use the user's feature requests to redesign the routes, page hierarchy, and visuals from first principles, and make the UI look great _before_ asking the user to run and test locally. Showing the user something polished early changes the conversation.

Unless the user has specified a design preference, use these defaults:

- shadcn/ui components on top of Tailwind CSS.
- Clean hierarchy with modern spacing — not too many stacked cards.
- Modern, minimal design language.
- Databricks brand palette: `#FF3621`, `#0B2026`, `#EEEDE9`, `#F9F7F4`.

If an existing codebase has its own design system, follow that system instead.

## Run and test deployed app

- If the `databricks-apps` skill is available, follow its `agent-browser` reference to load the deployed app and test it; otherwise install `agent-browser` (`npm install -g agent-browser`) and drive the deployed URL with it directly.
- If anything is off, fix it.
- Inspect the app logs via the Databricks CLI and fix any errors.
- Redeploy and repeat until all issues are resolved.
- Report back to the user once the deployed app is verified.

## When you run into issues

Use the GitHub CLI (if available) or generate a copy-pastable error report for the user to file at https://github.com/databricks/devhub/issues. Greatly appreciated if you first check for an existing matching open issue and comment "+1" rather than opening a duplicate.

---

# What the user just did

The user copied the prompt for a DevHub **cookbook** — **Operational Data Analytics** (https://developers.databricks.com/templates/operational-data-analytics).

A cookbook is a composed pattern that builds an **archetype application** end-to-end on Databricks from multiple recipe goals. The cookbook goal below describes the overall app and its components. Your installed Databricks agent skills contain the implementation patterns for each component.

Use the cookbook goal for scope and architecture; use the skills for implementation.

Your job in this conversation is to:

1. Clarify the user's **goal for this archetype** — production app, learning project, or demo.
2. Verify the local Databricks dev environment is ready (block below).
3. Use the component goals to understand scope, then **use your installed Databricks agent skills** to implement each component step by step.

## Step 1 — Clarify intent before touching code

Ask **one** question, ideally with a multiple-choice tool:

- **New project from scratch** following this archetype end-to-end. → Run the local-bootstrap below, then scaffold a fresh project and work through each component.
- **Add this archetype to an existing Databricks app**. → Read the user's existing project first; introduce the archetype's pieces incrementally without breaking what's there.
- **Just learning the pattern**: the user wants to understand the archetype before deciding to build it. → Walk through the component goals as a guided tour; do not execute commands.
- **Not sure — help me decide**: ask follow-ups about the user's end goal (who uses the app, what data, deployed where) and map back to one of the above.

## Step 2 — Pin down archetype-specific decisions

Cookbooks compose multiple Databricks primitives — Lakebase, Agent Bricks, Model Serving, Genie, Lakeflow Pipelines depending on the cookbook. Before generating code, ask:

- For each primitive the cookbook needs: **create new** or **reuse existing**? Never assume — Lakebase instances, Model Serving endpoints, and Genie spaces all cost money and take minutes to provision.
- Which **Databricks profile** to target? (`databricks auth profiles`.)
- **Data**: real data from the user's Unity Catalog, or seed data to start and swap later?
- **Scope today**: ship the full archetype, or stop after a working slice (e.g. just the Lakebase + UI layer, no AI yet)?

## Step 3 — Verify the local Databricks dev environment

Cookbooks run multiple CLI and AppKit commands across their components; a misconfigured CLI profile fails immediately and looks like a cookbook bug. **Walk the user through the local-bootstrap block below first**, even if they say their environment is already set up.

The cookbook goal and component goals are attached after the local-bootstrap block.

---

# Verify your local Databricks dev environment

A working Databricks CLI profile is the prerequisite for every step that follows. The goal below describes what a ready environment looks like. Use your installed Databricks agent skills to verify and set up the environment — _even if the user says their environment is already set up_.

When done, you will have:

- Databricks CLI `1.0.0+` installed and on `PATH`
- An authenticated CLI profile (`databricks auth profiles` shows `Valid: YES`)
- A successful smoke test (`databricks current-user me` returns your identity)

---

# The cookbook the user copied

The cookbook goal is below — it describes what the user wants to build. Once the local-bootstrap above passes and the intent questions are answered, use your installed Databricks agent skills to implement it.

---
title: "Operational Data Analytics"
url: https://developers.databricks.com/templates/operational-data-analytics
summary: "End-to-end setup for analyzing operational database data in the lakehouse: Unity Catalog with external storage, Lakebase provisioning, Lakebase Change Data Feed (CDF) replication, and a medallion architecture pipeline with silver and gold layers."
---

An end-to-end operational data analytics pipeline: data flows from an OLTP database (Lakebase Postgres) through CDC replication into Unity Catalog, gets transformed through a medallion architecture (bronze/silver/gold layers), and is ready for dashboards and downstream consumers.

### Components

1. **Unity Catalog Setup** — configure Unity Catalog with external S3 storage for your destination catalog and schema.
2. **Create a Lakebase Instance** — provision a managed Postgres project as the OLTP source.
3. **Lakebase Change Data Feed (CDF)** — enable continuous replication from Lakebase tables to Unity Catalog Delta history tables.
4. **Medallion Architecture from CDC** — build silver (current-state) and gold (analytical) layers from the CDC history tables using Lakeflow Declarative Pipelines.

## Component: Set Up Unity Catalog with External Storage

When done, you will have:

- An IAM role granting Databricks access to your S3 bucket
- A storage credential and external location registered in Unity Catalog
- A Unity Catalog catalog using your external S3 bucket as its storage root
- Infrastructure ready for Sync Tables, cross-account access, or custom lifecycle policies

## Component: Create a Lakebase Instance

When done, you will have:

- A managed Postgres cluster running in your Databricks workspace
- A production branch with an active endpoint and default database
- Connection values (host, endpoint path, database path, database name) ready for use in other Lakebase recipes

## Component: Lakebase Change Data Feed: Sync Lakebase to Unity Catalog (Autoscaling)

When done, you will have:

- Delta history tables in Unity Catalog with full change tracking for every insert, update, and delete
- Continuous CDC replication from Lakebase Autoscaling Postgres to the lakehouse with no external compute
- Operational data queryable in Spark SQL, notebooks, BI tools, and downstream pipelines

## Component: Sync Tables: Unity Catalog to Lakebase (Autoscaling)

When done, you will have:

- A synced table in Unity Catalog tracking the replication pipeline
- A read-only Postgres table in Lakebase queryable with sub-10ms latency from any standard Postgres client
- A managed Lakeflow pipeline keeping the data in sync via snapshot, triggered, or continuous mode

## Component: Medallion Architecture from CDC History Tables

When done, you will have:

- A bronze layer provided by the upstream Lakebase Change Data Feed history tables (input to this recipe)
- A silver layer with deduplicated, current-state materialized views for each entity
- A gold layer with business aggregations and metrics as materialized views
- A scheduled Lakeflow Declarative Pipeline refreshing silver and gold layers incrementally
- All layers queryable as Unity Catalog tables via SQL, Spark, BI tools, and Genie
