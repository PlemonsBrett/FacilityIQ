-- Likely duplicate facility records by normalized name and location.

WITH normalized AS (
  SELECT
    unique_id,
    name,
    facilityTypeId,
    address_city,
    address_stateOrRegion,
    address_country,
    lower(trim(regexp_replace(name, '[^A-Za-z0-9]+', ' '))) AS name_normalized,
    lower(trim(coalesce(address_city, ''))) AS city_normalized,
    lower(trim(coalesce(address_stateOrRegion, ''))) AS state_normalized,
    lower(trim(coalesce(address_country, ''))) AS country_normalized
  FROM databricks_virtue_foundation_dataset_dais_2026.virtue_foundation_dataset.facilities
),
dupes AS (
  SELECT
    name_normalized,
    city_normalized,
    state_normalized,
    country_normalized,
    COUNT(DISTINCT unique_id) AS duplicate_count
  FROM normalized
  WHERE name_normalized IS NOT NULL
    AND name_normalized != ''
  GROUP BY name_normalized, city_normalized, state_normalized, country_normalized
  HAVING COUNT(DISTINCT unique_id) > 1
)
SELECT
  n.unique_id,
  n.name,
  n.facilityTypeId,
  n.address_city,
  n.address_stateOrRegion,
  n.address_country,
  d.duplicate_count,
  'critical' AS severity,
  50 AS penalty_points,
  'Duplicate facility identity: same normalized name and location.' AS issue_summary
FROM normalized n
INNER JOIN dupes d
  ON n.name_normalized = d.name_normalized
  AND n.city_normalized = d.city_normalized
  AND n.state_normalized = d.state_normalized
  AND n.country_normalized = d.country_normalized
ORDER BY d.duplicate_count DESC, n.name;
