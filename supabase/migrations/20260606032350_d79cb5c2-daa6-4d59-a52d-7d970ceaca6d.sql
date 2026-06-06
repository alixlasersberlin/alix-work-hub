
-- ============================================================
-- AIC: Alix Intelligence Center
-- Alle Tabellen mit Präfix aic_, RLS: nur Super Admin
-- ============================================================

-- 1) aic_insights
CREATE TABLE public.aic_insights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module text NOT NULL,              -- 'unternehmen' | 'forderungen' | 'vertrieb' | 'service' | 'mitarbeiter' | 'forecast'
  category text NOT NULL,            -- 'chance' | 'risiko' | 'empfehlung'
  title text NOT NULL,
  description text,
  severity int NOT NULL DEFAULT 3,   -- 1 (gering) .. 5 (kritisch)
  entity_type text,                  -- 'customer' | 'order' | 'invoice' | 'repair' | 'employee' | NULL
  entity_id text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'open', -- 'open' | 'dismissed' | 'done'
  run_id uuid,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX aic_insights_module_idx ON public.aic_insights(module);
CREATE INDEX aic_insights_status_idx ON public.aic_insights(status);
CREATE INDEX aic_insights_created_at_idx ON public.aic_insights(created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.aic_insights TO authenticated;
GRANT ALL ON public.aic_insights TO service_role;
ALTER TABLE public.aic_insights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "AIC insights – Super Admin select"
  ON public.aic_insights FOR SELECT TO authenticated
  USING (public.has_role('Super Admin'));
CREATE POLICY "AIC insights – Super Admin insert"
  ON public.aic_insights FOR INSERT TO authenticated
  WITH CHECK (public.has_role('Super Admin'));
CREATE POLICY "AIC insights – Super Admin update"
  ON public.aic_insights FOR UPDATE TO authenticated
  USING (public.has_role('Super Admin'))
  WITH CHECK (public.has_role('Super Admin'));
CREATE POLICY "AIC insights – Super Admin delete"
  ON public.aic_insights FOR DELETE TO authenticated
  USING (public.has_role('Super Admin'));

-- 2) aic_forecasts
CREATE TABLE public.aic_forecasts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL,                -- 'umsatz_30d' | 'umsatz_90d' | 'reparaturen' | 'kampagnen' | 'lager'
  value numeric,
  unit text,                         -- 'EUR' | 'Stück' | ...
  confidence numeric,                -- 0..1
  rationale text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  run_id uuid,
  generated_at timestamptz NOT NULL DEFAULT now(),
  valid_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX aic_forecasts_kind_idx ON public.aic_forecasts(kind, generated_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.aic_forecasts TO authenticated;
GRANT ALL ON public.aic_forecasts TO service_role;
ALTER TABLE public.aic_forecasts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "AIC forecasts – Super Admin all"
  ON public.aic_forecasts FOR ALL TO authenticated
  USING (public.has_role('Super Admin'))
  WITH CHECK (public.has_role('Super Admin'));

-- 3) aic_tasks (KI-Aufgaben / Vorschläge)
CREATE TABLE public.aic_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_type text NOT NULL,           -- 'anruf' | 'angebot' | 'mahnung' | 'wartung' | 'schulung' | 'sonstiges'
  title text NOT NULL,
  description text,
  priority int NOT NULL DEFAULT 3,   -- 1..5
  status text NOT NULL DEFAULT 'open', -- 'open' | 'in_progress' | 'done' | 'dismissed'
  customer_id uuid,
  order_id uuid,
  related_insight_id uuid REFERENCES public.aic_insights(id) ON DELETE SET NULL,
  due_date date,
  assigned_to uuid,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  run_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX aic_tasks_status_idx ON public.aic_tasks(status);
CREATE INDEX aic_tasks_priority_idx ON public.aic_tasks(priority DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.aic_tasks TO authenticated;
GRANT ALL ON public.aic_tasks TO service_role;
ALTER TABLE public.aic_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "AIC tasks – Super Admin all"
  ON public.aic_tasks FOR ALL TO authenticated
  USING (public.has_role('Super Admin'))
  WITH CHECK (public.has_role('Super Admin'));

-- 4) aic_reports (Management-Berichte)
CREATE TABLE public.aic_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL,                -- 'daily' | 'weekly' | 'monthly' | 'adhoc'
  period_start date,
  period_end date,
  title text NOT NULL,
  summary text,
  content_html text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  recipients text[] NOT NULL DEFAULT '{}',
  sent_at timestamptz,
  send_status text NOT NULL DEFAULT 'pending', -- 'pending' | 'sent' | 'failed'
  send_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX aic_reports_kind_idx ON public.aic_reports(kind, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.aic_reports TO authenticated;
GRANT ALL ON public.aic_reports TO service_role;
ALTER TABLE public.aic_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "AIC reports – Super Admin all"
  ON public.aic_reports FOR ALL TO authenticated
  USING (public.has_role('Super Admin'))
  WITH CHECK (public.has_role('Super Admin'));

-- 5) aic_report_schedules
CREATE TABLE public.aic_report_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL,                -- 'daily' | 'weekly' | 'monthly'
  recipients text[] NOT NULL DEFAULT '{}',
  enabled boolean NOT NULL DEFAULT true,
  send_hour int NOT NULL DEFAULT 7,  -- Stunde des Versands (lokale Zeit, vereinfacht UTC)
  weekday int,                       -- 0=Sonntag..6=Samstag (für 'weekly')
  monthday int,                      -- 1..28 (für 'monthly')
  last_run_at timestamptz,
  next_run_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.aic_report_schedules TO authenticated;
GRANT ALL ON public.aic_report_schedules TO service_role;
ALTER TABLE public.aic_report_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "AIC schedules – Super Admin all"
  ON public.aic_report_schedules FOR ALL TO authenticated
  USING (public.has_role('Super Admin'))
  WITH CHECK (public.has_role('Super Admin'));

-- 6) aic_analysis_runs (Lauf-Historie)
CREATE TABLE public.aic_analysis_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trigger text NOT NULL DEFAULT 'manual', -- 'manual' | 'cron'
  status text NOT NULL DEFAULT 'running', -- 'running' | 'success' | 'failed'
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  duration_ms int,
  modules text[] NOT NULL DEFAULT '{}',
  stats jsonb NOT NULL DEFAULT '{}'::jsonb,
  error text,
  triggered_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX aic_analysis_runs_started_idx ON public.aic_analysis_runs(started_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.aic_analysis_runs TO authenticated;
GRANT ALL ON public.aic_analysis_runs TO service_role;
ALTER TABLE public.aic_analysis_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "AIC runs – Super Admin all"
  ON public.aic_analysis_runs FOR ALL TO authenticated
  USING (public.has_role('Super Admin'))
  WITH CHECK (public.has_role('Super Admin'));

-- updated_at Trigger für alle aic_-Tabellen
CREATE TRIGGER aic_insights_set_updated_at
  BEFORE UPDATE ON public.aic_insights
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER aic_forecasts_set_updated_at
  BEFORE UPDATE ON public.aic_forecasts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER aic_tasks_set_updated_at
  BEFORE UPDATE ON public.aic_tasks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER aic_reports_set_updated_at
  BEFORE UPDATE ON public.aic_reports
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER aic_report_schedules_set_updated_at
  BEFORE UPDATE ON public.aic_report_schedules
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
