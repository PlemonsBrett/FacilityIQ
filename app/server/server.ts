import { analytics, createApp, lakebase, server, serving, sql } from '@databricks/appkit';
import { z } from 'zod';
import { initializeFacilityIqSchema } from './schemaInit';

const MODEL = 'databricks-meta-llama-3-3-70b-instruct';
const FALLBACK_MODEL = 'databricks-meta-llama-3-1-8b-instruct';
const TRUST_DIMENSIONS = ['capability', 'equipment', 'procedure', 'completeness'] as const;
const CLEANUP_FIELDS = [
  'name',
  'facility_type_id',
  'address_city',
  'address_state_or_region',
  'description',
  'capability',
  'equipment',
  'procedure',
  'capacity',
  'year_established',
] as const;

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
        - ((100 - COALESCE(q.quality_score, 100)) / 400.0)
      )),
      CASE WHEN MAX(r.status) = 'validation_complete' THEN 1 ELSE 0.90 END
    )
  END
`;

const facilityScoresSql = `
  SELECT
    f.unique_id AS facility_id,
    f.name AS facility_name,
    f.address_state_or_region AS state,
    f.facility_type_id AS facility_type,
    ${adjustedTrustScoreSql}::real AS score,
    MAX(CASE WHEN t.contradiction THEN 1 ELSE 0 END)::int AS has_contradiction,
    COUNT(t.dimension)::int AS signal_count
  FROM public.facilities f
  LEFT JOIN public.facilities_trust_signals t ON f.unique_id = t.facility_id
  LEFT JOIN public.facilities_quality_scores q ON q.facility_id = f.unique_id
  LEFT JOIN facilityiq.facility_review r ON r.facility_id = f.unique_id
  GROUP BY f.unique_id, f.name, f.address_state_or_region, f.facility_type_id, q.quality_score
`;

const trustSignalSchema = z.object({
  dimension: z.enum(TRUST_DIMENSIONS),
  trust_score: z.number().min(0).max(1).nullable(),
  confidence_tier: z.enum(['high', 'medium', 'low', 'insufficient_data']),
  evidence_text: z.string().nullable(),
  source_field: z.string().nullable(),
  contradiction: z.boolean(),
  contradiction_detail: z.string().nullable(),
});

const cleanupSuggestionSchema = z.object({
  field_name: z.enum(CLEANUP_FIELDS),
  current_value: z.string().nullable(),
  suggested_value: z.string().min(1),
  reason: z.string().min(1),
  confidence: z.enum(['high', 'medium', 'low']),
});

const cleanupResponseSchema = z.object({
  suggestions: z.array(cleanupSuggestionSchema),
});

function stringifyValue(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null;
  return typeof value === 'string' ? value : JSON.stringify(value);
}

function sqlResultRows(result: unknown): Array<Record<string, unknown>> {
  const maybeRows = (result as { rows?: Array<Record<string, unknown>> })?.rows;
  if (Array.isArray(maybeRows)) return maybeRows;

  const payload = result as {
    data_array?: unknown[][];
    schema?: { columns?: Array<{ name?: string }> };
    manifest?: { schema?: { columns?: Array<{ name?: string }> } };
  };
  const data = payload.data_array;
  const columns = payload.schema?.columns ?? payload.manifest?.schema?.columns ?? [];
  if (!Array.isArray(data) || columns.length === 0) return [];
  return data.map((row) => {
    const out: Record<string, unknown> = {};
    columns.forEach((col, idx) => {
      if (col.name) out[col.name] = row[idx];
    });
    return out;
  });
}

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

function stringField(row: Record<string, unknown>, key: string): string | null {
  const value = row[key];
  return typeof value === 'string' ? value : null;
}

function dashboardTier(value: unknown): 'high' | 'med' | 'low' | 'insuff' {
  return value === 'high' || value === 'med' || value === 'low' || value === 'insuff'
    ? value
    : 'insuff';
}

function buildCleanupPrompt(current: Record<string, unknown>, bronze: Record<string, unknown>): string {
  const compact = (row: Record<string, unknown>) => JSON.stringify(row, (_key, value) => {
    if (typeof value === 'string' && value.length > 2500) return `${value.slice(0, 2500)}...`;
    return value;
  }, 2);

  return `Use the bronze/raw record to suggest cleanup edits for the current healthcare facility record.

Only suggest edits when the bronze/raw data clearly supports a better normalized value.
Do not invent phone, email, website, address, capacity, or year values.
Prefer concise human-readable values. Remove obvious JSON escaping noise, duplicate fragments, empty strings, irrelevant unrelated facilities, and camelCase specialty tokens when they are being used as display text.
For arrays in bronze fields, summarize into readable comma-separated text only if the current field is messy or blank.

Allowed field_name values:
${CLEANUP_FIELDS.map((field) => `- ${field}`).join('\n')}

Current app record:
${compact(current)}

Bronze/raw record:
${compact(bronze)}

Return this exact JSON (no markdown, no extra keys):
{
  "suggestions": [
    {
      "field_name": "<one allowed field_name>",
      "current_value": "<current value or null>",
      "suggested_value": "<replacement value>",
      "reason": "<short reason grounded in bronze/raw data>",
      "confidence": "<high|medium|low>"
    }
  ]
}`;
}

function normalizeCleanupSuggestions(raw: unknown) {
  const parsed = cleanupResponseSchema.parse(raw);
  const seen = new Set<string>();
  return parsed.suggestions
    .filter((suggestion) => {
      const value = suggestion.suggested_value.trim();
      if (!value || seen.has(suggestion.field_name)) return false;
      seen.add(suggestion.field_name);
      return value !== (suggestion.current_value ?? '').trim();
    })
    .map((suggestion) => ({
      ...suggestion,
      suggested_value: suggestion.suggested_value.trim(),
      current_value: suggestion.current_value?.trim() || null,
      reason: suggestion.reason.trim(),
    }))
    .slice(0, 8);
}

function buildTrustPrompt(facility: Record<string, unknown>): string {
  const value = (key: string, fallback = 'N/A') => {
    const raw = facility[key];
    return raw === null || raw === undefined || raw === '' ? fallback : String(raw);
  };

  return `Analyze this healthcare facility and return a trust assessment for four dimensions.

STRUCTURED FIELDS:
facility_id: ${value('facility_id')}
facility_type: ${value('facility_type')}
state: ${value('state')}
capacity: ${value('capacity', 'NOT PROVIDED')}
year_established: ${value('year_established', 'NOT PROVIDED')}

FREE TEXT FIELDS:
description: ${value('description', '').slice(0, 1500)}
capability: ${value('capability', '').slice(0, 800)}
procedure: ${value('procedure', '').slice(0, 800)}
equipment: ${value('equipment', '').slice(0, 800)}

Return this exact JSON (no extra keys, no markdown):
{
  "dimensions": [
    {
      "dimension": "capability",
      "trust_score": <0.0-1.0 or null>,
      "confidence_tier": "<high|medium|low|insufficient_data>",
      "evidence_text": "<exact quote from source, or null>",
      "source_field": "<field name or null>",
      "contradiction": <true|false>,
      "contradiction_detail": "<explanation or null>"
    },
    {
      "dimension": "equipment",
      "trust_score": <0.0-1.0 or null>,
      "confidence_tier": "<high|medium|low|insufficient_data>",
      "evidence_text": "<exact quote from source, or null>",
      "source_field": "<field name or null>",
      "contradiction": <true|false>,
      "contradiction_detail": "<explanation or null>"
    },
    {
      "dimension": "procedure",
      "trust_score": <0.0-1.0 or null>,
      "confidence_tier": "<high|medium|low|insufficient_data>",
      "evidence_text": "<exact quote from source, or null>",
      "source_field": "<field name or null>",
      "contradiction": <true|false>,
      "contradiction_detail": "<explanation or null>"
    },
    {
      "dimension": "completeness",
      "trust_score": null,
      "confidence_tier": "insufficient_data",
      "evidence_text": "capacity and year_established have <25% and 48% dataset coverage respectively",
      "source_field": null,
      "contradiction": false,
      "contradiction_detail": null
    }
  ]
}`;
}

function extractJsonObject(text: string): unknown {
  const cleaned = text.trim().replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start >= 0 && end > start) {
      return JSON.parse(cleaned.slice(start, end + 1));
    }
    throw new Error('Model response did not contain valid JSON');
  }
}

function normalizeSignals(raw: unknown) {
  const parsed = z.object({ dimensions: z.array(trustSignalSchema) }).parse(raw);
  const byDimension = new Map(parsed.dimensions.map((s) => [s.dimension, s]));
  return TRUST_DIMENSIONS.map((dimension) => {
    const signal = byDimension.get(dimension);
    if (signal) return signal;
    return {
      dimension,
      trust_score: null,
      confidence_tier: 'insufficient_data' as const,
      evidence_text: null,
      source_field: null,
      contradiction: false,
      contradiction_detail: null,
    };
  });
}

function adjustedScoreFromSignals(
  facility: Record<string, unknown>,
  signals: ReturnType<typeof normalizeSignals>,
): number | null {
  const scored = signals
    .map((s) => s.trust_score)
    .filter((score): score is number => typeof score === 'number');
  if (scored.length === 0) return null;

  const avg = scored.reduce((sum, score) => sum + score, 0) / scored.length;
  const blankCoreFields = [
    'official_phone',
    'email',
    'official_website',
    'year_established',
    'capacity',
    'number_doctors',
    'description',
  ].filter((field) => facility[field] === null || facility[field] === undefined || facility[field] === '').length;
  const qualityScore = typeof facility.quality_score === 'number'
    ? facility.quality_score
    : Number(facility.quality_score ?? 100);
  const reviewStatus = String(facility.review_status ?? '');
  const cap = reviewStatus === 'validation_complete' ? 1 : 0.9;
  const adjusted = avg
    - (Math.max(0, 3 - scored.length) * 0.10)
    - (blankCoreFields * 0.03)
    - ((100 - (Number.isFinite(qualityScore) ? qualityScore : 100)) / 400);

  return Math.max(0, Math.min(1, cap, adjusted));
}

createApp({
  plugins: [
    lakebase(),
    analytics({}),
    server(),
    serving({
      endpoints: {
        llm: { env: 'DATABRICKS_SERVING_ENDPOINT_NAME' },
        fallback: { env: 'DATABRICKS_FALLBACK_SERVING_ENDPOINT_NAME' },
      },
    }),
  ],
  async onPluginsReady(appkit) {
    try {
      await initializeFacilityIqSchema(appkit.lakebase);
      console.log('[facilityiq] Tables ready in facilityiq schema');
    } catch (err) {
      console.error('[facilityiq] Schema init failed:', (err as Error).message);
      throw err;
    }

    appkit.server.extend((app) => {

      // GET /api/dashboard — live dashboard aggregates from Lakebase synced tables
      app.get('/api/dashboard', async (req, res) => {
        try {
          const analystId = typeof req.query.analyst_id === 'string' ? req.query.analyst_id : '';
          const [summary, distribution, tiers, dims, types, top, bottom, actions] = await Promise.all([
            appkit.lakebase.query(`
              WITH facility_scores AS (${facilityScoresSql})
              SELECT
                COUNT(*)::int AS total,
                COALESCE(SUM(has_contradiction), 0)::int AS contradiction_count,
                ROUND(AVG(score)::numeric * 100)::int AS avg_score
              FROM facility_scores
            `),
            appkit.lakebase.query(`
              WITH facility_scores AS (${facilityScoresSql}),
              buckets(label, min_score, max_score, tier, sort_order) AS (
                VALUES
                  ('0-29', 0, 29, 'low', 1),
                  ('30-39', 30, 39, 'low', 2),
                  ('40-49', 40, 49, 'med', 3),
                  ('50-59', 50, 59, 'med', 4),
                  ('60-69', 60, 69, 'med', 5),
                  ('70-79', 70, 79, 'high', 6),
                  ('80-89', 80, 89, 'high', 7),
                  ('90-100', 90, 100, 'high', 8)
              )
              SELECT b.label, COUNT(fs.facility_id)::int AS count, b.tier
              FROM buckets b
              LEFT JOIN facility_scores fs
                ON fs.score IS NOT NULL
               AND ROUND(fs.score::numeric * 100)::int BETWEEN b.min_score AND b.max_score
              GROUP BY b.label, b.tier, b.sort_order
              ORDER BY b.sort_order
            `),
            appkit.lakebase.query(`
              WITH facility_scores AS (${facilityScoresSql})
              SELECT
                COUNT(CASE WHEN score >= 0.7 THEN 1 END)::int AS high_count,
                COUNT(CASE WHEN score >= 0.4 AND score < 0.7 THEN 1 END)::int AS med_count,
                COUNT(CASE WHEN score < 0.4 THEN 1 END)::int AS low_count,
                COUNT(CASE WHEN score IS NULL THEN 1 END)::int AS insuff_count
              FROM facility_scores
            `),
            appkit.lakebase.query(`
              SELECT dimension AS dim, ROUND(AVG(trust_score)::numeric * 100)::int AS avg
              FROM public.facilities_trust_signals
              WHERE trust_score IS NOT NULL
              GROUP BY dimension
            `),
            appkit.lakebase.query(`
              WITH facility_scores AS (${facilityScoresSql})
              SELECT
                facility_type AS type,
                COUNT(*)::int AS count,
                COALESCE(SUM(has_contradiction), 0)::int AS contradictions
              FROM facility_scores
              WHERE facility_type IS NOT NULL
              GROUP BY facility_type
              ORDER BY count DESC, type
              LIMIT 8
            `),
            appkit.lakebase.query(`
              WITH facility_scores AS (${facilityScoresSql})
              SELECT
                facility_id,
                facility_name,
                state,
                facility_type,
                score::text AS overall_trust_score,
                has_contradiction,
                signal_count,
                ROUND(score::numeric * 100)::int AS score
              FROM facility_scores
              WHERE score IS NOT NULL
              ORDER BY score DESC, facility_name
              LIMIT 3
            `),
            appkit.lakebase.query(`
              WITH facility_scores AS (${facilityScoresSql})
              SELECT
                facility_id,
                facility_name,
                state,
                facility_type,
                score::text AS overall_trust_score,
                has_contradiction,
                signal_count,
                ROUND(score::numeric * 100)::int AS score
              FROM facility_scores
              WHERE score IS NOT NULL
              ORDER BY score ASC, facility_name
              LIMIT 3
            `),
            appkit.lakebase.query(`
              WITH latest AS (
                SELECT DISTINCT ON (facility_id, action_type, COALESCE(dimension, ''))
                  facility_id, action_type, dimension, content, updated_at
                FROM facilityiq.user_actions
                WHERE analyst_id = $1
                ORDER BY facility_id, action_type, COALESCE(dimension, ''), updated_at DESC
              )
              SELECT
                COUNT(DISTINCT CASE WHEN action_type = 'shortlist' AND content = 'added' THEN facility_id END)::int AS shortlisted_count,
                COUNT(DISTINCT CASE WHEN action_type = 'flag' AND content = 'flagged' THEN facility_id END)::int AS flagged_count
              FROM latest
            `, [analystId]),
          ]);

          const summaryRow = sqlResultRows(summary)[0];
          const tierRow = sqlResultRows(tiers)[0];
          const actionRow = sqlResultRows(actions)[0];
          const dimRows = new Map(
            sqlResultRows(dims).map((row) => [stringField(row, 'dim'), nullableNumberField(row, 'avg')]),
          );
          const distributionRows = sqlResultRows(distribution).map((row) => ({
            label: stringField(row, 'label') ?? '',
            count: numberField(row, 'count'),
            tier: dashboardTier(row.tier),
          }));
          const typeRows = sqlResultRows(types).map((row) => ({
            type: stringField(row, 'type') ?? 'Unknown',
            count: numberField(row, 'count'),
            contradictions: numberField(row, 'contradictions'),
          }));
          const facilityRows = (rows: unknown) => sqlResultRows(rows).map((row) => ({
            facility_id: stringField(row, 'facility_id') ?? '',
            facility_name: stringField(row, 'facility_name') ?? '',
            state: stringField(row, 'state'),
            facility_type: stringField(row, 'facility_type'),
            overall_trust_score: stringField(row, 'overall_trust_score'),
            has_contradiction: numberField(row, 'has_contradiction'),
            signal_count: numberField(row, 'signal_count'),
            score: nullableNumberField(row, 'score'),
          }));

          res.json({
            total: numberField(summaryRow, 'total'),
            contradictionCount: numberField(summaryRow, 'contradiction_count'),
            avgScore: nullableNumberField(summaryRow, 'avg_score'),
            distribution: distributionRows,
            tierData: [
              { name: 'High >=70', value: numberField(tierRow, 'high_count'), tier: 'high' },
              { name: 'Med 40-69', value: numberField(tierRow, 'med_count'), tier: 'med' },
              { name: 'Low <40', value: numberField(tierRow, 'low_count'), tier: 'low' },
              { name: 'Insuff. data', value: numberField(tierRow, 'insuff_count'), tier: 'insuff' },
            ],
            dimAvgs: TRUST_DIMENSIONS.map((dim) => ({ dim, avg: dimRows.get(dim) ?? null })),
            typeBreakdown: typeRows,
            top3: facilityRows(top),
            bottom3: facilityRows(bottom),
            shortlistedCount: numberField(actionRow, 'shortlisted_count'),
            flaggedCount: numberField(actionRow, 'flagged_count'),
          });
        } catch (err) {
          console.error('Failed to fetch dashboard:', err);
          res.status(500).json({ error: 'Failed to fetch dashboard' });
        }
      });

      // GET /api/dashboard/stats — summary metrics for tour dynamic copy
      app.get('/api/dashboard/stats', async (_req, res) => {
        try {
          const [totals, tiers, dims, contraByType] = await Promise.all([
            appkit.lakebase.query(`
              SELECT
                COUNT(DISTINCT f.unique_id)::int AS total_facilities,
                COUNT(DISTINCT CASE WHEN t.contradiction THEN f.unique_id END)::int AS contradiction_count
              FROM public.facilities f
              LEFT JOIN public.facilities_trust_signals t ON f.unique_id = t.facility_id
            `),
            appkit.lakebase.query(`
              SELECT
                COUNT(CASE WHEN avg_score >= 0.7  THEN 1 END)::int AS high_count,
                COUNT(CASE WHEN avg_score >= 0.4 AND avg_score < 0.7 THEN 1 END)::int AS med_count,
                COUNT(CASE WHEN avg_score < 0.4   THEN 1 END)::int AS low_count,
                COUNT(CASE WHEN avg_score IS NULL  THEN 1 END)::int AS insuff_count,
                COUNT(*)::int AS total
              FROM (
                SELECT f.unique_id AS facility_id, ${adjustedTrustScoreSql} AS avg_score
                FROM public.facilities f
                LEFT JOIN public.facilities_trust_signals t ON f.unique_id = t.facility_id
                LEFT JOIN public.facilities_quality_scores q ON q.facility_id = f.unique_id
                LEFT JOIN facilityiq.facility_review r ON r.facility_id = f.unique_id
                GROUP BY f.unique_id, q.quality_score
              ) x
            `),
            appkit.lakebase.query(`
              SELECT dimension, ROUND(AVG(trust_score)::numeric * 100, 1)::real AS avg_score
              FROM public.facilities_trust_signals
              WHERE trust_score IS NOT NULL
              GROUP BY dimension
              ORDER BY avg_score DESC
            `),
            appkit.lakebase.query(`
              SELECT f.facility_type_id AS facility_type,
                COUNT(DISTINCT f.unique_id)::int AS total,
                COUNT(DISTINCT CASE WHEN t.contradiction THEN f.unique_id END)::int AS contradictions
              FROM public.facilities f
              LEFT JOIN public.facilities_trust_signals t ON f.unique_id = t.facility_id
              WHERE f.facility_type_id IS NOT NULL
              GROUP BY f.facility_type_id
              HAVING COUNT(DISTINCT f.unique_id) > 2
              ORDER BY (COUNT(DISTINCT CASE WHEN t.contradiction THEN f.unique_id END)::float
                        / NULLIF(COUNT(DISTINCT f.unique_id), 0)) DESC
              LIMIT 1
            `),
          ]);

          const tierRow = tiers.rows[0] ?? {};
          const total = (tierRow.total as number) || 1;

          res.json({
            total_facilities: (totals.rows[0]?.total_facilities as number) ?? 0,
            contradiction_count: (totals.rows[0]?.contradiction_count as number) ?? 0,
            high_trust_pct: Math.round(((tierRow.high_count as number ?? 0) / total) * 100),
            med_trust_pct: Math.round(((tierRow.med_count as number ?? 0) / total) * 100),
            low_trust_pct: Math.round(((tierRow.low_count as number ?? 0) / total) * 100),
            insuff_pct: Math.round(((tierRow.insuff_count as number ?? 0) / total) * 100),
            top_dimension: (dims.rows[0]?.dimension as string) ?? null,
            bottom_dimension: (dims.rows[dims.rows.length - 1]?.dimension as string) ?? null,
            highest_contradiction_type: (contraByType.rows[0]?.facility_type as string) ?? null,
          });
        } catch (err) {
          console.error('Failed to fetch dashboard stats:', err);
          res.status(500).json({ error: 'Failed to fetch dashboard stats' });
        }
      });

      // GET /api/facilities/meta — MUST be before /api/facilities/:id
      app.get('/api/facilities/meta', async (_req, res) => {
        try {
          const [statesResult, typesResult] = await Promise.all([
            appkit.lakebase.query(
              `SELECT DISTINCT address_state_or_region AS state FROM public.facilities WHERE address_state_or_region IS NOT NULL ORDER BY address_state_or_region`
            ),
            appkit.lakebase.query(
              `SELECT DISTINCT facility_type_id AS facility_type FROM public.facilities WHERE facility_type_id IS NOT NULL ORDER BY facility_type_id`
            ),
          ]);
          res.json({
            states: statesResult.rows.map((r) => r.state),
            facility_types: typesResult.rows.map((r) => r.facility_type),
          });
        } catch (err) {
          console.error('Failed to fetch meta:', err);
          res.status(500).json({ error: 'Failed to fetch filter options' });
        }
      });

      // GET /api/facilities?q=&page=1&limit=25&state=&facility_type=&min_score=0&contradictions_only=false
      app.get('/api/facilities', async (req, res) => {
        try {
          const q = String(req.query.q ?? '');
          const page = Math.max(1, parseInt(String(req.query.page ?? '1')));
          const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? '25'))));
          const offset = (page - 1) * limit;
          const state = String(req.query.state ?? '');
          const facility_type = String(req.query.facility_type ?? '');
          const min_score = parseFloat(String(req.query.min_score ?? '0')) / 100;
          const contradictions_only = req.query.contradictions_only === 'true';
          const search = q ? `%${q}%` : null;

          const { rows } = await appkit.lakebase.query(`
            SELECT
              f.unique_id                          AS facility_id,
              f.name                               AS facility_name,
              f.address_state_or_region            AS state,
              f.facility_type_id                   AS facility_type,
              ${adjustedTrustScoreSql}::real        AS overall_trust_score,
              MAX(CASE WHEN t.contradiction THEN 1 ELSE 0 END)::int AS has_contradiction,
              COUNT(t.dimension)::int              AS signal_count
            FROM public.facilities f
            LEFT JOIN public.facilities_trust_signals t ON f.unique_id = t.facility_id
            LEFT JOIN public.facilities_quality_scores q ON q.facility_id = f.unique_id
            LEFT JOIN facilityiq.facility_review r ON r.facility_id = f.unique_id
            WHERE ($1::text IS NULL OR
              f.name ILIKE $1 OR
              f.description ILIKE $1 OR
              f.address_state_or_region ILIKE $1)
              AND ($2::text = '' OR f.address_state_or_region = $2)
              AND ($3::text = '' OR f.facility_type_id = $3)
            GROUP BY f.unique_id, f.name, f.address_state_or_region, f.facility_type_id, q.quality_score
            HAVING ($4 = 0 OR COALESCE(${adjustedTrustScoreSql}, 0) >= $4)
               AND ($5 = false OR MAX(CASE WHEN t.contradiction THEN 1 ELSE 0 END) = 1)
            ORDER BY overall_trust_score DESC NULLS LAST
            LIMIT $6 OFFSET $7
          `, [search, state, facility_type, min_score, contradictions_only, limit, offset]);

          res.json(rows);
        } catch (err) {
          console.error('Failed to search facilities:', err);
          res.status(500).json({ error: 'Failed to search facilities' });
        }
      });

      // GET /api/facilities/:id
      app.get('/api/facilities/:id', async (req, res) => {
        try {
          const { id } = req.params;
          const [fr, sr] = await Promise.all([
            appkit.lakebase.query(
              `WITH latest_reruns AS (
                 SELECT DISTINCT ON (dimension)
                        facility_id,
                        dimension,
                        trust_score,
                        confidence_tier,
                        evidence_text,
                        source_field,
                        contradiction,
                        contradiction_detail,
                        extraction_model,
                        created_at AS extracted_at
                 FROM facilityiq.trust_signal_reruns
                 WHERE facility_id = $1
                 ORDER BY dimension, created_at DESC
               ),
               t AS (
                 SELECT * FROM latest_reruns
                 UNION ALL
                 SELECT
                        p.facility_id,
                        p.dimension,
                        p.trust_score,
                        p.confidence_tier,
                        p.evidence_text,
                        p.source_field,
                        p.contradiction,
                        p.contradiction_detail,
                        p.extraction_model,
                        p.extracted_at
                 FROM public.facilities_trust_signals p
                 WHERE p.facility_id = $1
                   AND NOT EXISTS (
                     SELECT 1 FROM latest_reruns r
                     WHERE r.dimension = p.dimension
                   )
               )
               SELECT
                      f.unique_id                  AS facility_id,
                      f.name                       AS facility_name,
                      f.facility_type_id           AS facility_type,
                      f.address_state_or_region    AS state,
                      f.address_city               AS district,
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
                      ${adjustedTrustScoreSql}::real AS overall_trust_score
               FROM public.facilities f
               LEFT JOIN t ON f.unique_id = t.facility_id
               LEFT JOIN public.facilities_quality_scores q ON q.facility_id = f.unique_id
               LEFT JOIN facilityiq.facility_review r ON r.facility_id = f.unique_id
               WHERE f.unique_id = $1
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
                      f.overridden_fields,
                      q.quality_score`, [id]),
            appkit.lakebase.query(
              `WITH latest_reruns AS (
                 SELECT DISTINCT ON (dimension)
                        facility_id,
                        dimension,
                        trust_score,
                        confidence_tier,
                        evidence_text,
                        source_field,
                        contradiction,
                        contradiction_detail,
                        extraction_model,
                        created_at AS extracted_at
                 FROM facilityiq.trust_signal_reruns
                 WHERE facility_id = $1
                 ORDER BY dimension, created_at DESC
               )
               SELECT
                      0::int AS id,
                      facility_id,
                      dimension,
                      trust_score,
                      confidence_tier,
                      evidence_text,
                      source_field,
                      contradiction,
                      contradiction_detail,
                      extraction_model,
                      extracted_at
               FROM latest_reruns
               UNION ALL
               SELECT
                      0::int AS id,
                      p.facility_id,
                      p.dimension,
                      p.trust_score,
                      p.confidence_tier,
                      p.evidence_text,
                      p.source_field,
                      p.contradiction,
                      p.contradiction_detail,
                      p.extraction_model,
                      p.extracted_at
               FROM public.facilities_trust_signals p
               WHERE p.facility_id = $1
                 AND NOT EXISTS (
                   SELECT 1 FROM latest_reruns r
                   WHERE r.dimension = p.dimension
                 )
               ORDER BY dimension`, [id]),
          ]);
          if (fr.rows.length === 0) {
            res.status(404).json({ error: 'Facility not found' });
            return;
          }
          res.json({ facility: fr.rows[0], trust_signals: sr.rows });
        } catch (err) {
          console.error('Failed to fetch facility:', err);
          res.status(500).json({ error: 'Failed to fetch facility' });
        }
      });

      // GET /api/facilities/:id/overrides — latest value per field (for UI merge)
      app.get('/api/facilities/:id/overrides', async (req, res) => {
        try {
          const { id } = req.params;
          const { rows } = await appkit.lakebase.query(`
            SELECT DISTINCT ON (field_name)
              field_name, new_value, analyst_id, reason, updated_at
            FROM facilityiq.facilities_overrides
            WHERE facility_id = $1
            ORDER BY field_name, updated_at DESC
          `, [id]);
          res.json(rows);
        } catch (err) {
          console.error('Failed to fetch overrides:', err);
          res.status(500).json({ error: 'Failed to fetch overrides' });
        }
      });

      // POST /api/facilities/:id/overrides — write a field-level correction
      app.post('/api/facilities/:id/overrides', async (req, res) => {
        try {
          const { id } = req.params;
          const schema = z.object({
            field_name: z.string().min(1),
            new_value:  z.string(),
            analyst_id: z.string(),
            reason:     z.string().min(1),
          });
          const parsed = schema.safeParse(req.body);
          if (!parsed.success) {
            res.status(400).json({ error: parsed.error.flatten() });
            return;
          }
          const { field_name, new_value, analyst_id, reason } = parsed.data;
          await appkit.lakebase.query(`
            INSERT INTO facilityiq.facilities_overrides
              (facility_id, field_name, new_value, analyst_id, reason)
            VALUES ($1, $2, $3, $4, $5)
          `, [id, field_name, new_value, analyst_id, reason]);
          res.status(201).json({ facility_id: id, field_name, new_value });
        } catch (err) {
          console.error('Failed to save override:', err);
          res.status(500).json({ error: 'Failed to save override' });
        }
      });

      // POST /api/facilities/:id/cleanup-suggestions — use bronze/raw UC data to suggest field edits
      app.post('/api/facilities/:id/cleanup-suggestions', async (req, res) => {
        try {
          const { id } = req.params;
          const schema = z.object({
            analyst_id: z.string().min(1),
          });
          const parsed = schema.safeParse(req.body ?? {});
          if (!parsed.success) {
            res.status(400).json({ error: parsed.error.flatten() });
            return;
          }

          const [currentResult, overridesResult, bronzeResult] = await Promise.all([
            appkit.lakebase.query(`
              SELECT
                f.unique_id AS facility_id,
                f.name,
                f.facility_type_id,
                f.address_city,
                f.address_state_or_region,
                f.description,
                f.capability,
                f.equipment,
                f.procedure,
                f.capacity,
                f.year_established
              FROM public.facilities f
              WHERE f.unique_id = $1
            `, [id]),
            appkit.lakebase.query(`
              SELECT DISTINCT ON (field_name) field_name, new_value
              FROM facilityiq.facilities_overrides
              WHERE facility_id = $1
              ORDER BY field_name, updated_at DESC
            `, [id]),
            appkit.analytics.query(`
              SELECT
                facility_id,
                facility_name,
                facility_type,
                state,
                district,
                description,
                capability,
                procedure,
                equipment,
                capacity,
                year_established,
                latitude,
                longitude,
                specialties
              FROM workspace.facilityiq.facilities_raw
              WHERE facility_id = :facility_id
              LIMIT 1
            `, { facility_id: sql.string(id) }),
          ]);

          if (currentResult.rows.length === 0) {
            res.status(404).json({ error: 'Facility not found' });
            return;
          }

          const bronzeRows = sqlResultRows(bronzeResult);
          if (bronzeRows.length === 0) {
            res.status(404).json({ error: 'Bronze facility row not found' });
            return;
          }

          const current = { ...(currentResult.rows[0] as Record<string, unknown>) };
          for (const row of overridesResult.rows as Array<{ field_name: string; new_value: string }>) {
            current[row.field_name] = row.new_value;
          }

          const bronzeRaw = bronzeRows[0];
          const bronze = {
            facility_id: bronzeRaw.facility_id,
            name: bronzeRaw.facility_name,
            facility_type_id: bronzeRaw.facility_type,
            address_city: bronzeRaw.district,
            address_state_or_region: bronzeRaw.state,
            description: bronzeRaw.description,
            capability: bronzeRaw.capability,
            procedure: bronzeRaw.procedure,
            equipment: bronzeRaw.equipment,
            capacity: bronzeRaw.capacity,
            year_established: bronzeRaw.year_established,
            latitude: bronzeRaw.latitude,
            longitude: bronzeRaw.longitude,
            specialties: bronzeRaw.specialties,
          };

          const messages: { role: 'user' | 'assistant'; content: string }[] = [
            {
              role: 'user',
              content: `You are a healthcare facility data cleaning assistant.

RULES:
- Return only valid JSON.
- Suggest conservative field-level edits only when the bronze/raw row clearly supports them.
- Do not fabricate missing contact information, addresses, capacity, year, or clinical claims.
- Keep suggestions concise and analyst-readable.
- Do not suggest values that are identical to the current value.

${buildCleanupPrompt(current, bronze)}`,
            },
          ];

          async function invokeCleanupModel(alias: 'llm' | 'fallback', model: string) {
            const result = await appkit.serving(alias).asUser(req).invoke({
              messages,
              temperature: 0.0,
              max_tokens: 1400,
            });
            const maybeExecution = result as { ok?: boolean; status?: number; message?: string; data?: unknown };
            if (maybeExecution.ok === false) {
              throw new Error(maybeExecution.message ?? `Model invocation failed with ${maybeExecution.status}`);
            }
            const data = maybeExecution.ok === true ? maybeExecution.data : result;
            const content = (data as { choices?: Array<{ message?: { content?: string } }> })
              ?.choices?.[0]?.message?.content;
            if (!content) throw new Error(`${model} returned no message content`);
            return { model, suggestions: normalizeCleanupSuggestions(extractJsonObject(content)) };
          }

          let cleaned: { model: string; suggestions: ReturnType<typeof normalizeCleanupSuggestions> };
          try {
            cleaned = await invokeCleanupModel('llm', MODEL);
          } catch (primaryErr) {
            console.warn('[facilityiq] Primary cleanup model failed:', (primaryErr as Error).message);
            cleaned = await invokeCleanupModel('fallback', FALLBACK_MODEL);
          }

          res.status(201).json({
            facility_id: id,
            extraction_model: cleaned.model,
            source: 'workspace.facilityiq.facilities_raw',
            suggestions: cleaned.suggestions.map((suggestion) => ({
              ...suggestion,
              current_value: suggestion.current_value ?? stringifyValue(current[suggestion.field_name]),
            })),
          });
        } catch (err) {
          console.error('Failed to generate cleanup suggestions:', err);
          res.status(500).json({ error: (err as Error).message || 'Failed to generate cleanup suggestions' });
        }
      });

      // POST /api/facilities/:id/rerun-trust — refresh trust dimensions from current edited data
      app.post('/api/facilities/:id/rerun-trust', async (req, res) => {
        try {
          const { id } = req.params;
          const schema = z.object({
            analyst_id: z.string().min(1),
            reason: z.enum(['edited', 'verified', 'manual']).default('manual'),
          });
          const parsed = schema.safeParse(req.body ?? {});
          if (!parsed.success) {
            res.status(400).json({ error: parsed.error.flatten() });
            return;
          }
          const { analyst_id, reason } = parsed.data;

          const [facilityResult, overridesResult] = await Promise.all([
            appkit.lakebase.query(`
              SELECT
                f.unique_id AS facility_id,
                f.name AS facility_name,
                f.facility_type_id AS facility_type,
                f.address_state_or_region AS state,
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
                COALESCE(q.quality_score, 100) AS quality_score,
                r.status AS review_status
              FROM public.facilities f
              LEFT JOIN public.facilities_quality_scores q ON q.facility_id = f.unique_id
              LEFT JOIN facilityiq.facility_review r ON r.facility_id = f.unique_id
              WHERE f.unique_id = $1
            `, [id]),
            appkit.lakebase.query(`
              SELECT DISTINCT ON (field_name) field_name, new_value
              FROM facilityiq.facilities_overrides
              WHERE facility_id = $1
              ORDER BY field_name, updated_at DESC
            `, [id]),
          ]);

          if (facilityResult.rows.length === 0) {
            res.status(404).json({ error: 'Facility not found' });
            return;
          }

          const facility = { ...(facilityResult.rows[0] as Record<string, unknown>) };
          for (const row of overridesResult.rows as Array<{ field_name: string; new_value: string }>) {
            const target =
              row.field_name === 'name' ? 'facility_name' :
              row.field_name === 'facility_type_id' ? 'facility_type' :
              row.field_name === 'address_state_or_region' ? 'state' :
              row.field_name;
            facility[target] = row.new_value;
          }

          const messages: { role: 'user' | 'assistant'; content: string }[] = [
            {
              role: 'user' as const,
              content: `You are a healthcare facility data analyst. Evaluate a facility record and assess trustworthiness of its claims.

RULES:
- Only cite text that actually appears in the source fields. Never invent or infer.
- Return "insufficient_data" confidence_tier if evidence is absent or field coverage is too low.
- capacity and year_established ALWAYS get confidence_tier "insufficient_data" and trust_score null — no exceptions.
- Flag contradictions where a structured field directly conflicts with free text.
- Respond ONLY with valid JSON. No markdown fences, no preamble.

${buildTrustPrompt(facility)}`,
            },
          ];

          async function invokeModel(alias: 'llm' | 'fallback', model: string) {
            const result = await appkit.serving(alias).asUser(req).invoke({
              messages,
              temperature: 0.0,
              max_tokens: 1024,
            });
            const maybeExecution = result as { ok?: boolean; status?: number; message?: string; data?: unknown };
            if (maybeExecution.ok === false) {
              throw new Error(maybeExecution.message ?? `Model invocation failed with ${maybeExecution.status}`);
            }
            const data = maybeExecution.ok === true ? maybeExecution.data : result;
            const content = (data as { choices?: Array<{ message?: { content?: string } }> })
              ?.choices?.[0]?.message?.content;
            if (!content) throw new Error(`${model} returned no message content`);
            return { model, signals: normalizeSignals(extractJsonObject(content)) };
          }

          let extracted: { model: string; signals: ReturnType<typeof normalizeSignals> };
          try {
            extracted = await invokeModel('llm', MODEL);
          } catch (primaryErr) {
            console.warn('[facilityiq] Primary trust rerun failed:', (primaryErr as Error).message);
            extracted = await invokeModel('fallback', FALLBACK_MODEL);
          }

          for (const signal of extracted.signals) {
            await appkit.lakebase.query(`
              INSERT INTO facilityiq.trust_signal_reruns
                (rerun_id, facility_id, dimension, trust_score, confidence_tier,
                 evidence_text, source_field, contradiction, contradiction_detail,
                 reason, analyst_id, extraction_model)
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
            `, [
              crypto.randomUUID(),
              id,
              signal.dimension,
              signal.trust_score,
              signal.confidence_tier,
              signal.evidence_text,
              signal.source_field,
              signal.contradiction,
              signal.contradiction_detail,
              reason,
              analyst_id,
              extracted.model,
            ]);
          }

          const { rows } = await appkit.lakebase.query(`
            SELECT
              0::int AS id,
              facility_id,
              dimension,
              trust_score,
              confidence_tier,
              evidence_text,
              source_field,
              contradiction,
              contradiction_detail,
              extraction_model,
              created_at AS extracted_at
            FROM (
              SELECT DISTINCT ON (dimension) *
              FROM facilityiq.trust_signal_reruns
              WHERE facility_id = $1
              ORDER BY dimension, created_at DESC
            ) latest
            ORDER BY dimension
          `, [id]);

          res.status(201).json({
            facility_id: id,
            extraction_model: extracted.model,
            overall_trust_score: adjustedScoreFromSignals(facility, extracted.signals),
            trust_signals: rows,
          });
        } catch (err) {
          console.error('Failed to rerun trust score:', err);
          res.status(500).json({ error: (err as Error).message || 'Failed to rerun trust score' });
        }
      });

      // GET /api/facilities/:id/actions?analyst_id=<uuid>
      app.get('/api/facilities/:id/actions', async (req, res) => {
        try {
          const { id } = req.params;
          const analyst_id = String(req.query.analyst_id ?? '');
          if (!analyst_id) {
            res.status(400).json({ error: 'analyst_id required' });
            return;
          }
          const { rows } = await appkit.lakebase.query(`
            SELECT DISTINCT ON (action_type, COALESCE(dimension, ''))
              action_id, facility_id, analyst_id, action_type,
              dimension, content, override_score, updated_at
            FROM facilityiq.user_actions
            WHERE facility_id = $1 AND analyst_id = $2
            ORDER BY action_type, COALESCE(dimension, ''), updated_at DESC
          `, [id, analyst_id]);
          res.json(rows);
        } catch (err) {
          console.error('Failed to fetch actions:', err);
          res.status(500).json({ error: 'Failed to fetch actions' });
        }
      });

      // POST /api/facilities/:id/actions
      app.post('/api/facilities/:id/actions', async (req, res) => {
        try {
          const { id } = req.params;
          const schema = z.object({
            analyst_id:     z.string().uuid(),
            action_type:    z.enum(['note', 'override', 'shortlist', 'flag']),
            dimension:      z.string().nullable().optional(),
            content:        z.string().nullable().optional(),
            override_score: z.number().min(0).max(100).nullable().optional(),
          });
          const parsed = schema.safeParse(req.body);
          if (!parsed.success) {
            res.status(400).json({ error: parsed.error.flatten() });
            return;
          }
          const { analyst_id, action_type, dimension, content, override_score } = parsed.data;
          const action_id = crypto.randomUUID();
          const { rows } = await appkit.lakebase.query(`
            INSERT INTO facilityiq.user_actions
              (action_id, facility_id, analyst_id, action_type, dimension, content, override_score)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *
          `, [action_id, id, analyst_id, action_type, dimension ?? null, content ?? null, override_score ?? null]);
          res.status(201).json(rows[0]);
        } catch (err) {
          console.error('Failed to save action:', err);
          res.status(500).json({ error: 'Failed to save action' });
        }
      });

      // GET /api/review/board/unstarted?limit=500 — facilities with no review row yet (not_started column)
      app.get('/api/review/board/unstarted', async (req, res) => {
        try {
          const limit = Math.min(Number(req.query.limit ?? 500), 2000);
          const { rows } = await appkit.lakebase.query(`
            SELECT f.unique_id AS facility_id, f.name AS facility_name,
                   f.facility_type_id AS facility_type, f.address_state_or_region AS state,
                   'not_started' AS status
            FROM public.facilities f
            WHERE NOT EXISTS (
              SELECT 1 FROM facilityiq.facility_review r
              WHERE r.facility_id = f.unique_id
            )
            ORDER BY f.name
            LIMIT $1
          `, [limit]);
          res.json(rows);
        } catch (err) {
          console.error('Failed to fetch unstarted facilities:', err);
          res.status(500).json({ error: 'Failed to fetch unstarted facilities' });
        }
      });

      // GET /api/review/board?status=<stage>&limit=500 — kanban cards (facilities in review)
      app.get('/api/review/board', async (req, res) => {
        try {
          const status = req.query.status ? String(req.query.status) : null;
          const limit = Math.min(Number(req.query.limit ?? 500), 2000);
          const params: unknown[] = [];
          let where = '';
          if (status) {
            params.push(status);
            where = `WHERE r.status = $${params.length}`;
          }
          params.push(limit);
          const { rows } = await appkit.lakebase.query(`
            SELECT r.facility_id, f.name AS facility_name,
                   f.facility_type_id AS facility_type, f.address_state_or_region AS state,
                   r.status, r.parked_reason, r.assigned_to, r.notes,
                   r.updated_by, r.updated_at
            FROM facilityiq.facility_review r
            LEFT JOIN public.facilities f ON f.unique_id = r.facility_id
            ${where}
            ORDER BY r.updated_at DESC
            LIMIT $${params.length}
          `, params);
          res.json(rows);
        } catch (err) {
          console.error('Failed to fetch review board:', err);
          res.status(500).json({ error: 'Failed to fetch review board' });
        }
      });

      // GET /api/review/:facilityId — one facility's review state (defaults to not_started)
      app.get('/api/review/:facilityId', async (req, res) => {
        try {
          const { facilityId } = req.params;
          const { rows } = await appkit.lakebase.query(
            `SELECT * FROM facilityiq.facility_review WHERE facility_id = $1`, [facilityId]);
          res.json(rows[0] ?? { facility_id: facilityId, status: 'not_started' });
        } catch (err) {
          console.error('Failed to fetch review:', err);
          res.status(500).json({ error: 'Failed to fetch review' });
        }
      });

      // POST /api/review/:facilityId — move card / set stage (upsert)
      app.post('/api/review/:facilityId', async (req, res) => {
        try {
          const { facilityId } = req.params;
          const schema = z.object({
            status:        z.enum(['not_started', 'in_progress', 'email_sent',
                                   'called', 'parked', 'validation_complete']),
            parked_reason: z.string().nullable().optional(),
            assigned_to:   z.string().nullable().optional(),
            notes:         z.string().nullable().optional(),
            updated_by:    z.string().nullable().optional(),
          }).refine(
            (d) => d.status !== 'parked' || (!!d.parked_reason && d.parked_reason.trim().length > 0),
            { message: 'parked_reason is required when status is parked', path: ['parked_reason'] },
          );
          const parsed = schema.safeParse(req.body);
          if (!parsed.success) {
            res.status(400).json({ error: parsed.error.flatten() });
            return;
          }
          const { status, parked_reason, assigned_to, notes, updated_by } = parsed.data;
          const { rows } = await appkit.lakebase.query(`
            INSERT INTO facilityiq.facility_review
              (facility_id, status, parked_reason, assigned_to, notes, updated_by, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, NOW())
            ON CONFLICT (facility_id) DO UPDATE SET
              status        = EXCLUDED.status,
              parked_reason = EXCLUDED.parked_reason,
              assigned_to   = EXCLUDED.assigned_to,
              notes         = EXCLUDED.notes,
              updated_by    = EXCLUDED.updated_by,
              updated_at    = NOW()
            RETURNING *
          `, [facilityId, status, parked_reason ?? null, assigned_to ?? null, notes ?? null, updated_by ?? null]);
          res.status(200).json(rows[0]);
        } catch (err) {
          console.error('Failed to update review:', err);
          res.status(500).json({ error: 'Failed to update review' });
        }
      });

    });
  },
}).catch(console.error);
