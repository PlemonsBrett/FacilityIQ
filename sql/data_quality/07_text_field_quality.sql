-- Text quality checks for evidence-bearing fields.
-- These fields drive trust scoring, so missing or boilerplate text should lower record quality.

SELECT
  unique_id,
  name,
  facilityTypeId,
  address_city,
  address_stateOrRegion,
  address_country,
  description,
  capability,
  procedure,
  equipment,
  CONCAT_WS(
    ', ',
    CASE WHEN description IS NULL OR length(trim(description)) < 25 THEN 'description_too_short' END,
    CASE WHEN capability IS NULL OR length(trim(capability)) < 10 THEN 'capability_too_short' END,
    CASE WHEN procedure IS NULL OR length(trim(procedure)) < 10 THEN 'procedure_too_short' END,
    CASE WHEN equipment IS NULL OR length(trim(equipment)) < 10 THEN 'equipment_too_short' END,
    CASE WHEN lower(trim(description)) = lower(trim(capability)) THEN 'description_duplicates_capability' END,
    CASE WHEN lower(trim(description)) = lower(trim(procedure)) THEN 'description_duplicates_procedure' END,
    CASE WHEN lower(trim(description)) = lower(trim(equipment)) THEN 'description_duplicates_equipment' END
  ) AS text_issues,
  (
    CASE WHEN description IS NULL OR length(trim(description)) < 25 THEN 30 ELSE 0 END
    + CASE WHEN capability IS NULL OR length(trim(capability)) < 10 THEN 15 ELSE 0 END
    + CASE WHEN procedure IS NULL OR length(trim(procedure)) < 10 THEN 10 ELSE 0 END
    + CASE WHEN equipment IS NULL OR length(trim(equipment)) < 10 THEN 10 ELSE 0 END
    + CASE WHEN lower(trim(description)) = lower(trim(capability)) THEN 15 ELSE 0 END
    + CASE WHEN lower(trim(description)) = lower(trim(procedure)) THEN 15 ELSE 0 END
    + CASE WHEN lower(trim(description)) = lower(trim(equipment)) THEN 15 ELSE 0 END
  ) AS penalty_points
FROM databricks_virtue_foundation_dataset_dais_2026.virtue_foundation_dataset.facilities
WHERE description IS NULL OR length(trim(description)) < 25
  OR capability IS NULL OR length(trim(capability)) < 10
  OR procedure IS NULL OR length(trim(procedure)) < 10
  OR equipment IS NULL OR length(trim(equipment)) < 10
  OR lower(trim(description)) = lower(trim(capability))
  OR lower(trim(description)) = lower(trim(procedure))
  OR lower(trim(description)) = lower(trim(equipment))
ORDER BY penalty_points DESC, name;
