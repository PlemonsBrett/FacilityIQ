-- Address and location quality checks.
-- Update latitude/longitude column names if the source schema uses different names.

SELECT
  unique_id,
  name,
  facilityTypeId,
  address_city,
  address_stateOrRegion,
  address_country,
  latitude,
  longitude,
  CONCAT_WS(
    ', ',
    CASE WHEN address_city IS NULL OR trim(address_city) = '' OR lower(trim(address_city)) IN ('na', 'n/a', 'unknown') THEN 'bad_city' END,
    CASE WHEN address_stateOrRegion IS NULL OR trim(address_stateOrRegion) = '' OR lower(trim(address_stateOrRegion)) IN ('na', 'n/a', 'unknown') THEN 'bad_state_or_region' END,
    CASE WHEN lower(trim(address_country)) NOT IN ('india', 'in') THEN 'unexpected_country' END,
    CASE WHEN latitude IS NULL OR longitude IS NULL THEN 'missing_coordinates' END,
    CASE WHEN latitude IS NOT NULL AND (latitude < 6 OR latitude > 38) THEN 'latitude_outside_india_range' END,
    CASE WHEN longitude IS NOT NULL AND (longitude < 68 OR longitude > 98) THEN 'longitude_outside_india_range' END
  ) AS location_issues,
  (
    CASE WHEN address_city IS NULL OR trim(address_city) = '' OR lower(trim(address_city)) IN ('na', 'n/a', 'unknown') THEN 10 ELSE 0 END
    + CASE WHEN address_stateOrRegion IS NULL OR trim(address_stateOrRegion) = '' OR lower(trim(address_stateOrRegion)) IN ('na', 'n/a', 'unknown') THEN 25 ELSE 0 END
    + CASE WHEN lower(trim(address_country)) NOT IN ('india', 'in') THEN 30 ELSE 0 END
    + CASE WHEN latitude IS NULL OR longitude IS NULL THEN 5 ELSE 0 END
    + CASE WHEN latitude IS NOT NULL AND (latitude < 6 OR latitude > 38) THEN 35 ELSE 0 END
    + CASE WHEN longitude IS NOT NULL AND (longitude < 68 OR longitude > 98) THEN 35 ELSE 0 END
  ) AS penalty_points
FROM databricks_virtue_foundation_dataset_dais_2026.virtue_foundation_dataset.facilities
WHERE address_city IS NULL OR trim(address_city) = '' OR lower(trim(address_city)) IN ('na', 'n/a', 'unknown')
  OR address_stateOrRegion IS NULL OR trim(address_stateOrRegion) = '' OR lower(trim(address_stateOrRegion)) IN ('na', 'n/a', 'unknown')
  OR lower(trim(address_country)) NOT IN ('india', 'in')
  OR latitude IS NULL OR longitude IS NULL
  OR latitude < 6 OR latitude > 38
  OR longitude < 68 OR longitude > 98
ORDER BY penalty_points DESC, name;
