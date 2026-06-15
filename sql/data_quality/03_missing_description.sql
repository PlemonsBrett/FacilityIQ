-- Missing description (high — no free text to support trust scoring).
-- Contract: returns (unique_id, penalty_points, issue_summary) for quality scoring.

SELECT
  unique_id,
  30 AS penalty_points,
  'Description is missing' AS issue_summary
FROM databricks_virtue_foundation_dataset_dais_2026.virtue_foundation_dataset.facilities
WHERE description IS NULL OR trim(description) IN ('', 'null');
