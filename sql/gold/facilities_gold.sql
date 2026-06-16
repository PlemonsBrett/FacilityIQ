-- GOLD: analyst-ready facilities = silver with the latest user overrides merged in.
-- For each overridable column, COALESCE(latest_override, silver_value). The override
-- value is stored as text and cast back to the column's type on apply.
-- overridden_fields lists which columns were overridden for transparency/audit.
--
-- Overridable columns (the fields an analyst would correct). To make another column
-- overridable, add a MAX(CASE ...) line in `ov` and a COALESCE line below.

CREATE OR REPLACE TABLE workspace.facilityiq.facilities_gold
USING DELTA AS
WITH latest_overrides AS (
  SELECT facility_id, field_name, new_value
  FROM (
    SELECT
      facility_id, field_name, new_value,
      ROW_NUMBER() OVER (PARTITION BY facility_id, field_name ORDER BY updated_at DESC) AS rn
    FROM `facilityiq-lakebase`.facilityiq.facilities_overrides
  )
  WHERE rn = 1
),
valid_silver AS (
  SELECT *
  FROM workspace.facilityiq.facilities_silver
  WHERE unique_id RLIKE '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
),
ranked_silver AS (
  SELECT *
  FROM (
    SELECT
      s.*,
      ROW_NUMBER() OVER (
        PARTITION BY unique_id
        ORDER BY
          (
            CASE WHEN name IS NOT NULL THEN 1 ELSE 0 END +
            CASE WHEN official_phone IS NOT NULL THEN 1 ELSE 0 END +
            CASE WHEN email IS NOT NULL THEN 1 ELSE 0 END +
            CASE WHEN official_website IS NOT NULL THEN 1 ELSE 0 END +
            CASE WHEN address_city IS NOT NULL THEN 1 ELSE 0 END +
            CASE WHEN address_state_or_region IS NOT NULL THEN 1 ELSE 0 END +
            CASE WHEN address_country_code = 'IN' THEN 1 ELSE 0 END +
            CASE WHEN facility_type_id IN ('hospital','clinic','dentist','pharmacy','farmacy','doctor','nursing_home') THEN 1 ELSE 0 END +
            CASE WHEN description IS NOT NULL THEN 1 ELSE 0 END +
            CASE WHEN capability IS NOT NULL THEN 1 ELSE 0 END +
            CASE WHEN procedure IS NOT NULL THEN 1 ELSE 0 END +
            CASE WHEN equipment IS NOT NULL THEN 1 ELSE 0 END
          ) DESC,
          _silver_processed_at DESC
      ) AS _dedupe_rank
    FROM valid_silver s
  )
  WHERE _dedupe_rank = 1
),
ov AS (
  SELECT
    facility_id,
    MAX(CASE WHEN field_name = 'name' THEN new_value END)                    AS name_ov,
    MAX(CASE WHEN field_name = 'official_phone' THEN new_value END)          AS official_phone_ov,
    MAX(CASE WHEN field_name = 'email' THEN new_value END)                   AS email_ov,
    MAX(CASE WHEN field_name = 'official_website' THEN new_value END)        AS official_website_ov,
    MAX(CASE WHEN field_name = 'year_established' THEN new_value END)        AS year_established_ov,
    MAX(CASE WHEN field_name = 'address_line1' THEN new_value END)           AS address_line1_ov,
    MAX(CASE WHEN field_name = 'address_line2' THEN new_value END)           AS address_line2_ov,
    MAX(CASE WHEN field_name = 'address_line3' THEN new_value END)           AS address_line3_ov,
    MAX(CASE WHEN field_name = 'address_city' THEN new_value END)            AS address_city_ov,
    MAX(CASE WHEN field_name = 'address_state_or_region' THEN new_value END) AS address_state_or_region_ov,
    MAX(CASE WHEN field_name = 'address_zip_or_postcode' THEN new_value END) AS address_zip_or_postcode_ov,
    MAX(CASE WHEN field_name = 'address_country' THEN new_value END)         AS address_country_ov,
    MAX(CASE WHEN field_name = 'address_country_code' THEN new_value END)    AS address_country_code_ov,
    MAX(CASE WHEN field_name = 'facility_type_id' THEN new_value END)        AS facility_type_id_ov,
    MAX(CASE WHEN field_name = 'operator_type_id' THEN new_value END)        AS operator_type_id_ov,
    MAX(CASE WHEN field_name = 'description' THEN new_value END)             AS description_ov,
    MAX(CASE WHEN field_name = 'capability' THEN new_value END)              AS capability_ov,
    MAX(CASE WHEN field_name = 'procedure' THEN new_value END)               AS procedure_ov,
    MAX(CASE WHEN field_name = 'equipment' THEN new_value END)               AS equipment_ov,
    MAX(CASE WHEN field_name = 'number_doctors' THEN new_value END)          AS number_doctors_ov,
    MAX(CASE WHEN field_name = 'capacity' THEN new_value END)                AS capacity_ov,
    MAX(CASE WHEN field_name = 'latitude' THEN new_value END)                AS latitude_ov,
    MAX(CASE WHEN field_name = 'longitude' THEN new_value END)               AS longitude_ov
  FROM latest_overrides
  GROUP BY facility_id
),
overridden AS (
  SELECT facility_id, collect_set(field_name) AS overridden_fields
  FROM latest_overrides
  GROUP BY facility_id
)
SELECT
  s.unique_id,
  COALESCE(ov.name_ov, s.name)                                              AS name,
  s.organization_type,
  s.content_table_id,
  COALESCE(ov.official_phone_ov, s.official_phone)                          AS official_phone,
  COALESCE(ov.email_ov, s.email)                                           AS email,
  COALESCE(ov.official_website_ov, s.official_website)                      AS official_website,
  COALESCE(try_cast(ov.year_established_ov AS INT), s.year_established)     AS year_established,
  s.accepts_volunteers,
  s.facebook_link,
  COALESCE(ov.address_line1_ov, s.address_line1)                           AS address_line1,
  COALESCE(ov.address_line2_ov, s.address_line2)                           AS address_line2,
  COALESCE(ov.address_line3_ov, s.address_line3)                           AS address_line3,
  COALESCE(ov.address_city_ov, s.address_city)                             AS address_city,
  COALESCE(ov.address_state_or_region_ov, s.address_state_or_region)       AS address_state_or_region,
  COALESCE(ov.address_zip_or_postcode_ov, s.address_zip_or_postcode)       AS address_zip_or_postcode,
  COALESCE(ov.address_country_ov, s.address_country)                       AS address_country,
  COALESCE(ov.address_country_code_ov, s.address_country_code)             AS address_country_code,
  s.countries,
  COALESCE(ov.facility_type_id_ov, s.facility_type_id)                     AS facility_type_id,
  COALESCE(ov.operator_type_id_ov, s.operator_type_id)                     AS operator_type_id,
  s.affiliation_type_ids,
  COALESCE(ov.description_ov, s.description)                               AS description,
  COALESCE(ov.capability_ov, s.capability)                                 AS capability,
  COALESCE(ov.procedure_ov, s.procedure)                                   AS procedure,
  COALESCE(ov.equipment_ov, s.equipment)                                   AS equipment,
  s.area,
  COALESCE(try_cast(ov.number_doctors_ov AS INT), s.number_doctors)        AS number_doctors,
  COALESCE(try_cast(ov.capacity_ov AS INT), s.capacity)                    AS capacity,
  s.recency_of_page_update,
  s.distinct_social_media_presence_count,
  s.affiliated_staff_presence,
  s.custom_logo_presence,
  s.number_of_facts_about_the_organization,
  s.post_metrics_most_recent_social_media_post_date,
  s.post_metrics_post_count,
  s.engagement_metrics_n_followers,
  s.engagement_metrics_n_likes,
  s.engagement_metrics_n_engagements,
  s.source,
  COALESCE(try_cast(ov.latitude_ov AS DOUBLE), s.latitude)                 AS latitude,
  COALESCE(try_cast(ov.longitude_ov AS DOUBLE), s.longitude)               AS longitude,
  COALESCE(overridden.overridden_fields, array()) AS overridden_fields,
  current_timestamp() AS _gold_built_at
FROM ranked_silver s
LEFT JOIN ov         ON s.unique_id = ov.facility_id
LEFT JOIN overridden ON s.unique_id = overridden.facility_id;
