-- No website at all (low).
-- Contract: returns (unique_id, penalty_points, issue_summary) for quality scoring.

SELECT
  unique_id,
  5 AS penalty_points,
  'No website on record' AS issue_summary
FROM databricks_virtue_foundation_dataset_dais_2026.virtue_foundation_dataset.facilities
WHERE (officialWebsite IS NULL OR trim(officialWebsite) IN ('', 'null'))
  AND (websites IS NULL OR trim(websites) IN ('', 'null', '[]'));
