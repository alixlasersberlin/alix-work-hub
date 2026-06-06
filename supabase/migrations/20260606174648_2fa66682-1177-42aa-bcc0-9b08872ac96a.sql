
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Helper: invoke ticket-customer-notify edge function
create or replace function public.notify_customer_event(
  _event text,
  _ticket_id uuid,
  _repair_order_id uuid,
  _recipient_email text,
  _customer_name text,
  _ticket_number text,
  _repair_number text,
  _message text default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_url text := 'https://xmrmkgfgpoundfwhnxfs.supabase.co/functions/v1/ticket-customer-notify';
  v_anon text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhtcm1rZ2ZncG91bmRmd2hueGZzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYxNDAwNjMsImV4cCI6MjA5MTcxNjA2M30.pooQ-fUWvILgv-uV65CyxHvcmeUMUvO959SnpO2LpaA';
begin
  if _recipient_email is null or length(trim(_recipient_email)) = 0 then
    return;
  end if;
  perform net.http_post(
    url := v_url,
    headers := jsonb_build_object('Content-Type','application/json','apikey', v_anon, 'Authorization', 'Bearer '||v_anon),
    body := jsonb_build_object(
      'event', _event,
      'ticket_id', _ticket_id,
      'repair_order_id', _repair_order_id,
      'recipient_email', _recipient_email,
      'customer_name', _customer_name,
      'ticket_number', _ticket_number,
      'repair_number', _repair_number,
      'message', _message
    )
  );
end;
$$;

-- Trigger: Ticket received (after insert)
create or replace function public.trg_ticket_notify_received()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(new.auto_notify_customer, true) and new.customer_email is not null then
    perform public.notify_customer_event(
      'ticket_received', new.id, null, new.customer_email, new.customer_name,
      new.ticket_number, null, null
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_ticket_notify_received on public.tickets;
create trigger trg_ticket_notify_received
after insert on public.tickets
for each row execute function public.trg_ticket_notify_received();

-- Trigger: Ticket in progress (status change)
create or replace function public.trg_ticket_notify_in_progress()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(new.auto_notify_customer, true)
     and new.customer_email is not null
     and old.status is distinct from new.status
     and lower(coalesce(new.status,'')) in ('in bearbeitung','in_progress','in progress','bearbeitung') then
    perform public.notify_customer_event(
      'ticket_in_progress', new.id, null, new.customer_email, new.customer_name,
      new.ticket_number, null, null
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_ticket_notify_in_progress on public.tickets;
create trigger trg_ticket_notify_in_progress
after update on public.tickets
for each row execute function public.trg_ticket_notify_in_progress();

-- Trigger: Repair completed / shipment sent
create or replace function public.trg_repair_notify_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event text;
begin
  if old.repair_status is distinct from new.repair_status and new.customer_email is not null then
    if new.repair_status ilike '%abgeschlossen%' or new.repair_status ilike '%completed%' then
      v_event := 'repair_completed';
    elsif new.repair_status ilike '%ausgeliefert%' or new.repair_status ilike '%shipped%' or new.repair_status ilike '%versendet%' then
      v_event := 'shipment_sent';
    end if;
    if v_event is not null then
      perform public.notify_customer_event(
        v_event, null, new.id, new.customer_email, new.customer_name,
        null, new.repair_number, null
      );
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_repair_notify_status on public.repair_orders;
create trigger trg_repair_notify_status
after update on public.repair_orders
for each row execute function public.trg_repair_notify_status();

-- Trigger: Spare part ordered
create or replace function public.trg_spare_part_notify_ordered()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text;
  v_name text;
  v_repnum text;
begin
  if old.status is distinct from new.status
     and (new.status ilike '%bestellt%' or new.status ilike '%ordered%') then
    select customer_email, customer_name, repair_number
      into v_email, v_name, v_repnum
      from public.repair_orders where id = new.repair_order_id;
    if v_email is not null then
      perform public.notify_customer_event(
        'spare_part_ordered', null, new.repair_order_id, v_email, v_name,
        null, v_repnum, new.part_name
      );
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_spare_part_notify_ordered on public.repair_spare_parts;
create trigger trg_spare_part_notify_ordered
after update on public.repair_spare_parts
for each row execute function public.trg_spare_part_notify_ordered();

-- Cron: SLA check hourly
do $$
begin
  if exists (select 1 from cron.job where jobname = 'ticket-sla-check-hourly') then
    perform cron.unschedule('ticket-sla-check-hourly');
  end if;
end $$;

select cron.schedule(
  'ticket-sla-check-hourly',
  '0 * * * *',
  $cron$
  select net.http_post(
    url := 'https://xmrmkgfgpoundfwhnxfs.supabase.co/functions/v1/ticket-sla-check',
    headers := '{"Content-Type":"application/json","apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhtcm1rZ2ZncG91bmRmd2hueGZzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYxNDAwNjMsImV4cCI6MjA5MTcxNjA2M30.pooQ-fUWvILgv-uV65CyxHvcmeUMUvO959SnpO2LpaA"}'::jsonb,
    body := jsonb_build_object('time', now())
  );
  $cron$
);
