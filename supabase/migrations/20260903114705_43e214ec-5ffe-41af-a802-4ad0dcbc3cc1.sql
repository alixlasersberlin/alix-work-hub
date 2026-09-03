-- ALIX AI COMMUNICATION ASSISTANT (Prompt 5) — additive, keine bestehenden Strukturen ersetzen
create table if not exists public.ai_classifications (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.ac_conversations(id) on delete cascade,
  message_id uuid,
  classification_type text not null default 'CLASSIFICATION',
  category text,
  priority text,
  confidence numeric,
  detected_customer_id uuid,
  detected_device_id uuid,
  detected_serial_number text,
  detected_ticket_id uuid,
  summary text,
  reasoning_summary text,
  suggested_action text,
  model_name text,
  prompt_version text,
  status text not null default 'PENDING',
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by_user_id uuid,
  metadata jsonb
);

create index if not exists idx_ai_class_conv on public.ai_classifications(conversation_id, created_at desc);
create index if not exists idx_ai_class_type on public.ai_classifications(classification_type, created_at desc);

grant select, insert, update on public.ai_classifications to authenticated;
grant all on public.ai_classifications to service_role;
alter table public.ai_classifications enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='ai_classifications' and policyname='ai_class_read') then
    create policy ai_class_read on public.ai_classifications for select to authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='ai_classifications' and policyname='ai_class_write') then
    create policy ai_class_write on public.ai_classifications for insert to authenticated with check (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='ai_classifications' and policyname='ai_class_update') then
    create policy ai_class_update on public.ai_classifications for update to authenticated using (true) with check (true);
  end if;
end $$;

create table if not exists public.ai_feedback (
  id uuid primary key default gen_random_uuid(),
  classification_id uuid not null references public.ai_classifications(id) on delete cascade,
  user_id uuid,
  feedback_type text not null,
  original_value jsonb,
  corrected_value jsonb,
  comment text,
  created_at timestamptz not null default now()
);
create index if not exists idx_ai_feedback_class on public.ai_feedback(classification_id);
grant select, insert on public.ai_feedback to authenticated;
grant all on public.ai_feedback to service_role;
alter table public.ai_feedback enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='ai_feedback' and policyname='ai_feedback_read') then
    create policy ai_feedback_read on public.ai_feedback for select to authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='ai_feedback' and policyname='ai_feedback_write') then
    create policy ai_feedback_write on public.ai_feedback for insert to authenticated with check (user_id = auth.uid());
  end if;
end $$;

-- Feature Flags (Default: nur Phase A/B aktiv, keine Automatik)
insert into public.app_settings(key, value) values
  ('ai_enabled','true'),
  ('ai_classification_enabled','true'),
  ('ai_reply_enabled','true'),
  ('ai_summary_enabled','true'),
  ('ai_device_detection_enabled','true'),
  ('ai_ticket_detection_enabled','true'),
  ('ai_translation_enabled','true'),
  ('ai_sales_enabled','true'),
  ('ai_technical_triage_enabled','true'),
  ('ai_auto_routing_enabled','false'),
  ('ai_auto_priority_enabled','false'),
  ('ai_min_confidence','0.75'),
  ('ai_analysis_debounce_seconds','6')
on conflict (key) do nothing;