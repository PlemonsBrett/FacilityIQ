-- GOLD: field- and row-level data quality issues found during facility curation.
--
-- This table deliberately preserves rejected source values so analysts can explain why
-- a row did not reach the app-facing facilities_gold table. Bronze remains unchanged.

CREATE OR REPLACE TABLE workspace.facilityiq.facilities_data_quality_issues
USING DELTA AS
WITH silver_with_counts AS (
  SELECT
    s.*,
    COUNT(*) OVER (PARTITION BY unique_id) AS unique_id_row_count
  FROM workspace.facilityiq.facilities_silver s
),
issues AS (
  SELECT
    unique_id AS facility_id,
    'unique_id' AS field_name,
    'invalid_facility_id' AS issue_type,
    'critical' AS severity,
    unique_id AS raw_value,
    CAST(NULL AS STRING) AS suggested_value,
    'unique_id_uuid_validation' AS rule_name
  FROM silver_with_counts
  WHERE unique_id NOT RLIKE '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'

  UNION ALL

  SELECT
    unique_id AS facility_id,
    'unique_id' AS field_name,
    'duplicate_facility_id' AS issue_type,
    'medium' AS severity,
    unique_id AS raw_value,
    'Deduped in facilities_gold by completeness score' AS suggested_value,
    'unique_id_duplicate_detection' AS rule_name
  FROM silver_with_counts
  WHERE unique_id RLIKE '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
    AND unique_id_row_count > 1

  UNION ALL

  SELECT
    unique_id AS facility_id,
    'name' AS field_name,
    'missing_facility_name' AS issue_type,
    'high' AS severity,
    name AS raw_value,
    CAST(NULL AS STRING) AS suggested_value,
    'name_required_for_identity' AS rule_name
  FROM silver_with_counts
  WHERE unique_id RLIKE '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
    AND name IS NULL

  UNION ALL

  SELECT
    unique_id AS facility_id,
    'facility_type_id' AS field_name,
    'invalid_facility_type' AS issue_type,
    'medium' AS severity,
    facility_type_id AS raw_value,
    CAST(NULL AS STRING) AS suggested_value,
    'facility_type_allowlist' AS rule_name
  FROM silver_with_counts
  WHERE unique_id RLIKE '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
    AND (facility_type_id IS NULL OR facility_type_id NOT IN ('hospital','clinic','dentist','pharmacy','farmacy','doctor','nursing_home'))

  UNION ALL

  SELECT
    unique_id AS facility_id,
    'address_country_code' AS field_name,
    'unexpected_country_code' AS issue_type,
    'medium' AS severity,
    address_country_code AS raw_value,
    'IN' AS suggested_value,
    'india_dataset_country_code_check' AS rule_name
  FROM silver_with_counts
  WHERE unique_id RLIKE '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
    AND address_country_code IS NOT NULL
    AND address_country_code <> 'IN'
)
SELECT
  facility_id,
  field_name,
  issue_type,
  severity,
  raw_value,
  suggested_value,
  rule_name,
  current_timestamp() AS detected_at
FROM issues;
