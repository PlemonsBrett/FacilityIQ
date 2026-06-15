-- Duplicate phone numbers across facilities.
-- Run directly in Databricks SQL. This does not create or replace any table.

WITH exploded_phones AS (
  SELECT
    unique_id,
    name,
    facilityTypeId,
    address_city,
    address_stateOrRegion,
    address_country,
    phone AS raw_phone,
    regexp_replace(phone, '[^0-9]', '') AS phone_normalized
  FROM databricks_virtue_foundation_dataset_dais_2026.virtue_foundation_dataset.facilities
  LATERAL VIEW explode(from_json(phone_numbers, 'ARRAY<STRING>')) exploded AS phone
  WHERE phone_numbers IS NOT NULL
    AND phone_numbers != 'null'
    AND phone_numbers != '[]'
),
dupes AS (
  SELECT
    phone_normalized,
    COUNT(DISTINCT unique_id) AS duplicate_count
  FROM exploded_phones
  WHERE phone_normalized IS NOT NULL
    AND length(phone_normalized) >= 7
  GROUP BY phone_normalized
  HAVING COUNT(DISTINCT unique_id) > 1
)
SELECT
  e.raw_phone,
  e.phone_normalized,
  d.duplicate_count,
  CASE
    WHEN d.duplicate_count >= 6 THEN 'critical'
    WHEN d.duplicate_count >= 2 THEN 'high'
    ELSE 'low'
  END AS severity,
  CASE
    WHEN d.duplicate_count >= 6 THEN 50
    WHEN d.duplicate_count >= 2 THEN 30
    ELSE 5
  END AS penalty_points,
  e.unique_id,
  e.name,
  e.facilityTypeId,
  e.address_city,
  e.address_stateOrRegion,
  e.address_country
FROM exploded_phones e
INNER JOIN dupes d
  ON e.phone_normalized = d.phone_normalized
ORDER BY d.duplicate_count DESC, e.phone_normalized, e.name;
