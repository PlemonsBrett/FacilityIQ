-- Invalid phone and email formats.
-- Assumes phone_numbers and email_addresses are JSON arrays of strings.

WITH phones AS (
  SELECT
    unique_id,
    name,
    facilityTypeId,
    address_city,
    address_stateOrRegion,
    address_country,
    'invalid_phone' AS check_name,
    phone AS evidence_value,
    CASE
      WHEN regexp_replace(phone, '[^0-9]', '') RLIKE '^(0+|1+|9+)$' THEN 'Repeated digit placeholder phone.'
      WHEN length(regexp_replace(phone, '[^0-9]', '')) < 7 THEN 'Phone has too few digits after normalization.'
      ELSE 'Phone is not usable.'
    END AS issue_summary,
    'high' AS severity,
    25 AS penalty_points
  FROM databricks_virtue_foundation_dataset_dais_2026.virtue_foundation_dataset.facilities
  LATERAL VIEW explode(from_json(phone_numbers, 'ARRAY<STRING>')) exploded AS phone
  WHERE phone IS NOT NULL
    AND (
      length(regexp_replace(phone, '[^0-9]', '')) < 7
      OR regexp_replace(phone, '[^0-9]', '') RLIKE '^(0+|1+|9+)$'
    )
),
emails AS (
  SELECT
    unique_id,
    name,
    facilityTypeId,
    address_city,
    address_stateOrRegion,
    address_country,
    'invalid_email' AS check_name,
    email AS evidence_value,
    CASE
      WHEN lower(trim(email)) IN ('na', 'n/a', 'none', 'null', 'test@example.com', 'abc@xyz.com') THEN 'Placeholder email.'
      ELSE 'Email does not match a usable email pattern.'
    END AS issue_summary,
    'high' AS severity,
    25 AS penalty_points
  FROM databricks_virtue_foundation_dataset_dais_2026.virtue_foundation_dataset.facilities
  LATERAL VIEW explode(from_json(email_addresses, 'ARRAY<STRING>')) exploded AS email
  WHERE email IS NOT NULL
    AND (
      lower(trim(email)) IN ('na', 'n/a', 'none', 'null', 'test@example.com', 'abc@xyz.com')
      OR lower(trim(email)) NOT RLIKE '^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$'
    )
)
SELECT * FROM phones
UNION ALL
SELECT * FROM emails
ORDER BY penalty_points DESC, check_name, name;
