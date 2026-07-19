
-- Weekly cron for AlixDocs learn rules
select cron.unschedule('alixdocs-learn-rules-weekly') where exists (select 1 from cron.job where jobname='alixdocs-learn-rules-weekly');
select cron.schedule(
  'alixdocs-learn-rules-weekly',
  '15 3 * * 0',
  $$
  select net.http_post(
    url:='https://xmrmkgfgpoundfwhnxfs.supabase.co/functions/v1/alixdocs-learn-rules',
    headers:=jsonb_build_object(
      'Content-Type','application/json',
      'Authorization','Bearer '||current_setting('app.settings.service_role_key', true)
    ),
    body:=jsonb_build_object('since_days',90,'trigger','cron','ts',now())
  );
  $$
);

-- Debounced auto-trigger after every 25th feedback
create or replace function public.alixdocs_feedback_autolearn()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  n bigint;
begin
  select count(*) into n from public.alixdocs_match_feedback;
  if n % 25 = 0 then
    perform net.http_post(
      url:='https://xmrmkgfgpoundfwhnxfs.supabase.co/functions/v1/alixdocs-learn-rules',
      headers:=jsonb_build_object(
        'Content-Type','application/json',
        'Authorization','Bearer '||current_setting('app.settings.service_role_key', true)
      ),
      body:=jsonb_build_object('since_days',60,'trigger','autolearn','count',n)
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_alixdocs_feedback_autolearn on public.alixdocs_match_feedback;
create trigger trg_alixdocs_feedback_autolearn
after insert on public.alixdocs_match_feedback
for each row execute function public.alixdocs_feedback_autolearn();
