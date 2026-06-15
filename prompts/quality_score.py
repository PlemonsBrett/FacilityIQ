"""Computes the per-facility Quality Score and writes it to the gold table
facilities_quality_scores.

Per docs/Data_Validation_Checks.md, Quality Score is SEPARATE from Trust Score:
  - Trust Score (facilities_trust_signals) → are the facility's claims evidence-supported?
  - Quality Score (this table)             → does the record itself have integrity problems?

Each .sql file in sql/data_quality/ is the source of truth and must return:
  (unique_id, penalty_points, issue_summary)

Scoring: start at 100, subtract the worst penalty per check type, floor at 0.
Tiers follow Data_Validation_Checks.md §2.
"""

from pathlib import Path

from pyspark.sql.types import (
    StructType,
    StructField,
    StringType,
    IntegerType,
    ArrayType,
    TimestampType,
)

_SQL_DIR = Path(__file__).parent.parent / "sql" / "data_quality"

QUALITY_SCORES_SCHEMA = StructType([
    StructField("facility_id", StringType(), False),
    StructField("quality_score", IntegerType(), False),
    StructField("quality_tier", StringType(), False),
    StructField("total_penalty_points", IntegerType(), False),
    StructField("issues", ArrayType(StringType()), True),
    StructField("computed_at", TimestampType(), False),
])


def quality_tier(score: int) -> str:
    if score >= 85:
        return "high_quality"
    if score >= 65:
        return "needs_review"
    if score >= 40:
        return "low_quality"
    return "critical_issue"


def build_quality_scores(spark) -> dict[str, dict]:
    """
    Read every .sql file in sql/data_quality/, aggregate the worst penalty per
    check type and collect human-readable issues, then combine across files.

    Returns {facility_id: {"total_penalty_points": int, "issues": [str]}}.
    A file that doesn't return (unique_id, penalty_points, issue_summary) is
    skipped with a warning.
    """
    agg: dict[str, dict] = {}
    for path in sorted(_SQL_DIR.glob("*.sql")):
        sql = path.read_text().rstrip().rstrip(";")
        try:
            # MAX penalty within a file = worst instance of that check type for the
            # facility; collect_set gathers the distinct human-readable issues.
            wrapped = f"""
                SELECT
                  unique_id,
                  MAX(penalty_points) AS penalty_points,
                  collect_set(issue_summary) AS issues
                FROM ({sql})
                GROUP BY unique_id
            """
            rows = spark.sql(wrapped).collect()
            for row in rows:
                fid = row["unique_id"]
                entry = agg.setdefault(fid, {"total_penalty_points": 0, "issues": []})
                entry["total_penalty_points"] += int(row["penalty_points"] or 0)
                entry["issues"].extend(i for i in (row["issues"] or []) if i)
            print(f"  {path.name}: {len(rows)} facilities flagged")
        except Exception as e:
            print(f"  {path.name}: skipped — {e}")
    return agg


def table_name(catalog: str, schema: str) -> str:
    return f"{catalog}.{schema}.facilities_quality_scores"


def create_quality_scores_table(spark, catalog: str, schema: str) -> None:
    """Idempotent. Gold table — full overwrite each run, no partitioning needed."""
    spark.sql(f"""
        CREATE TABLE IF NOT EXISTS {table_name(catalog, schema)} (
            facility_id STRING NOT NULL,
            quality_score INT NOT NULL,
            quality_tier STRING NOT NULL,
            total_penalty_points INT NOT NULL,
            issues ARRAY<STRING>,
            computed_at TIMESTAMP NOT NULL
        )
        USING DELTA
    """)


def write_quality_scores(spark, scores: dict[str, dict], catalog: str, schema: str, computed_at) -> int:
    """
    Overwrite the gold table with one row per flagged facility.
    `scores` is the output of build_quality_scores(). Returns rows written.
    """
    rows = []
    for fid, data in scores.items():
        penalty = int(data["total_penalty_points"])
        score = max(0, 100 - penalty)
        rows.append({
            "facility_id": fid,
            "quality_score": score,
            "quality_tier": quality_tier(score),
            "total_penalty_points": penalty,
            "issues": sorted(set(data["issues"])),
            "computed_at": computed_at,
        })
    if not rows:
        return 0
    df = spark.createDataFrame(rows, schema=QUALITY_SCORES_SCHEMA)
    df.write.format("delta").mode("overwrite").option("overwriteSchema", "true") \
        .saveAsTable(table_name(catalog, schema))
    return len(rows)
