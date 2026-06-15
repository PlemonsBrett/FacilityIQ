-- Per-email outreach metadata for the data-confirmation workflow.
-- Primary key: email. One row per distinct, valid email address in the dataset.
-- Captures the "state of the data" around each email so the app can draft an
-- outreach message asking the recipient to confirm or correct their records.
--
-- Placeholders {SOURCE_TABLE} and {QUALITY_TABLE} are filled in by
-- prompts/email_outreach.py before execution.

WITH exploded_emails AS (
  SELECT
    unique_id AS facility_id,
    name AS facility_name,
    address_city,
    address_stateOrRegion,
    lower(trim(email)) AS email
  FROM {SOURCE_TABLE}
  LATERAL VIEW explode(from_json(email_addresses, 'ARRAY<STRING>')) exploded AS email
  WHERE email_addresses IS NOT NULL
    AND email_addresses NOT IN ('null', '[]')
),
valid_emails AS (
  SELECT *
  FROM exploded_emails
  WHERE email IS NOT NULL
    AND email != ''
    AND email RLIKE '^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$'
)
SELECT
  v.email,
  COUNT(DISTINCT v.facility_id) AS facility_count,
  collect_set(v.facility_id) AS facility_ids,
  collect_set(v.facility_name) AS facility_names,
  collect_set(v.address_stateOrRegion) AS states,
  collect_set(v.address_city) AS cities,
  COUNT(DISTINCT v.facility_id) > 1 AS is_shared,
  MIN(q.quality_score) AS min_quality_score,
  CAST(ROUND(AVG(q.quality_score), 0) AS INT) AS avg_quality_score,
  array_distinct(flatten(collect_set(coalesce(q.issues, array())))) AS issues,
  current_timestamp() AS computed_at
FROM valid_emails v
LEFT JOIN {QUALITY_TABLE} q
  ON v.facility_id = q.facility_id
GROUP BY v.email
