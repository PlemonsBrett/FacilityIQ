"""Builds the facilities_email_outreach gold table and friendly outreach drafts.

The table is keyed by email and captures the state of the data around each
address (which facilities use it, whether it is shared, their quality scores,
and outstanding data issues). The frontend uses this to draft an outreach email
the app user can review and send; the recipient confirms or corrects their data.

Table creation, query, and write live here; draft text is generated per-request
by build_email_draft() because the draft needs the logged-in user's name.
"""

from pathlib import Path

_SQL_PATH = Path(__file__).parent.parent / "sql" / "gold" / "email_outreach.sql"

SOURCE_TABLE = "databricks_virtue_foundation_dataset_dais_2026.virtue_foundation_dataset.facilities"


def table_name(catalog: str, schema: str) -> str:
    return f"{catalog}.{schema}.facilities_email_outreach"


def quality_table_name(catalog: str, schema: str) -> str:
    return f"{catalog}.{schema}.facilities_quality_scores"


def create_email_outreach_table(spark, catalog: str, schema: str) -> None:
    """Idempotent. email is the informational primary key (Unity Catalog)."""
    spark.sql(f"""
        CREATE TABLE IF NOT EXISTS {table_name(catalog, schema)} (
            email STRING NOT NULL,
            facility_count INT,
            facility_ids ARRAY<STRING>,
            facility_names ARRAY<STRING>,
            states ARRAY<STRING>,
            cities ARRAY<STRING>,
            is_shared BOOLEAN,
            min_quality_score INT,
            avg_quality_score INT,
            issues ARRAY<STRING>,
            computed_at TIMESTAMP,
            CONSTRAINT facilities_email_outreach_pk PRIMARY KEY (email) RELY
        )
        USING DELTA
    """)


def build_email_outreach(spark, catalog: str, schema: str):
    """Run the gold query and return the resulting DataFrame (one row per email)."""
    sql = _SQL_PATH.read_text().rstrip().rstrip(";").format(
        SOURCE_TABLE=SOURCE_TABLE,
        QUALITY_TABLE=quality_table_name(catalog, schema),
    )
    return spark.sql(sql)


def write_email_outreach(spark, catalog: str, schema: str) -> int:
    """Overwrite the gold table from the query. Returns rows written."""
    df = build_email_outreach(spark, catalog, schema)
    df.write.format("delta").mode("overwrite").option("overwriteSchema", "true") \
        .saveAsTable(table_name(catalog, schema))
    return spark.table(table_name(catalog, schema)).count()


def build_email_draft(user_name: str, record: dict) -> str:
    """
    Generate a friendly outreach draft for one email record.

    record is a row from facilities_email_outreach (dict-like) with keys:
    email, facility_names, states, cities, issues.
    """
    names = list(record.get("facility_names") or [])
    states = [s for s in (record.get("states") or []) if s]
    issues = list(record.get("issues") or [])

    facility_line = names[0] if names else "your facility"
    if len(names) > 1:
        facility_line = f"{len(names)} facilities including {names[0]}"
    location = f" in {states[0]}" if states else ""

    draft = (
        f"Hello,\n\n"
        f"This is {user_name} and I'm reaching out for assistance with our project "
        f'"The Virtue Foundation," a healthcare intelligence initiative that maps '
        f"facilities so medical volunteers can reach the communities that need them most.\n\n"
        f"We have records for {facility_line}{location} associated with this email "
        f"address, and we'd be grateful if you could help us confirm a few details so "
        f"that planners and volunteers are directed to the right place."
    )

    if issues:
        bullet_lines = "\n".join(f"  - {issue}" for issue in issues)
        draft += (
            f"\n\nIn particular, our records show the following items that may need "
            f"verification:\n{bullet_lines}"
        )

    draft += (
        f"\n\nIf you could reply to confirm or correct this information, it would make a "
        f"real difference to the patients and volunteers we serve. Thank you so much for "
        f"your time and for the work you do.\n\n"
        f"Warm regards,\n"
        f"{user_name}\n"
        f"The Virtue Foundation"
    )
    return draft
