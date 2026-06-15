-- Missing or unrecognized facility type (medium).
-- Contract: returns (unique_id, penalty_points, issue_summary) for quality scoring.

SELECT
  unique_id,
  20 AS penalty_points,
  'Facility type is missing or invalid' AS issue_summary
FROM databricks_virtue_foundation_dataset_dais_2026.virtue_foundation_dataset.facilities
WHERE facilityTypeId IS NULL
   OR trim(facilityTypeId) = 'null'
   OR facilityTypeId NOT IN ('hospital', 'clinic', 'dentist', 'pharmacy', 'farmacy', 'doctor', 'nursing_home');
