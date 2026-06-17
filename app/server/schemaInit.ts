type LakebaseClient = {
  query(sql: string): Promise<unknown>;
};

export const facilityIqSchemaStatements = [
  `CREATE SCHEMA IF NOT EXISTS facilityiq`,
  `
    CREATE TABLE IF NOT EXISTS facilityiq.facilities_overrides (
      facility_id  TEXT        NOT NULL,
      field_name   TEXT        NOT NULL,
      new_value    TEXT,
      analyst_id   TEXT,
      reason       TEXT,
      updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `,
  `
    CREATE INDEX IF NOT EXISTS idx_fo_facility_field
      ON facilityiq.facilities_overrides (facility_id, field_name, updated_at DESC)
  `,
  `
    CREATE TABLE IF NOT EXISTS facilityiq.user_actions (
      action_id      TEXT PRIMARY KEY,
      facility_id    TEXT NOT NULL,
      analyst_id     TEXT NOT NULL,
      action_type    TEXT NOT NULL CHECK (action_type IN ('note','override','shortlist','flag')),
      dimension      TEXT,
      content        TEXT,
      override_score REAL,
      created_at     TIMESTAMPTZ DEFAULT NOW(),
      updated_at     TIMESTAMPTZ DEFAULT NOW()
    )
  `,
  `
    CREATE INDEX IF NOT EXISTS idx_ua_facility_analyst
      ON facilityiq.user_actions (facility_id, analyst_id, action_type, updated_at DESC)
  `,
  `
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
    )
  `,
  `
    CREATE INDEX IF NOT EXISTS idx_fr_status
      ON facilityiq.facility_review (status, updated_at DESC)
  `,
  `
    CREATE TABLE IF NOT EXISTS facilityiq.trust_signal_reruns (
      rerun_id             TEXT PRIMARY KEY,
      facility_id          TEXT NOT NULL,
      dimension            TEXT NOT NULL CHECK (dimension IN ('capability','equipment','procedure','completeness')),
      trust_score          REAL,
      confidence_tier      TEXT,
      evidence_text        TEXT,
      source_field         TEXT,
      contradiction        BOOLEAN,
      contradiction_detail TEXT,
      reason               TEXT NOT NULL CHECK (reason IN ('edited','verified','manual')),
      analyst_id           TEXT,
      extraction_model     TEXT,
      created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `,
  `
    CREATE INDEX IF NOT EXISTS idx_tsr_latest
      ON facilityiq.trust_signal_reruns (facility_id, dimension, created_at DESC)
  `,
];

export async function initializeFacilityIqSchema(lakebase: LakebaseClient) {
  for (const statement of facilityIqSchemaStatements) {
    await lakebase.query(statement);
  }
}
