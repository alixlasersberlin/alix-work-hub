
create or replace function public.trg_alixdocs_sign_return()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.alixdocs_document_id is not null
     and new.status in ('signiert','abgeschlossen','completed','signed')
     and (old.status is distinct from new.status) then
    perform net.http_post(
      url := 'https://xmrmkgfgpoundfwhnxfs.supabase.co/functions/v1/alixdocs-sign-return',
      headers := jsonb_build_object(
        'Content-Type','application/json',
        'apikey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhtcm1rZ2ZncG91bmRmd2hueGZzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYxNDAwNjMsImV4cCI6MjA5MTcxNjA2M30.pooQ-fUWvILgv-uV65CyxHvcmeUMUvO959SnpO2LpaA'
      ),
      body := jsonb_build_object('sig_request_id', new.id)
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_alixdocs_sign_return on public.sig_requests;
create trigger trg_alixdocs_sign_return
after update on public.sig_requests
for each row
execute function public.trg_alixdocs_sign_return();
