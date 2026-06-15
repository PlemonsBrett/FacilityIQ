-- No email address at all (medium).
-- Contract: returns (unique_id, penalty_points, issue_summary) for quality scoring.

SELECT
  unique_id,
  10 AS penalty_points,
  'No email address on record' AS issue_summary
FROM databricks_virtue_foundation_dataset_dais_2026.virtue_foundation_dataset.facilities
WHERE email IS NULL OR trim(email) IN ('', 'null');
