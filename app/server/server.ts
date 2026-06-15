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

        CREATE TABLE IF NOT EXISTS facilityiq.facility_review (
          facility_id   TEXT PRIMARY KEY,
          status        TEXT NOT NULL DEFAULT 'not_started'
                        CHECK (status IN ('not_started','in_progress','email_sent',
                                          'called','parked','validation_complete')),
          parked_reason TEXT,
          assigned_to   TEXT,
          notes         TEXT,
          updated_by    TEXT,
          updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          CONSTRAINT parked_requires_reason
            CHECK (status <> 'parked' OR parked_reason IS NOT NULL)
        );
        CREATE INDEX IF NOT EXISTS idx_fr_status
          ON facilityiq.facility_review (status, updated_at DESC);
      `);
      console.log('[facilityiq] Schema, user_actions, and facility_review tables ready');
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
              AVG(t.trust_score)::real             AS overall_trust_score,
              MAX(CASE WHEN t.contradiction THEN 1 ELSE 0 END)::int AS has_contradiction,
              COUNT(t.dimension)::int              AS signal_count
            FROM public.facilities f
            LEFT JOIN public.trust_signals t ON f.unique_id = t.facility_id
            WHERE ($1::text IS NULL OR
              f.name ILIKE $1 OR
              f.description ILIKE $1 OR
              f.capability ILIKE $1 OR
              f.address_state_or_region ILIKE $1)
              AND ($2::text = '' OR f.address_state_or_region = $2)
              AND ($3::text = '' OR f.facility_type_id = $3)
            GROUP BY f.unique_id, f.name, f.address_state_or_region, f.facility_type_id
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
              `SELECT
                      unique_id                    AS facility_id,
                      name                         AS facility_name,
                      facility_type_id             AS facility_type,
                      address_state_or_region      AS state,
                      address_city                 AS district,
                      description,
                      capability,
                      procedure,
                      equipment,
                      capacity,
                      year_established,
                      number_doctors,
                      official_phone,
                      email,
                      official_website,
                      address_line1,
                      overridden_fields
               FROM public.facilities WHERE unique_id = $1`, [id]),
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

      // GET /api/review/board/unstarted?limit=500 — facilities with no review row yet (not_started column)
      app.get('/api/review/board/unstarted', async (req, res) => {
        try {
          const limit = Math.min(Number(req.query.limit ?? 500), 2000);
          const { rows } = await appkit.lakebase.query(`
            SELECT f.facility_id, f.facility_name, f.facility_type, f.state,
                   'not_started' AS status
            FROM public.facilities f
            WHERE NOT EXISTS (
              SELECT 1 FROM facilityiq.facility_review r
              WHERE r.facility_id = f.facility_id
            )
            ORDER BY f.facility_name
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
            SELECT r.facility_id, f.facility_name, f.facility_type, f.state,
                   r.status, r.parked_reason, r.assigned_to, r.notes,
                   r.updated_by, r.updated_at
            FROM facilityiq.facility_review r
            LEFT JOIN public.facilities f ON f.facility_id = r.facility_id
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
