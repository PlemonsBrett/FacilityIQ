"""Writes trust_extraction responses to the facilities_trust_signals Delta table.

Schema (per CLAUDE.md): one row per (facility_id, dimension), partitioned by dimension.
Dimensions: capability | equipment | procedure | completeness.

The explicit schema below matters: building a DataFrame from a list of dicts lets
Spark infer types, which fails when an entire batch has all-null trust_score or
evidence_text (inferred as NullType). Pinning the schema avoids that.
"""

from pyspark.sql.types import (
    StructType,
    StructField,
    StringType,
    DoubleType,
    BooleanType,
    TimestampType,
)

VALID_DIMENSIONS = {"capability", "equipment", "procedure", "completeness"}

TRUST_SIGNALS_SCHEMA = StructType([
    StructField("facility_id", StringType(), False),
    StructField("dimension", StringType(), False),
    StructField("trust_score", DoubleType(), True),
    StructField("confidence_tier", StringType(), True),
    StructField("evidence_text", StringType(), True),
    StructField("source_field", StringType(), True),
    StructField("contradiction", BooleanType(), True),
    StructField("contradiction_detail", StringType(), True),
    StructField("extraction_model", StringType(), True),
    StructField("extracted_at", TimestampType(), True),
])


def table_name(catalog: str, schema: str) -> str:
    return f"{catalog}.{schema}.facilities_trust_signals"


def create_trust_signals_table(spark, catalog: str, schema: str) -> None:
    """Idempotent — safe to call before every run."""
    spark.sql(f"""
        CREATE TABLE IF NOT EXISTS {table_name(catalog, schema)} (
            facility_id STRING NOT NULL,
            dimension STRING NOT NULL,
            trust_score DOUBLE,
            confidence_tier STRING,
            evidence_text STRING,
            source_field STRING,
            contradiction BOOLEAN,
            contradiction_detail STRING,
            extraction_model STRING,
            extracted_at TIMESTAMP
        )
        USING DELTA
        PARTITIONED BY (dimension)
    """)


def write_signals(spark, signals: list[dict], catalog: str, schema: str) -> int:
    """
    Append a batch of signal dicts to facilities_trust_signals.
    Returns the number of rows written. No-op (returns 0) for an empty batch.
    Drops rows whose dimension is not one of VALID_DIMENSIONS.
    """
    if not signals:
        return 0

    clean = [s for s in signals if s.get("dimension") in VALID_DIMENSIONS]
    dropped = len(signals) - len(clean)
    if dropped:
        print(f"  Dropped {dropped} signal(s) with invalid dimension")
    if not clean:
        return 0

    df = spark.createDataFrame(clean, schema=TRUST_SIGNALS_SCHEMA)
    df.write.format("delta").mode("append").saveAsTable(table_name(catalog, schema))
    return len(clean)
