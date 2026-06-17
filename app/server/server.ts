import { analytics, createApp, server, sql } from '@databricks/appkit';
import { sqlResultRows } from './sqlResultRows';

const FACILITIES_TABLE = 'workspace.facilityiq.facilities_gold';
const TRUST_SIGNALS_TABLE = 'workspace.facilityiq.facilities_trust_signals';
const QUALITY_SCORES_TABLE = 'workspace.facilityiq.facilities_quality_scores';
const READ_ONLY_MESSAGE = 'FacilityIQ is running in read-only Delta mode; analyst write-back is disabled.';

const adjustedTrustScoreSql = `
  CASE
    WHEN COUNT(t.trust_score) = 0 THEN NULL
    ELSE LEAST(
      GREATEST(0, LEAST(1,
        AVG(t.trust_score)
        - (GREATEST(0, 3 - COUNT(t.trust_score)) * 0.10)
        - ((
            CASE WHEN MAX(f.official_phone) IS NULL THEN 1 ELSE 0 END +
            CASE WHEN MAX(f.email) IS NULL THEN 1 ELSE 0 END +
            CASE WHEN MAX(f.official_website) IS NULL THEN 1 ELSE 0 END +
            CASE WHEN MAX(f.year_established) IS NULL THEN 1 ELSE 0 END +
            CASE WHEN MAX(f.capacity) IS NULL THEN 1 ELSE 0 END +
            CASE WHEN MAX(f.number_doctors) IS NULL THEN 1 ELSE 0 END +
            CASE WHEN MAX(f.description) IS NULL THEN 1 ELSE 0 END
          ) * 0.03)
        - ((100 - COALESCE(MAX(q.quality_score), 100)) / 400.0)
      )),
      0.90
    )
  END
`;

const facilityScoresSql = `
  SELECT
    f.unique_id AS facility_id,
    f.name AS facility_name,
    f.address_state_or_region AS state,
    f.facility_type_id AS facility_type,
    CAST(${adjustedTrustScoreSql} AS DOUBLE) AS score,
    CAST(MAX(CASE WHEN t.contradiction THEN 1 ELSE 0 END) AS INT) AS has_contradiction,
    CAST(COUNT(t.dimension) AS INT) AS signal_count
  FROM ${FACILITIES_TABLE} f
  LEFT JOIN ${TRUST_SIGNALS_TABLE} t ON f.unique_id = t.facility_id
  LEFT JOIN ${QUALITY_SCORES_TABLE} q ON q.facility_id = f.unique_id
  GROUP BY f.unique_id, f.name, f.address_state_or_region, f.facility_type_id
`;

function numberField(row: Record<string, unknown> | undefined, key: string, fallback = 0): number {
  const value = row?.[key];
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function nullableNumberField(row: Record<string, unknown> | undefined, key: string): number | null {
  if (!row || row[key] === null || row[key] === undefined) return null;
  return numberField(row, key, 0);
}

function stringField(row: Record<string, unknown> | undefined, key: string): string | null {
  const value = row?.[key];
  if (value === null || value === undefined) return null;
  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    typeof value === 'bigint'
  ) {
    return String(value);
  }
  return null;
}

function queryString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function queryInt(value: unknown, fallback: number): number {
  const parsed = Number.parseInt(queryString(value, String(fallback)), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function queryFloat(value: unknown, fallback: number): number {
  const parsed = Number.parseFloat(queryString(value, String(fallback)));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function dashboardTier(value: unknown): 'high' | 'med' | 'low' | 'insuff' {
  return value === 'high' || value === 'med' || value === 'low' || value === 'insuff'
    ? value
    : 'insuff';
}

function facilityRows(result: unknown) {
  return sqlResultRows(result).map((row) => ({
    facility_id: stringField(row, 'facility_id') ?? '',
    facility_name: stringField(row, 'facility_name') ?? '',
    state: stringField(row, 'state'),
    facility_type: stringField(row, 'facility_type'),
    overall_trust_score: stringField(row, 'overall_trust_score'),
    has_contradiction: numberField(row, 'has_contradiction'),
    signal_count: numberField(row, 'signal_count'),
    score: nullableNumberField(row, 'score'),
  }));
}

function readOnly(res: { status: (code: number) => { json: (body: unknown) => void } }) {
  res.status(503).json({ error: READ_ONLY_MESSAGE, read_only: true });
}

createApp({
  plugins: [
    analytics({}),
    server(),
  ],
  onPluginsReady(appkit) {
    const query = (
      statement: string,
      params?: Parameters<typeof appkit.analytics.query>[1],
    ): Promise<unknown> => appkit.analytics.query(statement, params) as Promise<unknown>;

    appkit.server.extend((app) => {
      app.get('/api/dashboard', async (_req, res) => {
        try {
          const [summary, distribution, tiers, dims, types, top, bottom] = await Promise.all([
            query(`
              WITH facility_scores AS (${facilityScoresSql})
              SELECT
                CAST(COUNT(*) AS INT) AS total,
                CAST(COALESCE(SUM(has_contradiction), 0) AS INT) AS contradiction_count,
                CAST(ROUND(AVG(score) * 100) AS INT) AS avg_score
              FROM facility_scores
            `),
            query(`
              WITH facility_scores AS (${facilityScoresSql}),
              buckets(label, min_score, max_score, tier, sort_order) AS (
                SELECT * FROM VALUES
                  ('0-29', 0, 29, 'low', 1),
                  ('30-39', 30, 39, 'low', 2),
                  ('40-49', 40, 49, 'med', 3),
                  ('50-59', 50, 59, 'med', 4),
                  ('60-69', 60, 69, 'med', 5),
                  ('70-79', 70, 79, 'high', 6),
                  ('80-89', 80, 89, 'high', 7),
                  ('90-100', 90, 100, 'high', 8)
                AS buckets(label, min_score, max_score, tier, sort_order)
              )
              SELECT b.label, CAST(COUNT(fs.facility_id) AS INT) AS count, b.tier
              FROM buckets b
              LEFT JOIN facility_scores fs
                ON fs.score IS NOT NULL
               AND CAST(ROUND(fs.score * 100) AS INT) BETWEEN b.min_score AND b.max_score
              GROUP BY b.label, b.tier, b.sort_order
              ORDER BY b.sort_order
            `),
            query(`
              WITH facility_scores AS (${facilityScoresSql})
              SELECT
                CAST(COUNT(CASE WHEN score >= 0.7 THEN 1 END) AS INT) AS high_count,
                CAST(COUNT(CASE WHEN score >= 0.4 AND score < 0.7 THEN 1 END) AS INT) AS med_count,
                CAST(COUNT(CASE WHEN score < 0.4 THEN 1 END) AS INT) AS low_count,
                CAST(COUNT(CASE WHEN score IS NULL THEN 1 END) AS INT) AS insuff_count
              FROM facility_scores
            `),
            query(`
              SELECT dimension AS dim, CAST(ROUND(AVG(trust_score) * 100) AS INT) AS avg
              FROM ${TRUST_SIGNALS_TABLE}
              WHERE trust_score IS NOT NULL
              GROUP BY dimension
            `),
            query(`
              WITH facility_scores AS (${facilityScoresSql})
              SELECT
                facility_type AS type,
                CAST(COUNT(*) AS INT) AS count,
                CAST(COALESCE(SUM(has_contradiction), 0) AS INT) AS contradictions
              FROM facility_scores
              WHERE facility_type IS NOT NULL
              GROUP BY facility_type
              ORDER BY count DESC, type
              LIMIT 8
            `),
            query(`
              WITH facility_scores AS (${facilityScoresSql})
              SELECT
                facility_id,
                facility_name,
                state,
                facility_type,
                CAST(score AS STRING) AS overall_trust_score,
                has_contradiction,
                signal_count,
                CAST(ROUND(score * 100) AS INT) AS score
              FROM facility_scores
              WHERE score IS NOT NULL
              ORDER BY score DESC, facility_name
              LIMIT 3
            `),
            query(`
              WITH facility_scores AS (${facilityScoresSql})
              SELECT
                facility_id,
                facility_name,
                state,
                facility_type,
                CAST(score AS STRING) AS overall_trust_score,
                has_contradiction,
                signal_count,
                CAST(ROUND(score * 100) AS INT) AS score
              FROM facility_scores
              WHERE score IS NOT NULL
              ORDER BY score ASC, facility_name
              LIMIT 3
            `),
          ]);

          const summaryRow = sqlResultRows(summary)[0];
          const tierRow = sqlResultRows(tiers)[0];
          const dimRows = new Map(
            sqlResultRows(dims).map((row) => [stringField(row, 'dim'), nullableNumberField(row, 'avg')]),
          );
          res.json({
            total: numberField(summaryRow, 'total'),
            contradictionCount: numberField(summaryRow, 'contradiction_count'),
            avgScore: nullableNumberField(summaryRow, 'avg_score'),
            distribution: sqlResultRows(distribution).map((row) => ({
              label: stringField(row, 'label') ?? '',
              count: numberField(row, 'count'),
              tier: dashboardTier(row.tier),
            })),
            tierData: [
              { name: 'High >=70', value: numberField(tierRow, 'high_count'), tier: 'high' },
              { name: 'Med 40-69', value: numberField(tierRow, 'med_count'), tier: 'med' },
              { name: 'Low <40', value: numberField(tierRow, 'low_count'), tier: 'low' },
              { name: 'Insuff. data', value: numberField(tierRow, 'insuff_count'), tier: 'insuff' },
            ],
            dimAvgs: ['capability', 'equipment', 'procedure', 'completeness']
              .map((dim) => ({ dim, avg: dimRows.get(dim) ?? null })),
            typeBreakdown: sqlResultRows(types).map((row) => ({
              type: stringField(row, 'type') ?? 'Unknown',
              count: numberField(row, 'count'),
              contradictions: numberField(row, 'contradictions'),
            })),
            top3: facilityRows(top),
            bottom3: facilityRows(bottom),
            shortlistedCount: 0,
            flaggedCount: 0,
          });
        } catch (err) {
          console.error('Failed to fetch dashboard:', err);
          res.status(500).json({ error: 'Failed to fetch dashboard' });
        }
      });

      app.get('/api/dashboard/stats', async (_req, res) => {
        try {
          const [totals, tiers, dims, contraByType] = await Promise.all([
            query(`
              SELECT
                CAST(COUNT(DISTINCT f.unique_id) AS INT) AS total_facilities,
                CAST(COUNT(DISTINCT CASE WHEN t.contradiction THEN f.unique_id END) AS INT) AS contradiction_count
              FROM ${FACILITIES_TABLE} f
              LEFT JOIN ${TRUST_SIGNALS_TABLE} t ON f.unique_id = t.facility_id
            `),
            query(`
              WITH facility_scores AS (${facilityScoresSql})
              SELECT
                CAST(COUNT(CASE WHEN score >= 0.7 THEN 1 END) AS INT) AS high_count,
                CAST(COUNT(CASE WHEN score >= 0.4 AND score < 0.7 THEN 1 END) AS INT) AS med_count,
                CAST(COUNT(CASE WHEN score < 0.4 THEN 1 END) AS INT) AS low_count,
                CAST(COUNT(CASE WHEN score IS NULL THEN 1 END) AS INT) AS insuff_count,
                CAST(COUNT(*) AS INT) AS total
              FROM facility_scores
            `),
            query(`
              SELECT dimension, CAST(ROUND(AVG(trust_score) * 100, 1) AS DOUBLE) AS avg_score
              FROM ${TRUST_SIGNALS_TABLE}
              WHERE trust_score IS NOT NULL
              GROUP BY dimension
              ORDER BY avg_score DESC
            `),
            query(`
              SELECT f.facility_type_id AS facility_type,
                CAST(COUNT(DISTINCT f.unique_id) AS INT) AS total,
                CAST(COUNT(DISTINCT CASE WHEN t.contradiction THEN f.unique_id END) AS INT) AS contradictions
              FROM ${FACILITIES_TABLE} f
              LEFT JOIN ${TRUST_SIGNALS_TABLE} t ON f.unique_id = t.facility_id
              WHERE f.facility_type_id IS NOT NULL
              GROUP BY f.facility_type_id
              HAVING COUNT(DISTINCT f.unique_id) > 2
              ORDER BY (COUNT(DISTINCT CASE WHEN t.contradiction THEN f.unique_id END)
                        / NULLIF(COUNT(DISTINCT f.unique_id), 0)) DESC
              LIMIT 1
            `),
          ]);

          const totalRow = sqlResultRows(totals)[0];
          const tierRow = sqlResultRows(tiers)[0] ?? {};
          const dimRows = sqlResultRows(dims);
          const typeRow = sqlResultRows(contraByType)[0];
          const total = numberField(tierRow, 'total', 1) || 1;
          res.json({
            total_facilities: numberField(totalRow, 'total_facilities'),
            contradiction_count: numberField(totalRow, 'contradiction_count'),
            high_trust_pct: Math.round((numberField(tierRow, 'high_count') / total) * 100),
            med_trust_pct: Math.round((numberField(tierRow, 'med_count') / total) * 100),
            low_trust_pct: Math.round((numberField(tierRow, 'low_count') / total) * 100),
            insuff_pct: Math.round((numberField(tierRow, 'insuff_count') / total) * 100),
            top_dimension: stringField(dimRows[0], 'dimension'),
            bottom_dimension: stringField(dimRows[dimRows.length - 1], 'dimension'),
            highest_contradiction_type: stringField(typeRow, 'facility_type'),
          });
        } catch (err) {
          console.error('Failed to fetch dashboard stats:', err);
          res.status(500).json({ error: 'Failed to fetch dashboard stats' });
        }
      });

      app.get('/api/facilities/meta', async (_req, res) => {
        try {
          const [statesResult, typesResult] = await Promise.all([
            query(
              `SELECT DISTINCT address_state_or_region AS state FROM ${FACILITIES_TABLE} WHERE address_state_or_region IS NOT NULL ORDER BY state`,
            ),
            query(
              `SELECT DISTINCT facility_type_id AS facility_type FROM ${FACILITIES_TABLE} WHERE facility_type_id IS NOT NULL ORDER BY facility_type`,
            ),
          ]);
          res.json({
            states: sqlResultRows(statesResult).map((r) => stringField(r, 'state')).filter(Boolean),
            facility_types: sqlResultRows(typesResult).map((r) => stringField(r, 'facility_type')).filter(Boolean),
          });
        } catch (err) {
          console.error('Failed to fetch meta:', err);
          res.status(500).json({ error: 'Failed to fetch filter options' });
        }
      });

      app.get('/api/facilities', async (req, res) => {
        try {
          const q = queryString(req.query.q).toLowerCase();
          const page = Math.max(1, queryInt(req.query.page, 1));
          const limit = Math.min(100, Math.max(1, queryInt(req.query.limit, 25)));
          const offset = (page - 1) * limit;
          const state = queryString(req.query.state);
          const facilityType = queryString(req.query.facility_type);
          const minScore = queryFloat(req.query.min_score, 0) / 100;
          const contradictionsOnly = req.query.contradictions_only === 'true';
          const searchPattern = q ? `%${q}%` : '';

          const result = await query(`
            SELECT
              f.unique_id AS facility_id,
              f.name AS facility_name,
              f.address_state_or_region AS state,
              f.facility_type_id AS facility_type,
              CAST(${adjustedTrustScoreSql} AS STRING) AS overall_trust_score,
              CAST(MAX(CASE WHEN t.contradiction THEN 1 ELSE 0 END) AS INT) AS has_contradiction,
              CAST(COUNT(t.dimension) AS INT) AS signal_count
            FROM ${FACILITIES_TABLE} f
            LEFT JOIN ${TRUST_SIGNALS_TABLE} t ON f.unique_id = t.facility_id
            LEFT JOIN ${QUALITY_SCORES_TABLE} q ON q.facility_id = f.unique_id
            WHERE (:search = '' OR
              LOWER(f.name) LIKE :search OR
              LOWER(f.description) LIKE :search OR
              LOWER(f.address_state_or_region) LIKE :search)
              AND (:state = '' OR f.address_state_or_region = :state)
              AND (:facility_type = '' OR f.facility_type_id = :facility_type)
            GROUP BY f.unique_id, f.name, f.address_state_or_region, f.facility_type_id
            HAVING (:min_score = 0 OR COALESCE(${adjustedTrustScoreSql}, 0) >= :min_score)
               AND (:contradictions_only = false OR MAX(CASE WHEN t.contradiction THEN 1 ELSE 0 END) = 1)
            ORDER BY overall_trust_score DESC NULLS LAST
            LIMIT :limit OFFSET :offset
          `, {
            search: sql.string(searchPattern),
            state: sql.string(state),
            facility_type: sql.string(facilityType),
            min_score: sql.double(minScore),
            contradictions_only: sql.boolean(contradictionsOnly),
            limit: sql.int(limit),
            offset: sql.int(offset),
          });

          res.json(sqlResultRows(result));
        } catch (err) {
          console.error('Failed to search facilities:', err);
          res.status(500).json({ error: 'Failed to search facilities' });
        }
      });

      app.get('/api/facilities/:id', async (req, res) => {
        try {
          const { id } = req.params;
          const [facilityResult, signalsResult] = await Promise.all([
            query(`
              SELECT
                f.unique_id AS facility_id,
                f.name AS facility_name,
                f.facility_type_id AS facility_type,
                f.address_state_or_region AS state,
                f.address_city AS district,
                f.description,
                f.capability,
                f.procedure,
                f.equipment,
                f.capacity,
                f.year_established,
                f.number_doctors,
                f.official_phone,
                f.email,
                f.official_website,
                f.address_line1,
                f.overridden_fields,
                CAST(${adjustedTrustScoreSql} AS STRING) AS overall_trust_score
              FROM ${FACILITIES_TABLE} f
              LEFT JOIN ${TRUST_SIGNALS_TABLE} t ON f.unique_id = t.facility_id
              LEFT JOIN ${QUALITY_SCORES_TABLE} q ON q.facility_id = f.unique_id
              WHERE f.unique_id = :facility_id
              GROUP BY
                f.unique_id,
                f.name,
                f.facility_type_id,
                f.address_state_or_region,
                f.address_city,
                f.description,
                f.capability,
                f.procedure,
                f.equipment,
                f.capacity,
                f.year_established,
                f.number_doctors,
                f.official_phone,
                f.email,
                f.official_website,
                f.address_line1,
                f.overridden_fields
            `, { facility_id: sql.string(id) }),
            query(`
              SELECT
                CAST(0 AS INT) AS id,
                facility_id,
                dimension,
                CAST(trust_score AS STRING) AS trust_score,
                confidence_tier,
                evidence_text,
                source_field,
                contradiction,
                contradiction_detail,
                extraction_model,
                CAST(extracted_at AS STRING) AS extracted_at
              FROM ${TRUST_SIGNALS_TABLE}
              WHERE facility_id = :facility_id
              ORDER BY dimension
            `, { facility_id: sql.string(id) }),
          ]);

          const facilityRowsResult = sqlResultRows(facilityResult);
          if (facilityRowsResult.length === 0) {
            res.status(404).json({ error: 'Facility not found' });
            return;
          }
          res.json({ facility: facilityRowsResult[0], trust_signals: sqlResultRows(signalsResult) });
        } catch (err) {
          console.error('Failed to fetch facility:', err);
          res.status(500).json({ error: 'Failed to fetch facility' });
        }
      });

      app.get('/api/facilities/:id/overrides', (_req, res) => res.json([]));
      app.get('/api/facilities/:id/actions', (_req, res) => res.json([]));

      app.get('/api/review/board/unstarted', async (req, res) => {
        try {
          const limit = Math.min(queryInt(req.query.limit, 500), 2000);
          const result = await query(`
            SELECT
              unique_id AS facility_id,
              name AS facility_name,
              facility_type_id AS facility_type,
              address_state_or_region AS state,
              'not_started' AS status,
              CAST(NULL AS STRING) AS parked_reason,
              CAST(NULL AS STRING) AS assigned_to,
              CAST(NULL AS STRING) AS notes,
              CAST(NULL AS STRING) AS updated_by,
              CAST(NULL AS STRING) AS updated_at
            FROM ${FACILITIES_TABLE}
            ORDER BY name
            LIMIT :limit
          `, { limit: sql.int(limit) });
          res.json(sqlResultRows(result));
        } catch (err) {
          console.error('Failed to fetch unstarted facilities:', err);
          res.status(500).json({ error: 'Failed to fetch unstarted facilities' });
        }
      });

      app.get('/api/review/board', (_req, res) => res.json([]));
      app.get('/api/review/:facilityId', (req, res) => {
        res.json({ facility_id: req.params.facilityId, status: 'not_started', parked_reason: null });
      });

      app.post('/api/facilities/:id/overrides', (_req, res) => readOnly(res));
      app.post('/api/facilities/:id/actions', (_req, res) => readOnly(res));
      app.post('/api/facilities/:id/rerun-trust', (_req, res) => readOnly(res));
      app.post('/api/facilities/:id/cleanup-suggestions', (_req, res) => readOnly(res));
      app.post('/api/review/:facilityId', (_req, res) => readOnly(res));
    });
  },
}).catch(console.error);
