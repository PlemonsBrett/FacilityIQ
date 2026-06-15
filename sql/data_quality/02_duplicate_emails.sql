-- Duplicate email addresses across facilities.
-- Assumes the dataset has an email_addresses JSON array column.
-- If the source column is named differently, update email_addresses below.

WITH exploded_emails AS (
  SELECT
    unique_id,
    name,
    facilityTypeId,
    address_city,
    address_stateOrRegion,
    address_country,
    email AS raw_email,
    lower(trim(email)) AS email_normalized
  FROM databricks_virtue_foundation_dataset_dais_2026.virtue_foundation_dataset.facilities
  LATERAL VIEW explode(from_json(email_addresses, 'ARRAY<STRING>')) exploded AS email
  WHERE email_addresses IS NOT NULL
    AND email_addresses != 'null'
    AND email_addresses != '[]'
),
dupes AS (
  SELECT
    email_normalized,
    COUNT(DISTINCT unique_id) AS duplicate_count
  FROM exploded_emails
  WHERE email_normalized IS NOT NULL
    AND email_normalized != ''
    AND email_normalized RLIKE '^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$'
  GROUP BY email_normalized
  HAVING COUNT(DISTINCT unique_id) > 1
)
SELECT
  e.raw_email,
  e.email_normalized,
  d.duplicate_count,
  CASE
    WHEN d.duplicate_count >= 6 THEN 'critical'
    WHEN d.duplicate_count >= 2 THEN 'high'
    ELSE 'low'
  END AS severity,
  CASE
    WHEN d.duplicate_count >= 6 THEN 45
    WHEN d.duplicate_count >= 2 THEN 25
    ELSE 5
  END AS penalty_points,
  e.unique_id,
  e.name,
  e.facilityTypeId,
  e.address_city,
  e.address_stateOrRegion,
  e.address_country
FROM exploded_emails e
INNER JOIN dupes d
  ON e.email_normalized = d.email_normalized
ORDER BY d.duplicate_count DESC, e.email_normalized, e.name;
