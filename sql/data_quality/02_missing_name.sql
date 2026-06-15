-- Missing facility name (critical — record cannot be safely interpreted).
-- Contract: returns (unique_id, penalty_points, issue_summary) for quality scoring.

SELECT
  unique_id,
  60 AS penalty_points,
  'Facility name is missing' AS issue_summary
FROM databricks_virtue_foundation_dataset_dais_2026.virtue_foundation_dataset.facilities
WHERE name IS NULL OR trim(name) IN ('', 'null');
