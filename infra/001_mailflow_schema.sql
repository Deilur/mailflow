-- ============================================================
-- MailFlow Schema — se instala en el MISMO Postgres de ListMonk
-- Crea un schema separado para no tocar las tablas de ListMonk
-- ============================================================
-- Ejecutar como:
--   psql $LISTMONK_DB_URL -f 001_mailflow_schema.sql

CREATE SCHEMA IF NOT EXISTS mailflow;

SET search_path TO mailflow;

-- ── Newsletter settings (from address, branding por lista) ────
CREATE TABLE IF NOT EXISTS newsletter_settings (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listmonk_list_id INTEGER NOT NULL UNIQUE,
  display_name    TEXT NOT NULL,
  from_email      TEXT NOT NULL,
  from_name       TEXT NOT NULL,
  reply_to        TEXT,
  logo_url        TEXT,
  brand_color     TEXT DEFAULT '#3b82f6',
  description     TEXT,
  template_header TEXT,
  template_footer TEXT,
  template_css    TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Funnels ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS funnels (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name              TEXT NOT NULL,
  description       TEXT,
  listmonk_list_id  INTEGER NOT NULL,
  status            TEXT NOT NULL DEFAULT 'draft'
                      CHECK (status IN ('draft','active','paused','archived')),
  entry_policy      TEXT NOT NULL DEFAULT 'once'
                      CHECK (entry_policy IN ('once','once_per_period','always')),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Funnel steps ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS funnel_steps (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  funnel_id   UUID NOT NULL REFERENCES mailflow.funnels(id) ON DELETE CASCADE,
  position    INTEGER NOT NULL DEFAULT 0,
  step_type   TEXT NOT NULL CHECK (step_type IN (
                'send_email','wait','add_to_list','remove_from_list','webhook'
              )),
  config      JSONB NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (funnel_id, position)
);

-- ── Enrollments (estado de cada suscriptor en cada funnel) ───
CREATE TABLE IF NOT EXISTS funnel_enrollments (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  funnel_id           UUID NOT NULL REFERENCES mailflow.funnels(id) ON DELETE CASCADE,
  subscriber_uuid     TEXT NOT NULL,
  subscriber_email    TEXT NOT NULL,
  current_step_pos    INTEGER NOT NULL DEFAULT 0,
  status              TEXT NOT NULL DEFAULT 'active'
                        CHECK (status IN ('active','waiting','completed','cancelled','errored')),
  next_run_at         TIMESTAMPTZ,
  retry_count         INTEGER NOT NULL DEFAULT 0,
  metadata            JSONB NOT NULL DEFAULT '{}',
  enrolled_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at        TIMESTAMPTZ,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (funnel_id, subscriber_uuid)
);

CREATE INDEX IF NOT EXISTS idx_enrollments_next_run
  ON mailflow.funnel_enrollments(next_run_at)
  WHERE status IN ('active','waiting');

-- ── Execution logs ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS funnel_execution_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id   UUID NOT NULL REFERENCES mailflow.funnel_enrollments(id) ON DELETE CASCADE,
  funnel_id       UUID NOT NULL,
  step_position   INTEGER NOT NULL,
  step_type       TEXT NOT NULL,
  outcome         TEXT NOT NULL CHECK (outcome IN ('success','failure','scheduled','skipped')),
  details         JSONB NOT NULL DEFAULT '{}',
  executed_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_logs_executed_at
  ON mailflow.funnel_execution_logs(executed_at DESC);

-- ── Auto-update updated_at ────────────────────────────────────
CREATE OR REPLACE FUNCTION mailflow.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_newsletter_settings_updated
  BEFORE UPDATE ON mailflow.newsletter_settings
  FOR EACH ROW EXECUTE FUNCTION mailflow.set_updated_at();

CREATE OR REPLACE TRIGGER trg_funnels_updated
  BEFORE UPDATE ON mailflow.funnels
  FOR EACH ROW EXECUTE FUNCTION mailflow.set_updated_at();

CREATE OR REPLACE TRIGGER trg_enrollments_updated
  BEFORE UPDATE ON mailflow.funnel_enrollments
  FOR EACH ROW EXECUTE FUNCTION mailflow.set_updated_at();

SELECT 'mailflow schema instalado correctamente ✓' AS status;
