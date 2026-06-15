-- No phone number at all (medium). Distinct from 01_duplicate_phones (reused numbers).
-- Contract: returns (unique_id, penalty_points, issue_summary) for quality scoring.

SELECT
  unique_id,
  10 AS penalty_points,
  'No phone number on record' AS issue_summary
FROM databricks_virtue_foundation_dataset_dais_2026.virtue_foundation_dataset.facilities
WHERE (officialPhone IS NULL OR trim(officialPhone) IN ('', 'null'))
  AND (phone_numbers IS NULL OR trim(phone_numbers) IN ('', 'null', '[]'));
