
create extension if not exists vector;

create table if not exists public.alixdocs2_tasks (
  id uuid primary key default gen_random_uuid(),
  doc_id uuid references public.alixdocs2_documents(id) on delete cascade,
  title text not null,
  description text,
  assignee uuid references auth.users(id),
  created_by uuid references auth.users(id),
  due_at timestamptz,
  status text not null default 'open',
  priority text not null default 'normal',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.alixdocs2_tasks to authenticated;
grant all on public.alixdocs2_tasks to service_role;
alter table public.alixdocs2_tasks enable row level security;
create policy "ad2_tasks_select" on public.alixdocs2_tasks for select to authenticated
  using (assignee=auth.uid() or created_by=auth.uid() or public.has_role('Admin') or public.has_role('Super Admin'));
create policy "ad2_tasks_insert" on public.alixdocs2_tasks for insert to authenticated
  with check (created_by=auth.uid() or public.has_role('Admin') or public.has_role('Super Admin'));
create policy "ad2_tasks_update" on public.alixdocs2_tasks for update to authenticated
  using (assignee=auth.uid() or created_by=auth.uid() or public.has_role('Admin') or public.has_role('Super Admin'));
create policy "ad2_tasks_delete" on public.alixdocs2_tasks for delete to authenticated
  using (public.has_role('Admin') or public.has_role('Super Admin'));
create index if not exists ad2_tasks_doc_idx on public.alixdocs2_tasks(doc_id);
create index if not exists ad2_tasks_assignee_idx on public.alixdocs2_tasks(assignee, status);
create trigger trg_ad2_tasks_touch before update on public.alixdocs2_tasks
  for each row execute function public.ac_touch_updated_at();

create table if not exists public.alixdocs2_favorites (
  user_id uuid not null references auth.users(id) on delete cascade,
  doc_id uuid not null references public.alixdocs2_documents(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, doc_id)
);
grant select, insert, delete on public.alixdocs2_favorites to authenticated;
grant all on public.alixdocs2_favorites to service_role;
alter table public.alixdocs2_favorites enable row level security;
create policy "ad2_fav_own" on public.alixdocs2_favorites for all to authenticated
  using (user_id=auth.uid()) with check (user_id=auth.uid());

create table if not exists public.alixdocs2_activity (
  id uuid primary key default gen_random_uuid(),
  doc_id uuid references public.alixdocs2_documents(id) on delete cascade,
  actor_id uuid references auth.users(id),
  action text not null,
  detail jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);
grant select, insert on public.alixdocs2_activity to authenticated;
grant all on public.alixdocs2_activity to service_role;
alter table public.alixdocs2_activity enable row level security;
create policy "ad2_activity_select" on public.alixdocs2_activity for select to authenticated using (true);
create policy "ad2_activity_insert" on public.alixdocs2_activity for insert to authenticated
  with check (actor_id=auth.uid() or actor_id is null);
create index if not exists ad2_activity_doc_idx on public.alixdocs2_activity(doc_id, created_at desc);
create index if not exists ad2_activity_actor_idx on public.alixdocs2_activity(actor_id, created_at desc);

create table if not exists public.alixdocs2_workflows (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  doctype_code text,
  active boolean not null default true,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.alixdocs2_workflows to authenticated;
grant all on public.alixdocs2_workflows to service_role;
alter table public.alixdocs2_workflows enable row level security;
create policy "ad2_wf_admin" on public.alixdocs2_workflows for all to authenticated
  using (public.has_role('Admin') or public.has_role('Super Admin'))
  with check (public.has_role('Admin') or public.has_role('Super Admin'));

create table if not exists public.alixdocs2_workflow_steps (
  id uuid primary key default gen_random_uuid(),
  workflow_id uuid not null references public.alixdocs2_workflows(id) on delete cascade,
  step_order int not null,
  name text not null,
  approver_user uuid references auth.users(id),
  approver_role text,
  due_hours int default 48,
  reminder_hours int default 24,
  parallel boolean not null default false,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.alixdocs2_workflow_steps to authenticated;
grant all on public.alixdocs2_workflow_steps to service_role;
alter table public.alixdocs2_workflow_steps enable row level security;
create policy "ad2_wfs_admin" on public.alixdocs2_workflow_steps for all to authenticated
  using (public.has_role('Admin') or public.has_role('Super Admin'))
  with check (public.has_role('Admin') or public.has_role('Super Admin'));
create index if not exists ad2_wfs_wf_idx on public.alixdocs2_workflow_steps(workflow_id, step_order);

create table if not exists public.alixdocs2_workflow_runs (
  id uuid primary key default gen_random_uuid(),
  workflow_id uuid not null references public.alixdocs2_workflows(id) on delete cascade,
  doc_id uuid not null references public.alixdocs2_documents(id) on delete cascade,
  status text not null default 'running',
  current_step int not null default 1,
  history jsonb not null default '[]'::jsonb,
  started_by uuid references auth.users(id),
  started_at timestamptz not null default now(),
  finished_at timestamptz
);
grant select, insert, update, delete on public.alixdocs2_workflow_runs to authenticated;
grant all on public.alixdocs2_workflow_runs to service_role;
alter table public.alixdocs2_workflow_runs enable row level security;
create policy "ad2_wfr_admin" on public.alixdocs2_workflow_runs for all to authenticated
  using (public.has_role('Admin') or public.has_role('Super Admin'))
  with check (public.has_role('Admin') or public.has_role('Super Admin'));
create index if not exists ad2_wfr_doc_idx on public.alixdocs2_workflow_runs(doc_id);
create index if not exists ad2_wfr_status_idx on public.alixdocs2_workflow_runs(status);

create table if not exists public.alixdocs2_embeddings (
  id uuid primary key default gen_random_uuid(),
  doc_id uuid not null references public.alixdocs2_documents(id) on delete cascade,
  chunk_index int not null default 0,
  content text not null,
  embedding vector(1536) not null,
  model text not null default 'openai/text-embedding-3-small',
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.alixdocs2_embeddings to authenticated;
grant all on public.alixdocs2_embeddings to service_role;
alter table public.alixdocs2_embeddings enable row level security;
create policy "ad2_emb_admin" on public.alixdocs2_embeddings for all to authenticated
  using (public.has_role('Admin') or public.has_role('Super Admin'))
  with check (public.has_role('Admin') or public.has_role('Super Admin'));
create index if not exists ad2_emb_doc_idx on public.alixdocs2_embeddings(doc_id);
create index if not exists ad2_emb_hnsw on public.alixdocs2_embeddings using hnsw (embedding vector_cosine_ops);
