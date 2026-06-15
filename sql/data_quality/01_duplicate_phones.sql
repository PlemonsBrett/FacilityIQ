-- Duplicate phone numbers across facilities.
-- Severity and penalty_points are percentile-driven across the full duplicate distribution:
--   top 10%  (pct_rank >= 0.90) → critical → 50 pts
--   next 30% (pct_rank >= 0.60) → medium   → 30 pts
--   bottom 60%                  → low      → 10 pts
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
),
ranked AS (
  SELECT
    phone_normalized,
    duplicate_count,
    PERCENT_RANK() OVER (ORDER BY duplicate_count) AS pct_rank
  FROM dupes
)
SELECT
  e.unique_id,
  e.name,
  e.facilityTypeId,
  e.address_city,
  e.address_stateOrRegion,
  e.address_country,
  e.raw_phone,
  e.phone_normalized,
  r.duplicate_count,
  r.pct_rank,
  CASE
    WHEN r.pct_rank >= 0.90 THEN 'critical'
    WHEN r.pct_rank >= 0.60 THEN 'medium'
    ELSE 'low'
  END AS severity,
  CASE
    WHEN r.pct_rank >= 0.90 THEN 50
    WHEN r.pct_rank >= 0.60 THEN 30
    ELSE 10
  END AS penalty_points
FROM exploded_phones e
INNER JOIN ranked r
  ON e.phone_normalized = r.phone_normalized
ORDER BY r.duplicate_count DESC, e.phone_normalized, e.name;
