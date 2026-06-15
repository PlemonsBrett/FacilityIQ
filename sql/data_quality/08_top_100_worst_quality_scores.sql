-- Top 100 worst facilities by query-only data quality scoring.
-- This intentionally does not create any tables.
-- If the source uses different column names for email_addresses, latitude, or longitude,
-- update those references before running.

WITH base AS (
  SELECT
    unique_id,
    name,
    facilityTypeId,
    address_city,
    address_stateOrRegion,
    address_country,
    phone_numbers,
    email_addresses,
    latitude,
    longitude,
    description,
    capability,
    procedure,
    equipment
  FROM databricks_virtue_foundation_dataset_dais_2026.virtue_foundation_dataset.facilities
),
exploded_phones AS (
  SELECT
    unique_id,
    regexp_replace(phone, '[^0-9]', '') AS phone_normalized
  FROM base
  LATERAL VIEW explode(from_json(phone_numbers, 'ARRAY<STRING>')) exploded AS phone
  WHERE phone_numbers IS NOT NULL
    AND phone_numbers NOT IN ('null', '[]')
),
phone_dupes AS (
  SELECT
    phone_normalized,
    COUNT(DISTINCT unique_id) AS duplicate_count
  FROM exploded_phones
  WHERE phone_normalized IS NOT NULL
    AND length(phone_normalized) >= 7
  GROUP BY phone_normalized
  HAVING COUNT(DISTINCT unique_id) > 1
),
exploded_emails AS (
  SELECT
    unique_id,
    lower(trim(email)) AS email_normalized
  FROM base
  LATERAL VIEW explode(from_json(email_addresses, 'ARRAY<STRING>')) exploded AS email
  WHERE email_addresses IS NOT NULL
    AND email_addresses NOT IN ('null', '[]')
),
email_dupes AS (
  SELECT
    email_normalized,
    COUNT(DISTINCT unique_id) AS duplicate_count
  FROM exploded_emails
  WHERE email_normalized IS NOT NULL
    AND email_normalized != ''
    AND email_normalized RLIKE '^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$'
  GROUP BY email_normalized
  HAVING COUNT(DISTINCT unique_id) > 1
),
identity_dupes AS (
  SELECT
    lower(trim(regexp_replace(name, '[^A-Za-z0-9]+', ' '))) AS name_normalized,
    lower(trim(coalesce(address_city, ''))) AS city_normalized,
    lower(trim(coalesce(address_stateOrRegion, ''))) AS state_normalized,
    lower(trim(coalesce(address_country, ''))) AS country_normalized,
    COUNT(DISTINCT unique_id) AS duplicate_count
  FROM base
  WHERE name IS NOT NULL
    AND trim(name) != ''
  GROUP BY
    lower(trim(regexp_replace(name, '[^A-Za-z0-9]+', ' '))),
    lower(trim(coalesce(address_city, ''))),
    lower(trim(coalesce(address_stateOrRegion, ''))),
    lower(trim(coalesce(address_country, '')))
  HAVING COUNT(DISTINCT unique_id) > 1
),
issues AS (
  SELECT
    p.unique_id,
    'duplicate_phone' AS check_name,
    CASE WHEN d.duplicate_count >= 6 THEN 'critical' ELSE 'high' END AS severity,
    CASE WHEN d.duplicate_count >= 6 THEN 50 ELSE 30 END AS penalty_points,
    CONCAT('Phone number is shared by ', d.duplicate_count, ' facilities.') AS issue_summary
  FROM exploded_phones p
  INNER JOIN phone_dupes d
    ON p.phone_normalized = d.phone_normalized

  UNION ALL

  SELECT
    e.unique_id,
    'duplicate_email' AS check_name,
    CASE WHEN d.duplicate_count >= 6 THEN 'critical' ELSE 'high' END AS severity,
    CASE WHEN d.duplicate_count >= 6 THEN 45 ELSE 25 END AS penalty_points,
    CONCAT('Email address is shared by ', d.duplicate_count, ' facilities.') AS issue_summary
  FROM exploded_emails e
  INNER JOIN email_dupes d
    ON e.email_normalized = d.email_normalized

  UNION ALL

  SELECT
    b.unique_id,
    'duplicate_facility_identity' AS check_name,
    'critical' AS severity,
    50 AS penalty_points,
    'Same normalized facility name and location appears on multiple records.' AS issue_summary
  FROM base b
  INNER JOIN identity_dupes d
    ON lower(trim(regexp_replace(b.name, '[^A-Za-z0-9]+', ' '))) = d.name_normalized
    AND lower(trim(coalesce(b.address_city, ''))) = d.city_normalized
    AND lower(trim(coalesce(b.address_stateOrRegion, ''))) = d.state_normalized
    AND lower(trim(coalesce(b.address_country, ''))) = d.country_normalized

  UNION ALL

  SELECT unique_id, 'missing_name', 'critical', 60, 'Facility name is missing.'
  FROM base
  WHERE name IS NULL OR trim(name) = ''

  UNION ALL

  SELECT unique_id, 'missing_facility_type', 'medium', 20, 'Facility type is missing.'
  FROM base
  WHERE facilityTypeId IS NULL OR trim(facilityTypeId) = ''

  UNION ALL

  SELECT unique_id, 'missing_state_or_region', 'high', 25, 'State or region is missing.'
  FROM base
  WHERE address_stateOrRegion IS NULL OR trim(address_stateOrRegion) = ''

  UNION ALL

  SELECT unique_id, 'missing_contacts', 'medium', 15, 'Both phone and email are missing.'
  FROM base
  WHERE (phone_numbers IS NULL OR phone_numbers IN ('null', '[]'))
    AND (email_addresses IS NULL OR email_addresses IN ('null', '[]'))

  UNION ALL

  SELECT unique_id, 'invalid_country', 'high', 30, 'Country is missing or not India.'
  FROM base
  WHERE address_country IS NULL
    OR lower(trim(address_country)) NOT IN ('india', 'in')

  UNION ALL

  SELECT unique_id, 'coordinates_outside_india', 'high', 35, 'Coordinates fall outside an approximate India bounding box.'
  FROM base
  WHERE latitude IS NOT NULL
    AND longitude IS NOT NULL
    AND (latitude < 6 OR latitude > 38 OR longitude < 68 OR longitude > 98)

  UNION ALL

  SELECT unique_id, 'short_description', 'high', 30, 'Description is missing or too short to support trust scoring.'
  FROM base
  WHERE description IS NULL OR length(trim(description)) < 25

  UNION ALL

  SELECT unique_id, 'thin_capability_text', 'medium', 15, 'Capability text is missing or too short.'
  FROM base
  WHERE capability IS NULL OR length(trim(capability)) < 10

  UNION ALL

  SELECT unique_id, 'description_duplicates_other_text', 'medium', 15, 'Description duplicates another evidence-bearing text field.'
  FROM base
  WHERE lower(trim(description)) = lower(trim(capability))
    OR lower(trim(description)) = lower(trim(procedure))
    OR lower(trim(description)) = lower(trim(equipment))
),
scored AS (
  SELECT
    b.unique_id,
    b.name,
    b.facilityTypeId,
    b.address_city,
    b.address_stateOrRegion,
    b.address_country,
    GREATEST(0, 100 - COALESCE(SUM(i.penalty_points), 0)) AS quality_score,
    COUNT(i.check_name) AS issue_count,
    SUM(CASE WHEN i.severity = 'critical' THEN 1 ELSE 0 END) AS critical_issue_count,
    SUM(CASE WHEN i.severity = 'high' THEN 1 ELSE 0 END) AS high_issue_count,
    SUM(CASE WHEN i.severity = 'medium' THEN 1 ELSE 0 END) AS medium_issue_count,
    COLLECT_LIST(CONCAT(i.check_name, ': ', i.issue_summary)) AS issue_summaries
  FROM base b
  LEFT JOIN issues i
    ON b.unique_id = i.unique_id
  GROUP BY
    b.unique_id,
    b.name,
    b.facilityTypeId,
    b.address_city,
    b.address_stateOrRegion,
    b.address_country
)
SELECT
  unique_id,
  name,
  facilityTypeId,
  address_city,
  address_stateOrRegion,
  address_country,
  quality_score,
  CASE
    WHEN quality_score >= 85 THEN 'high_quality'
    WHEN quality_score >= 65 THEN 'needs_review'
    WHEN quality_score >= 40 THEN 'low_quality'
    ELSE 'critical_issue'
  END AS quality_tier,
  issue_count,
  critical_issue_count,
  high_issue_count,
  medium_issue_count,
  issue_summaries
FROM scored
WHERE issue_count > 0
ORDER BY quality_score ASC, critical_issue_count DESC, high_issue_count DESC, issue_count DESC, name
LIMIT 100;
