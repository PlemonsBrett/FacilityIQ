-- Missing core identity and usability fields.

SELECT
  unique_id,
  name,
  facilityTypeId,
  address_city,
  address_stateOrRegion,
  address_country,
  phone_numbers,
  email_addresses,
  CONCAT_WS(
    ', ',
    CASE WHEN name IS NULL OR trim(name) = '' THEN 'missing_name' END,
    CASE WHEN facilityTypeId IS NULL OR trim(facilityTypeId) = '' THEN 'missing_facility_type' END,
    CASE WHEN address_stateOrRegion IS NULL OR trim(address_stateOrRegion) = '' THEN 'missing_state_or_region' END,
    CASE WHEN address_country IS NULL OR trim(address_country) = '' THEN 'missing_country' END,
    CASE WHEN phone_numbers IS NULL OR phone_numbers IN ('null', '[]') THEN 'missing_phone_numbers' END,
    CASE WHEN email_addresses IS NULL OR email_addresses IN ('null', '[]') THEN 'missing_email_addresses' END
  ) AS missing_fields,
  (
    CASE WHEN name IS NULL OR trim(name) = '' THEN 60 ELSE 0 END
    + CASE WHEN facilityTypeId IS NULL OR trim(facilityTypeId) = '' THEN 20 ELSE 0 END
    + CASE WHEN address_stateOrRegion IS NULL OR trim(address_stateOrRegion) = '' THEN 25 ELSE 0 END
    + CASE WHEN address_country IS NULL OR trim(address_country) = '' THEN 15 ELSE 0 END
    + CASE WHEN phone_numbers IS NULL OR phone_numbers IN ('null', '[]') THEN 10 ELSE 0 END
    + CASE WHEN email_addresses IS NULL OR email_addresses IN ('null', '[]') THEN 10 ELSE 0 END
  ) AS penalty_points
FROM databricks_virtue_foundation_dataset_dais_2026.virtue_foundation_dataset.facilities
WHERE name IS NULL OR trim(name) = ''
  OR facilityTypeId IS NULL OR trim(facilityTypeId) = ''
  OR address_stateOrRegion IS NULL OR trim(address_stateOrRegion) = ''
  OR address_country IS NULL OR trim(address_country) = ''
  OR phone_numbers IS NULL OR phone_numbers IN ('null', '[]')
  OR email_addresses IS NULL OR email_addresses IN ('null', '[]')
ORDER BY penalty_points DESC, name;
