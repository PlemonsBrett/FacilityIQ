-- SILVER: typed and cleaned facilities, one row per unique_id.
-- Rules (best-practice data cleaning, no rows dropped):
--   * strings trimmed; placeholders ('', 'null', 'na', 'n/a', 'unknown', 'none') -> NULL
--   * numerics via try_cast (invalid text -> NULL, never errors)
--   * yearEstablished kept only if plausible (1800..current year)
--   * dates via try_cast; future dates -> NULL (e.g. recency '2027-..' is invalid)
--   * email kept only if it matches a basic pattern (nulls Cloudflare-obfuscated values)
--   * affiliationTypeIds parsed to a cleaned ARRAY<STRING>
--   * latitude/longitude cast to DOUBLE (0% populated in this export -> mostly NULL)

CREATE OR REPLACE TABLE workspace.facilityiq.facilities_silver
USING DELTA AS
SELECT
  trim(unique_id) AS unique_id,
  CASE WHEN lower(trim(name)) IN ('', 'null', 'na', 'n/a', 'unknown', 'none') THEN NULL ELSE trim(name) END AS name,
  CASE WHEN lower(trim(organization_type)) IN ('', 'null', 'na', 'n/a', 'unknown', 'none') THEN NULL ELSE trim(organization_type) END AS organization_type,
  trim(content_table_id) AS content_table_id,
  CASE WHEN lower(trim(officialPhone)) IN ('', 'null', 'na', 'n/a', 'unknown', 'none') THEN NULL ELSE trim(officialPhone) END AS official_phone,
  CASE WHEN lower(trim(email)) RLIKE '^[^@[:space:]]+@[^@[:space:]]+\\.[^@[:space:]]+$' THEN lower(trim(email)) ELSE NULL END AS email,
  CASE WHEN lower(trim(officialWebsite)) IN ('', 'null', 'na', 'n/a', 'unknown', 'none') THEN NULL ELSE lower(trim(officialWebsite)) END AS official_website,
  CASE WHEN try_cast(trim(yearEstablished) AS INT) BETWEEN 1800 AND year(current_date())
       THEN try_cast(trim(yearEstablished) AS INT) END AS year_established,
  try_cast(lower(trim(acceptsVolunteers)) AS BOOLEAN) AS accepts_volunteers,
  CASE WHEN lower(trim(facebookLink)) IN ('', 'null', 'na', 'n/a', 'unknown', 'none') THEN NULL ELSE trim(facebookLink) END AS facebook_link,
  CASE WHEN lower(trim(address_line1)) IN ('', 'null', 'na', 'n/a', 'unknown', 'none') THEN NULL ELSE trim(address_line1) END AS address_line1,
  CASE WHEN lower(trim(address_line2)) IN ('', 'null', 'na', 'n/a', 'unknown', 'none') THEN NULL ELSE trim(address_line2) END AS address_line2,
  CASE WHEN lower(trim(address_line3)) IN ('', 'null', 'na', 'n/a', 'unknown', 'none') THEN NULL ELSE trim(address_line3) END AS address_line3,
  CASE WHEN lower(trim(address_city)) IN ('', 'null', 'na', 'n/a', 'unknown', 'none') THEN NULL ELSE trim(address_city) END AS address_city,
  CASE WHEN lower(trim(address_stateOrRegion)) IN ('', 'null', 'na', 'n/a', 'unknown', 'none') THEN NULL ELSE trim(address_stateOrRegion) END AS address_state_or_region,
  CASE WHEN lower(trim(address_zipOrPostcode)) IN ('', 'null', 'na', 'n/a', 'unknown', 'none') THEN NULL ELSE trim(address_zipOrPostcode) END AS address_zip_or_postcode,
  CASE WHEN lower(trim(address_country)) IN ('', 'null', 'na', 'n/a', 'unknown', 'none') THEN NULL ELSE trim(address_country) END AS address_country,
  CASE WHEN lower(trim(address_countryCode)) IN ('', 'null', 'na', 'n/a', 'unknown', 'none') THEN NULL ELSE upper(trim(address_countryCode)) END AS address_country_code,
  CASE WHEN lower(trim(countries)) IN ('', 'null', 'na', 'n/a', 'unknown', 'none') THEN NULL ELSE trim(countries) END AS countries,
  CASE WHEN lower(trim(facilityTypeId)) IN ('', 'null', 'na', 'n/a', 'unknown', 'none') THEN NULL ELSE lower(trim(facilityTypeId)) END AS facility_type_id,
  CASE WHEN lower(trim(operatorTypeId)) IN ('', 'null', 'na', 'n/a', 'unknown', 'none') THEN NULL ELSE lower(trim(operatorTypeId)) END AS operator_type_id,
  array_distinct(filter(from_json(affiliationTypeIds, 'array<string>'), x -> x IS NOT NULL AND trim(x) <> '')) AS affiliation_type_ids,
  CASE WHEN lower(trim(description)) IN ('', 'null', 'na', 'n/a', 'unknown', 'none') THEN NULL ELSE trim(description) END AS description,
  try_cast(trim(area) AS INT) AS area,
  try_cast(trim(numberDoctors) AS INT) AS number_doctors,
  try_cast(trim(capacity) AS INT) AS capacity,
  CASE WHEN try_cast(trim(recency_of_page_update) AS DATE) <= current_date()
       THEN try_cast(trim(recency_of_page_update) AS DATE) END AS recency_of_page_update,
  try_cast(trim(distinct_social_media_presence_count) AS INT) AS distinct_social_media_presence_count,
  try_cast(lower(trim(affiliated_staff_presence)) AS BOOLEAN) AS affiliated_staff_presence,
  try_cast(lower(trim(custom_logo_presence)) AS BOOLEAN) AS custom_logo_presence,
  try_cast(trim(number_of_facts_about_the_organization) AS INT) AS number_of_facts_about_the_organization,
  CASE WHEN try_cast(trim(post_metrics_most_recent_social_media_post_date) AS DATE) <= current_date()
       THEN try_cast(trim(post_metrics_most_recent_social_media_post_date) AS DATE) END AS post_metrics_most_recent_social_media_post_date,
  try_cast(trim(post_metrics_post_count) AS INT) AS post_metrics_post_count,
  try_cast(trim(engagement_metrics_n_followers) AS BIGINT) AS engagement_metrics_n_followers,
  try_cast(trim(engagement_metrics_n_likes) AS BIGINT) AS engagement_metrics_n_likes,
  try_cast(trim(engagement_metrics_n_engagements) AS BIGINT) AS engagement_metrics_n_engagements,
  CASE WHEN lower(trim(source)) IN ('', 'null', 'na', 'n/a', 'unknown', 'none') THEN NULL ELSE trim(source) END AS source,
  try_cast(trim(latitude) AS DOUBLE) AS latitude,
  try_cast(trim(longitude) AS DOUBLE) AS longitude,
  current_timestamp() AS _silver_processed_at
FROM workspace.facilityiq.facilities_bronze;
