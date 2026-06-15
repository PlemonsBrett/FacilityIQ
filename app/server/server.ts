import { createApp, lakebase, server } from '@databricks/appkit';
import { z } from 'zod';

createApp({
  plugins: [
    lakebase(),
    server(),
  ],
  async onPluginsReady(appkit) {
    // Schema and table init — SP owns facilityiq schema because we deployed first
    try {
      await appkit.lakebase.query(`
        CREATE SCHEMA IF NOT EXISTS facilityiq;
        CREATE TABLE IF NOT EXISTS facilityiq.user_actions (
          action_id     TEXT PRIMARY KEY,
          facility_id   TEXT NOT NULL,
          analyst_id    TEXT NOT NULL,
          action_type   TEXT NOT NULL CHECK (action_type IN ('note','override','shortlist','flag')),
          dimension     TEXT,
          content       TEXT,
          override_score REAL,
          created_at    TIMESTAMPTZ DEFAULT NOW(),
          updated_at    TIMESTAMPTZ DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_ua_facility_analyst
          ON facilityiq.user_actions (facility_id, analyst_id, action_type, updated_at DESC);
      `);
      console.log('[facilityiq] Schema and user_actions table ready');
    } catch (err) {
      console.warn('[facilityiq] Schema init failed:', (err as Error).message);
      console.warn('[facilityiq] Routes will be registered but writes may fail until schema is ready');
    }

    appkit.server.extend((app) => {

      // GET /api/facilities/meta — MUST be before /api/facilities/:id
      app.get('/api/facilities/meta', async (_req, res) => {
        try {
          const [statesResult, typesResult] = await Promise.all([
            appkit.lakebase.query(
              `SELECT DISTINCT state FROM public.facilities WHERE state IS NOT NULL ORDER BY state`
            ),
            appkit.lakebase.query(
              `SELECT DISTINCT facility_type FROM public.facilities WHERE facility_type IS NOT NULL ORDER BY facility_type`
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
              f.facility_id,
              f.facility_name,
              f.state,
              f.facility_type,
              AVG(t.trust_score)::real AS overall_trust_score,
              MAX(CASE WHEN t.contradiction THEN 1 ELSE 0 END)::int AS has_contradiction,
              COUNT(t.dimension)::int AS signal_count
            FROM public.facilities f
            LEFT JOIN public.trust_signals t ON f.facility_id = t.facility_id
            WHERE ($1::text IS NULL OR
              f.facility_name ILIKE $1 OR
              f.description ILIKE $1 OR
              f.capability ILIKE $1 OR
              f.state ILIKE $1)
              AND ($2::text = '' OR f.state = $2)
              AND ($3::text = '' OR f.facility_type = $3)
            GROUP BY f.facility_id, f.facility_name, f.state, f.facility_type
            HAVING ($4 = 0 OR COALESCE(AVG(t.trust_score), 0) >= $4)
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
              `SELECT facility_id, facility_name, facility_type, state, district,
                      description, capability, procedure, equipment,
                      capacity, year_established
               FROM public.facilities WHERE facility_id = $1`, [id]),
            appkit.lakebase.query(
              `SELECT * FROM public.trust_signals
               WHERE facility_id = $1 ORDER BY dimension`, [id]),
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

    });
  },
}).catch(console.error);
