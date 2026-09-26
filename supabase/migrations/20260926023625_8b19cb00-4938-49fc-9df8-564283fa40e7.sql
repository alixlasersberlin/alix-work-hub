
create or replace function public.rp_is_system() returns boolean language sql stable as $$
  select auth.uid() is null and current_user in ('postgres','service_role','supabase_admin') $$;
create or replace function public.rp_can_view() returns boolean language sql stable security definer set search_path=public as $$
  select rp_is_system() or has_role('Super Admin') or has_role('Admin') or has_role('Finance') or has_role('Buchhaltung Admin') or has_role('Buchhaltung EU') $$;
create or replace function public.rp_can_manage() returns boolean language sql stable security definer set search_path=public as $$
  select rp_is_system() or has_role('Super Admin') or has_role('Admin') or has_role('Finance') $$;

create table public.rp_settings (
  id int primary key default 1 check (id=1),
  creditor_name text not null default 'Alix Lasers GmbH',
  creditor_id text,
  creditor_id_confirmed boolean not null default false,
  prenotification_days int not null default 14 check (prenotification_days between 1 and 60),
  email_subject text not null default 'Ankündigung SEPA-Lastschrift – Rechnung {{invoice_number}}',
  email_body text not null default E'Guten Tag {{customer_name}},\n\nwir informieren Sie über die bevorstehende SEPA-Lastschrift.\n\nBetrag: {{amount}}\nEinzugsdatum: {{collection_date}}\nRechnung: {{invoice_number}}\nMandatsreferenz: {{mandate_reference}}\nGläubiger-ID: {{creditor_id}}\n\nDie zugehörige Rechnung finden Sie im Anhang bzw. in Ihrem Kundenbereich.\n\nFreundliche Grüße\nAlix Lasers ®',
  sms_body text not null default 'ALIX: Wir ziehen gemäß Ihrem SEPA-Mandat am {{collection_date}} {{amount}} ein. Rechnung {{invoice_number}} wurde Ihnen per E-Mail bereitgestellt.',
  updated_at timestamptz not null default now(), updated_by uuid);
insert into public.rp_settings(id, creditor_id) values (1, 'DE02ZZZOOOO26O5O62');

create table public.rp_mandates (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id),
  mandate_reference text not null unique,
  mandate_date date,
  account_holder text,
  iban text,
  bic text,
  sequence_type text not null default 'RCUR' check (sequence_type in ('FRST','RCUR')),
  status text not null default 'aktiv' check (status in ('aktiv','widerrufen','abgelaufen','fehlerhaft')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), created_by uuid default auth.uid());

create table public.rp_payment_plans (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id),
  contract_id uuid references public.finance_contracts(id),
  product text not null,
  description text,
  net_amount numeric(12,2) not null check (net_amount >= 0),
  tax_rate numeric(5,2) default 19,
  gross_amount numeric(12,2) generated always as (round(net_amount * (1 + coalesce(tax_rate,0)/100), 2)) stored,
  billing_interval text not null default 'monatlich' check (billing_interval in ('monatlich','quartalsweise','halbjaehrlich','jaehrlich','individuell')),
  interval_months int not null default 1 check (interval_months between 1 and 36),
  start_date date not null,
  end_date date,
  due_day int not null default 1 check (due_day between 1 and 28),
  payment_method text not null default 'sepa' check (payment_method in ('sepa','ueberweisung')),
  mandate_id uuid references public.rp_mandates(id),
  notify_channel text not null default 'email' check (notify_channel in ('email','sms','email_sms')),
  email text, phone text, cost_center text, booking_account text,
  status text not null default 'aktiv' check (status in ('aktiv','pausiert','beendet','fehler')),
  zoho_recurring_invoice_id text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), created_by uuid default auth.uid());

create table public.rp_billing_runs (
  id uuid primary key default gen_random_uuid(),
  billing_period text not null unique check (billing_period ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  status text not null default 'preview' check (status in ('preview','geprueft','freigegeben','rechnungen_erzeugt','prenotification_versendet','bereit_fuer_einzug','eingereicht','in_bearbeitung','bezahlt','teilweise_bezahlt','ruecklastschrift','fehler')),
  prepared_at timestamptz not null default now(),
  validated_at timestamptz,
  approved_at timestamptz, approved_by uuid, approval_confirmation text,
  idempotency_key text unique,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now());

create table public.rp_billing_run_items (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.rp_billing_runs(id),
  plan_id uuid not null references public.rp_payment_plans(id),
  customer_id uuid not null references public.customers(id),
  contract_id uuid,
  mandate_id uuid references public.rp_mandates(id),
  billing_period text not null,
  net_amount numeric(12,2) not null, tax_rate numeric(5,2), tax_amount numeric(12,2) not null, gross_amount numeric(12,2) not null,
  original_gross_amount numeric(12,2) not null,
  amount_overridden boolean not null default false,
  due_date date,
  status text not null default 'ready' check (status in ('ready','warning','blocker','removed','skipped','invoiced','prenotified','ready_for_debit','paid','partially_paid','return_debit','error')),
  issues jsonb not null default '[]'::jsonb,
  invoice_id uuid references public.zoho_invoices(id),
  paid_at date,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (run_id, plan_id));
create unique index uq_rp_final_billing on public.rp_billing_run_items (customer_id, coalesce(contract_id,'00000000-0000-0000-0000-000000000000'::uuid), plan_id, billing_period) where invoice_id is not null;

create table public.rp_period_skips (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.rp_payment_plans(id),
  billing_period text not null, reason text,
  created_at timestamptz not null default now(), created_by uuid default auth.uid(),
  unique (plan_id, billing_period));

create table public.rp_prenotifications (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null unique references public.rp_billing_run_items(id),
  invoice_id uuid references public.zoho_invoices(id),
  customer_id uuid not null references public.customers(id),
  amount numeric(12,2) not null, collection_date date not null,
  creditor_name text not null, creditor_id text not null, mandate_reference text,
  status text not null default 'erstellt' check (status in ('erstellt','versendet','teilweise','fehlgeschlagen')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now());

create table public.rp_notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  prenotification_id uuid not null references public.rp_prenotifications(id),
  channel text not null check (channel in ('email','sms')),
  recipient text,
  status text not null check (status in ('geplant','uebergeben','fehlgeschlagen')),
  is_resend boolean not null default false,
  provider_ref text, error text,
  created_at timestamptz not null default now(), created_by uuid default auth.uid());

create table public.rp_direct_debit_runs (
  id uuid primary key default gen_random_uuid(),
  billing_run_id uuid not null references public.rp_billing_runs(id),
  collection_date date, status text not null default 'vorbereitet' check (status in ('vorbereitet','exportiert','eingereicht','abgeschlossen','fehler')),
  total numeric(12,2), item_count int, file_path text,
  created_at timestamptz not null default now(), created_by uuid default auth.uid(), unique (billing_run_id));
create table public.rp_direct_debit_items (
  id uuid primary key default gen_random_uuid(),
  debit_run_id uuid not null references public.rp_direct_debit_runs(id),
  item_id uuid not null unique references public.rp_billing_run_items(id),
  mandate_id uuid references public.rp_mandates(id),
  amount numeric(12,2) not null, end_to_end_id text,
  status text not null default 'vorbereitet', created_at timestamptz not null default now());

create table public.rp_return_debits (
  id uuid primary key default gen_random_uuid(),
  item_id uuid references public.rp_billing_run_items(id),
  invoice_id uuid references public.zoho_invoices(id),
  customer_id uuid references public.customers(id),
  original_amount numeric(12,2), collection_date date, return_date date,
  bank_reference text, reason_code text, fee numeric(12,2),
  status text not null default 'offen' check (status in ('offen','kunde_kontaktiert','neuer_einzug_vorbereitet','zahlungsart_geaendert','aufgabe_erstellt','geklaert')),
  notes text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), created_by uuid default auth.uid());

create table public.rp_audit_log (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  actor uuid default auth.uid(),
  action text not null,
  entity text, entity_id uuid,
  customer_id uuid, contract_id uuid, invoice_id uuid, run_id uuid,
  old_value jsonb, new_value jsonb, note text);

-- Grants
grant select, insert, update, delete on public.rp_settings, public.rp_mandates, public.rp_payment_plans, public.rp_billing_runs, public.rp_billing_run_items, public.rp_period_skips, public.rp_prenotifications, public.rp_notification_deliveries, public.rp_direct_debit_runs, public.rp_direct_debit_items, public.rp_return_debits to authenticated;
grant select on public.rp_audit_log to authenticated;
grant all on public.rp_settings, public.rp_mandates, public.rp_payment_plans, public.rp_billing_runs, public.rp_billing_run_items, public.rp_period_skips, public.rp_prenotifications, public.rp_notification_deliveries, public.rp_direct_debit_runs, public.rp_direct_debit_items, public.rp_return_debits, public.rp_audit_log to service_role;

-- RLS
alter table public.rp_settings enable row level security;
alter table public.rp_mandates enable row level security;
alter table public.rp_payment_plans enable row level security;
alter table public.rp_billing_runs enable row level security;
alter table public.rp_billing_run_items enable row level security;
alter table public.rp_period_skips enable row level security;
alter table public.rp_prenotifications enable row level security;
alter table public.rp_notification_deliveries enable row level security;
alter table public.rp_direct_debit_runs enable row level security;
alter table public.rp_direct_debit_items enable row level security;
alter table public.rp_return_debits enable row level security;
alter table public.rp_audit_log enable row level security;

create policy rp_settings_sel on public.rp_settings for select to authenticated using (rp_can_view());
create policy rp_settings_upd on public.rp_settings for update to authenticated using (rp_can_manage()) with check (rp_can_manage());
-- Mandate: Vollzugriff (inkl. IBAN) nur Manage-Rollen; Leserollen nutzen rp_list_mandates (maskiert)
create policy rp_mandates_sel on public.rp_mandates for select to authenticated using (rp_can_manage());
create policy rp_mandates_ins on public.rp_mandates for insert to authenticated with check (rp_can_manage());
create policy rp_mandates_upd on public.rp_mandates for update to authenticated using (rp_can_manage()) with check (rp_can_manage());
create policy rp_plans_sel on public.rp_payment_plans for select to authenticated using (rp_can_view());
create policy rp_plans_ins on public.rp_payment_plans for insert to authenticated with check (rp_can_manage());
create policy rp_plans_upd on public.rp_payment_plans for update to authenticated using (rp_can_manage()) with check (rp_can_manage());
-- Läufe/Positionen/Vorabinfos: nur lesen; Änderungen ausschließlich über RPCs
create policy rp_runs_sel on public.rp_billing_runs for select to authenticated using (rp_can_view());
create policy rp_items_sel on public.rp_billing_run_items for select to authenticated using (rp_can_view());
create policy rp_skips_sel on public.rp_period_skips for select to authenticated using (rp_can_view());
create policy rp_pn_sel on public.rp_prenotifications for select to authenticated using (rp_can_view());
create policy rp_nd_sel on public.rp_notification_deliveries for select to authenticated using (rp_can_view());
create policy rp_ddr_sel on public.rp_direct_debit_runs for select to authenticated using (rp_can_view());
create policy rp_ddi_sel on public.rp_direct_debit_items for select to authenticated using (rp_can_view());
create policy rp_rd_sel on public.rp_return_debits for select to authenticated using (rp_can_view());
create policy rp_rd_ins on public.rp_return_debits for insert to authenticated with check (rp_can_manage());
create policy rp_audit_sel on public.rp_audit_log for select to authenticated using (rp_can_view());
do $$ declare t text; begin
  foreach t in array array['rp_settings','rp_mandates','rp_payment_plans','rp_billing_runs','rp_billing_run_items','rp_period_skips','rp_prenotifications','rp_notification_deliveries','rp_direct_debit_runs','rp_direct_debit_items','rp_return_debits'] loop
    execute format('create policy %I on public.%I for delete to authenticated using (has_role(''Super Admin''))', t||'_del', t);
  end loop; end $$;

-- Audit unveränderbar
create or replace function public.rp_audit_immutable() returns trigger language plpgsql as $$
begin raise exception 'rp_audit_log ist unveränderbar'; end $$;
create trigger trg_rp_audit_immutable before update or delete on public.rp_audit_log for each row execute function public.rp_audit_immutable();

create or replace function public.rp_audit(p_action text, p_entity text, p_entity_id uuid, p_customer uuid, p_contract uuid, p_invoice uuid, p_run uuid, p_old jsonb, p_new jsonb, p_note text default null)
returns void language sql security definer set search_path=public as $$
  insert into rp_audit_log(action, entity, entity_id, customer_id, contract_id, invoice_id, run_id, old_value, new_value, note)
  values (p_action, p_entity, p_entity_id, p_customer, p_contract, p_invoice, p_run, p_old, p_new, p_note) $$;
revoke execute on function public.rp_audit(text,text,uuid,uuid,uuid,uuid,uuid,jsonb,jsonb,text) from public, anon, authenticated;

-- Automatisches Audit für Stammdaten
create or replace function public.rp_audit_trg() returns trigger language plpgsql security definer set search_path=public as $$
declare o jsonb; n jsonb; cid uuid; ctr uuid;
begin
  o := case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) end;
  n := case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) end;
  if tg_table_name = 'rp_mandates' then
    if o ? 'iban' then o := o || jsonb_build_object('iban', left(o->>'iban',2)||'••••'||right(o->>'iban',4)); end if;
    if n ? 'iban' then n := n || jsonb_build_object('iban', left(n->>'iban',2)||'••••'||right(n->>'iban',4)); end if;
  end if;
  cid := coalesce((n->>'customer_id')::uuid, (o->>'customer_id')::uuid);
  ctr := nullif(coalesce(n->>'contract_id', o->>'contract_id'),'')::uuid;
  perform rp_audit(lower(tg_op)||'_'||tg_table_name, tg_table_name, coalesce((n->>'id')::uuid,(o->>'id')::uuid), cid, ctr, null, null, o, n);
  if tg_op='DELETE' then return old; end if;
  new.updated_at := now(); return new;
end $$;
create trigger trg_rp_mandates_audit before insert or update or delete on public.rp_mandates for each row execute function public.rp_audit_trg();
create trigger trg_rp_plans_audit before insert or update or delete on public.rp_payment_plans for each row execute function public.rp_audit_trg();
create or replace function public.rp_settings_audit() returns trigger language plpgsql security definer set search_path=public as $$
begin
  new.updated_at := now(); new.updated_by := auth.uid();
  if new.creditor_id is distinct from old.creditor_id and new.creditor_id_confirmed = old.creditor_id_confirmed then new.creditor_id_confirmed := false; end if;
  perform rp_audit('update_settings','rp_settings',null,null,null,null,null,to_jsonb(old),to_jsonb(new));
  return new; end $$;
create trigger trg_rp_settings_audit before update on public.rp_settings for each row execute function public.rp_settings_audit();

create or replace function public.rp_mask_iban(p text) returns text language sql immutable as $$
  select case when p is null or length(p) < 6 then p else left(p,2)||'••••••••'||right(p,4) end $$;

-- Maskierte Mandatsliste für alle Leserollen
create or replace function public.rp_list_mandates() returns table(id uuid, customer_id uuid, customer_name text, mandate_reference text, mandate_date date, account_holder text, iban_masked text, bic text, sequence_type text, status text, created_at timestamptz)
language plpgsql stable security definer set search_path=public as $$
begin
  if not rp_can_view() then raise exception 'Keine Berechtigung'; end if;
  return query select m.id, m.customer_id, coalesce(c.company_name, c.contact_name), m.mandate_reference, m.mandate_date, m.account_holder, rp_mask_iban(m.iban), m.bic, m.sequence_type, m.status, m.created_at
    from rp_mandates m join customers c on c.id=m.customer_id order by m.created_at desc;
end $$;

create or replace function public.rp_get_mandate_iban(p_mandate_id uuid) returns text language plpgsql security definer set search_path=public as $$
declare v text; cid uuid;
begin
  if not rp_can_manage() then raise exception 'Keine Berechtigung für Bankdaten'; end if;
  select iban, customer_id into v, cid from rp_mandates where id = p_mandate_id;
  perform rp_audit('view_iban','rp_mandates',p_mandate_id,cid,null,null,null,null,null);
  return v;
end $$;

-- Fälligkeit im Zeitraum?
create or replace function public.rp_plan_due_in(p public.rp_payment_plans, p_period text) returns boolean language sql immutable as $$
  select (to_date(p_period||'-01','YYYY-MM-DD') >= date_trunc('month', p.start_date)::date)
     and (p.end_date is null or to_date(p_period||'-01','YYYY-MM-DD') <= date_trunc('month', p.end_date)::date)
     and mod((((extract(year from to_date(p_period||'-01','YYYY-MM-DD'))*12 + extract(month from to_date(p_period||'-01','YYYY-MM-DD')))
          - (extract(year from p.start_date)*12 + extract(month from p.start_date)))::int), p.interval_months) = 0 $$;

-- Validierung einer Position
create or replace function public.rp_validate_item(p_item_id uuid) returns void language plpgsql security definer set search_path=public as $$
declare it rp_billing_run_items; pl rp_payment_plans; m rp_mandates; c customers; s rp_settings; ctr record; iss jsonb := '[]'; lvl text; has_zoho boolean;
  procedure_add text;
begin
  select * into it from rp_billing_run_items where id = p_item_id;
  if it.status not in ('ready','warning','blocker') then return; end if;
  select * into pl from rp_payment_plans where id = it.plan_id;
  select * into c from customers where id = it.customer_id;
  select * into s from rp_settings where id = 1;
  if it.mandate_id is not null then select * into m from rp_mandates where id = it.mandate_id; end if;

  if c.id is null then iss := iss || jsonb_build_object('level','BLOCKER','code','customer','msg','Kunde nicht gefunden'); end if;
  if pl.status <> 'aktiv' then iss := iss || jsonb_build_object('level','BLOCKER','code','plan','msg','Zahlungsplan nicht aktiv ('||pl.status||')'); end if;
  if pl.contract_id is not null then
    select status, end_date into ctr from finance_contracts where id = pl.contract_id;
    if ctr.status is null then iss := iss || jsonb_build_object('level','BLOCKER','code','contract','msg','Vertrag nicht gefunden');
    elsif lower(ctr.status) in ('beendet','gekuendigt','storniert','cancelled','ended','inaktiv') then iss := iss || jsonb_build_object('level','BLOCKER','code','contract','msg','Vertrag nicht aktiv ('||ctr.status||')'); end if;
  end if;
  if not rp_plan_due_in(pl, it.billing_period) then iss := iss || jsonb_build_object('level','BLOCKER','code','period','msg','Abrechnungsperiode passt nicht zum Zahlungsplan'); end if;
  if exists (select 1 from rp_billing_run_items x where x.plan_id = it.plan_id and x.billing_period = it.billing_period and x.invoice_id is not null and x.id <> it.id) then
    iss := iss || jsonb_build_object('level','BLOCKER','code','duplicate','msg','Rechnung für diesen Zeitraum bereits vorhanden'); end if;
  if coalesce(it.gross_amount,0) <= 0 then iss := iss || jsonb_build_object('level','BLOCKER','code','amount','msg','Betrag fehlt oder ist 0'); end if;
  if it.tax_rate is null then iss := iss || jsonb_build_object('level','BLOCKER','code','tax','msg','Steuersatz fehlt'); end if;
  if c.billing_address is null or coalesce(c.billing_address->>'address', c.billing_address->>'street', c.billing_address->>'street1', '') = '' or coalesce(c.billing_address->>'zip', c.billing_address->>'postal_code', c.billing_address->>'zipcode','') = '' then
    iss := iss || jsonb_build_object('level','WARNUNG','code','address','msg','Rechnungsadresse unvollständig'); end if;
  if it.due_date is null then iss := iss || jsonb_build_object('level','BLOCKER','code','due','msg','Fälligkeitsdatum fehlt'); end if;
  if pl.payment_method = 'sepa' then
    if m.id is null then iss := iss || jsonb_build_object('level','BLOCKER','code','mandate','msg','Kein SEPA-Mandat');
    else
      if m.status <> 'aktiv' then iss := iss || jsonb_build_object('level','BLOCKER','code','mandate_status','msg','Mandat nicht aktiv ('||m.status||')'); end if;
      if m.customer_id <> it.customer_id then iss := iss || jsonb_build_object('level','BLOCKER','code','mandate_owner','msg','Mandat gehört zu anderem Kunden'); end if;
      if coalesce(m.mandate_reference,'') = '' then iss := iss || jsonb_build_object('level','BLOCKER','code','mandate_ref','msg','Mandatsreferenz fehlt'); end if;
      if coalesce(m.iban,'') = '' then iss := iss || jsonb_build_object('level','BLOCKER','code','iban','msg','IBAN fehlt'); end if;
      if coalesce(m.account_holder,'') = '' then iss := iss || jsonb_build_object('level','WARNUNG','code','holder','msg','Kontoinhaber fehlt'); end if;
    end if;
    if coalesce(s.creditor_id,'') = '' then iss := iss || jsonb_build_object('level','BLOCKER','code','creditor','msg','Gläubiger-ID fehlt');
    elsif s.creditor_id !~ '^[A-Z]{2}[0-9]{2}[A-Z0-9]{3}[0-9A-Z]+$' or s.creditor_id ~ 'O[0-9O]*$' and s.creditor_id ~ '[0-9]O|O[0-9]' then iss := iss || jsonb_build_object('level','BLOCKER','code','creditor_format','msg','Gläubiger-ID sieht fehlerhaft aus (Buchstabe O statt 0?)');
    elsif not s.creditor_id_confirmed then iss := iss || jsonb_build_object('level','BLOCKER','code','creditor_confirm','msg','Gläubiger-ID noch nicht bestätigt (Einstellungen)'); end if;
    if it.due_date is not null and it.due_date < current_date + s.prenotification_days then
      iss := iss || jsonb_build_object('level','BLOCKER','code','prenotification','msg','Vorabinformation nicht mehr fristgerecht möglich ('||s.prenotification_days||' Tage Vorlauf)'); end if;
  else
    iss := iss || jsonb_build_object('level','HINWEIS','code','transfer','msg','Zahlungsart Überweisung – kein Lastschrifteinzug');
  end if;
  if pl.notify_channel in ('email','email_sms') and coalesce(pl.email, c.email, '') = '' then iss := iss || jsonb_build_object('level','BLOCKER','code','email','msg','E-Mail-Adresse fehlt'); end if;
  if pl.notify_channel in ('sms','email_sms') and coalesce(pl.phone, c.phone, '') = '' then iss := iss || jsonb_build_object('level','WARNUNG','code','phone','msg','Mobilnummer fehlt – SMS entfällt'); end if;
  if pl.zoho_recurring_invoice_id is not null then
    select exists(select 1 from zoho_recurring_profiles z where z.zoho_recurring_invoice_id = pl.zoho_recurring_invoice_id and lower(coalesce(z.status,'')) = 'active') into has_zoho;
    if has_zoho then iss := iss || jsonb_build_object('level','WARNUNG','code','zoho_active','msg','Profil in Zoho noch aktiv – dort stoppen, sonst Doppelrechnung'); end if;
  end if;
  if it.amount_overridden then iss := iss || jsonb_build_object('level','HINWEIS','code','override','msg','Betrag einmalig geändert (Original '||it.original_gross_amount||' €)'); end if;

  lvl := case when exists (select 1 from jsonb_array_elements(iss) e where e->>'level'='BLOCKER') then 'blocker'
              when exists (select 1 from jsonb_array_elements(iss) e where e->>'level'='WARNUNG') then 'warning' else 'ready' end;
  update rp_billing_run_items set issues = iss, status = lvl, updated_at = now() where id = p_item_id;
end $$;
revoke execute on function public.rp_validate_item(uuid) from public, anon, authenticated;

create or replace function public.rp_validate_run(p_run_id uuid) returns jsonb language plpgsql security definer set search_path=public as $$
declare r record; st text;
begin
  if not rp_can_view() then raise exception 'Keine Berechtigung'; end if;
  select status into st from rp_billing_runs where id = p_run_id;
  if st not in ('preview','geprueft') then return jsonb_build_object('ok',false,'error','Lauf ist bereits freigegeben'); end if;
  for r in select id from rp_billing_run_items where run_id = p_run_id and status in ('ready','warning','blocker') loop perform rp_validate_item(r.id); end loop;
  update rp_billing_runs set status='geprueft', validated_at=now(), updated_at=now() where id=p_run_id;
  return (select jsonb_build_object('ok',true,'ready',count(*) filter (where status='ready'),'warning',count(*) filter (where status='warning'),'blocker',count(*) filter (where status='blocker')) from rp_billing_run_items where run_id=p_run_id);
end $$;

-- Monatslauf vorbereiten (idempotent)
create or replace function public.rp_prepare_run(p_period text) returns uuid language plpgsql security definer set search_path=public as $$
declare rid uuid; st text; pl rp_payment_plans; due date; added int := 0; r record;
begin
  if not rp_can_view() then raise exception 'Keine Berechtigung'; end if;
  if p_period !~ '^\d{4}-(0[1-9]|1[0-2])$' then raise exception 'Ungültige Periode'; end if;
  insert into rp_billing_runs(billing_period) values (p_period) on conflict (billing_period) do nothing returning id into rid;
  if rid is null then select id, status into rid, st from rp_billing_runs where billing_period = p_period; else st := 'preview';
    perform rp_audit('run_prepared','rp_billing_runs',rid,null,null,null,rid,null,jsonb_build_object('period',p_period)); end if;
  perform 1 from rp_billing_runs where id = rid for update;
  if st not in ('preview','geprueft') then return rid; end if;
  for pl in select * from rp_payment_plans where status in ('aktiv','pausiert','fehler') loop
    continue when not rp_plan_due_in(pl, p_period);
    continue when pl.status = 'pausiert';
    due := make_date(split_part(p_period,'-',1)::int, split_part(p_period,'-',2)::int, pl.due_day);
    insert into rp_billing_run_items(run_id, plan_id, customer_id, contract_id, mandate_id, billing_period, net_amount, tax_rate, tax_amount, gross_amount, original_gross_amount, due_date, status)
    values (rid, pl.id, pl.customer_id, pl.contract_id, pl.mandate_id, p_period, pl.net_amount, pl.tax_rate, pl.gross_amount - pl.net_amount, pl.gross_amount, pl.gross_amount, due,
      case when exists (select 1 from rp_period_skips k where k.plan_id=pl.id and k.billing_period=p_period) then 'skipped' else 'ready' end)
    on conflict (run_id, plan_id) do nothing;
    if found then added := added + 1; end if;
  end loop;
  for r in select id from rp_billing_run_items where run_id = rid and status in ('ready','warning','blocker') loop perform rp_validate_item(r.id); end loop;
  update rp_billing_runs set updated_at = now() where id = rid;
  return rid;
end $$;

-- Massenaktionen
create or replace function public.rp_item_action(p_item_ids uuid[], p_action text, p_value text default null, p_reason text default null) returns int language plpgsql security definer set search_path=public as $$
declare it rp_billing_run_items; n int := 0; st text; newgross numeric; newnet numeric;
begin
  if not rp_can_manage() then raise exception 'Keine Berechtigung'; end if;
  if p_action not in ('remove','skip_month','restore','set_due','set_amount','revalidate') then raise exception 'Unbekannte Aktion'; end if;
  for it in select * from rp_billing_run_items where id = any(p_item_ids) for update loop
    select status into st from rp_billing_runs where id = it.run_id;
    if st not in ('preview','geprueft') then raise exception 'Lauf % ist bereits freigegeben – keine Änderung möglich', it.billing_period; end if;
    if it.invoice_id is not null then continue; end if;
    if p_action = 'remove' then
      update rp_billing_run_items set status='removed', updated_at=now() where id=it.id;
      perform rp_audit('item_removed','rp_billing_run_items',it.id,it.customer_id,it.contract_id,null,it.run_id,jsonb_build_object('status',it.status),jsonb_build_object('status','removed'),p_reason);
    elsif p_action = 'skip_month' then
      insert into rp_period_skips(plan_id,billing_period,reason) values (it.plan_id,it.billing_period,p_reason) on conflict do nothing;
      update rp_billing_run_items set status='skipped', updated_at=now() where id=it.id;
      perform rp_audit('period_skipped','rp_billing_run_items',it.id,it.customer_id,it.contract_id,null,it.run_id,jsonb_build_object('status',it.status),jsonb_build_object('status','skipped','period',it.billing_period),p_reason);
    elsif p_action = 'restore' then
      delete from rp_period_skips where plan_id=it.plan_id and billing_period=it.billing_period;
      update rp_billing_run_items set status='ready', updated_at=now() where id=it.id;
      perform rp_validate_item(it.id);
      perform rp_audit('item_restored','rp_billing_run_items',it.id,it.customer_id,it.contract_id,null,it.run_id,jsonb_build_object('status',it.status),jsonb_build_object('status','restored'),p_reason);
    elsif p_action = 'set_due' then
      update rp_billing_run_items set due_date = p_value::date, updated_at=now() where id=it.id;
      perform rp_validate_item(it.id);
      perform rp_audit('due_changed','rp_billing_run_items',it.id,it.customer_id,it.contract_id,null,it.run_id,jsonb_build_object('due_date',it.due_date),jsonb_build_object('due_date',p_value),p_reason);
    elsif p_action = 'set_amount' then
      newgross := round(p_value::numeric, 2);
      if newgross <= 0 then raise exception 'Betrag muss größer 0 sein'; end if;
      newnet := round(newgross / (1 + coalesce(it.tax_rate,0)/100), 2);
      update rp_billing_run_items set gross_amount=newgross, net_amount=newnet, tax_amount=newgross-newnet, amount_overridden = (newgross <> original_gross_amount), updated_at=now() where id=it.id;
      perform rp_validate_item(it.id);
      perform rp_audit('amount_changed','rp_billing_run_items',it.id,it.customer_id,it.contract_id,null,it.run_id,jsonb_build_object('gross',it.gross_amount,'original',it.original_gross_amount),jsonb_build_object('gross',newgross),p_reason);
    else
      perform rp_validate_item(it.id);
    end if;
    n := n + 1;
  end loop;
  return n;
end $$;

-- Freigabe (transaktional, idempotent, Duplikatsperre)
create or replace function public.rp_approve_run(p_run_id uuid, p_confirmation text, p_idempotency_key text) returns jsonb language plpgsql security definer set search_path=public as $$
declare run rp_billing_runs; it rp_billing_run_items; c customers; pl rp_payment_plans; m rp_mandates; s rp_settings; inv_id uuid; n int := 0; blockers int; total numeric := 0;
begin
  if not rp_can_manage() then raise exception 'Keine Berechtigung zur Freigabe'; end if;
  if p_confirmation is distinct from 'Ich habe den Monatslauf geprüft und möchte die ausgewählten Rechnungen erzeugen.' then raise exception 'Bestätigungstext fehlt'; end if;
  select * into run from rp_billing_runs where id = p_run_id for update;
  if run.id is null then raise exception 'Lauf nicht gefunden'; end if;
  if run.status not in ('preview','geprueft') then
    return jsonb_build_object('ok',true,'already',true,'status',run.status);
  end if;
  if exists (select 1 from rp_billing_runs where idempotency_key = p_idempotency_key and id <> p_run_id) then raise exception 'Idempotenzschlüssel bereits verwendet'; end if;
  -- Revalidierung serverseitig, Beträge aus DB
  for it in select * from rp_billing_run_items where run_id = p_run_id and status in ('ready','warning','blocker') loop perform rp_validate_item(it.id); end loop;
  select count(*) into blockers from rp_billing_run_items where run_id = p_run_id and status = 'blocker';
  if blockers > 0 then raise exception 'Freigabe nicht möglich: % Blocker vorhanden', blockers; end if;
  select * into s from rp_settings where id = 1;
  update rp_billing_runs set status='freigegeben', approved_at=now(), approved_by=auth.uid(), approval_confirmation=p_confirmation, idempotency_key=p_idempotency_key, updated_at=now() where id=p_run_id;
  for it in select * from rp_billing_run_items where run_id = p_run_id and status in ('ready','warning') and invoice_id is null for update loop
    select * into c from customers where id = it.customer_id;
    select * into pl from rp_payment_plans where id = it.plan_id;
    insert into zoho_invoices(source_system, zoho_invoice_id, reference_number, customer_id, customer_name, billing_address, invoice_date, due_date, currency, total, balance, status, payment_status, raw_data, synced_at, accounting_region)
    values ('zoho_eu_1', 'rp-'||it.id::text, 'WZ '||it.billing_period, c.external_customer_id, coalesce(c.company_name, c.contact_name), c.billing_address, current_date, it.due_date, 'EUR', it.gross_amount, it.gross_amount, 'sent', 'unpaid',
      jsonb_build_object('origin','alixwork_recurring','rp_item_id',it.id,'rp_run_id',p_run_id,'billing_period',it.billing_period,'line_items',jsonb_build_array(jsonb_build_object('name',pl.product,'description',coalesce(pl.description,'')||' ('||it.billing_period||')','quantity',1,'rate',it.net_amount,'tax_percentage',it.tax_rate,'item_total',it.net_amount)),'sub_total',it.net_amount,'tax_total',it.tax_amount,'total',it.gross_amount,'payment_method',pl.payment_method),
      now(), coalesce(c.accounting_region,'EU'))
    returning id into inv_id;
    perform assign_invoice_number(inv_id);
    update rp_billing_run_items set invoice_id = inv_id, status = 'invoiced', updated_at = now() where id = it.id;
    if pl.payment_method = 'sepa' then
      select * into m from rp_mandates where id = it.mandate_id;
      insert into rp_prenotifications(item_id, invoice_id, customer_id, amount, collection_date, creditor_name, creditor_id, mandate_reference)
      values (it.id, inv_id, it.customer_id, it.gross_amount, it.due_date, s.creditor_name, s.creditor_id, m.mandate_reference);
    end if;
    perform rp_audit('invoice_created','zoho_invoices',inv_id,it.customer_id,it.contract_id,inv_id,p_run_id,null,jsonb_build_object('amount',it.gross_amount,'period',it.billing_period));
    n := n + 1; total := total + it.gross_amount;
  end loop;
  update rp_billing_runs set status='rechnungen_erzeugt', updated_at=now() where id=p_run_id;
  perform rp_audit('run_approved','rp_billing_runs',p_run_id,null,null,null,p_run_id,jsonb_build_object('status',run.status),jsonb_build_object('status','rechnungen_erzeugt','invoices',n,'total',total));
  return jsonb_build_object('ok',true,'invoices',n,'total',total);
end $$;

-- Versandprotokoll (aus Edge Function)
create or replace function public.rp_log_delivery(p_prenotification_id uuid, p_channel text, p_recipient text, p_status text, p_is_resend boolean, p_provider_ref text, p_error text) returns void language plpgsql security definer set search_path=public as $$
declare pn rp_prenotifications; ok_email boolean; ok_any boolean; fail_any boolean;
begin
  if not rp_can_manage() then raise exception 'Keine Berechtigung'; end if;
  select * into pn from rp_prenotifications where id = p_prenotification_id;
  insert into rp_notification_deliveries(prenotification_id, channel, recipient, status, is_resend, provider_ref, error)
  values (p_prenotification_id, p_channel, p_recipient, p_status, p_is_resend, p_provider_ref, left(p_error, 500));
  select bool_or(status='uebergeben'), bool_or(status='fehlgeschlagen') into ok_any, fail_any from rp_notification_deliveries where prenotification_id = p_prenotification_id;
  update rp_prenotifications set status = case when ok_any and fail_any then 'teilweise' when ok_any then 'versendet' else 'fehlgeschlagen' end, updated_at = now() where id = p_prenotification_id;
  if ok_any then update rp_billing_run_items set status='prenotified', updated_at=now() where id = pn.item_id and status='invoiced'; end if;
  perform rp_audit(case when p_is_resend then 'resend_' else 'send_' end || p_channel, 'rp_prenotifications', p_prenotification_id, pn.customer_id, null, pn.invoice_id, null, null, jsonb_build_object('status',p_status,'recipient',p_recipient,'error',p_error));
end $$;

-- Nach Versand: bereit für Einzug + Einzugsvorbereitung (kein Bankeinzug!)
create or replace function public.rp_prepare_direct_debit(p_run_id uuid) returns jsonb language plpgsql security definer set search_path=public as $$
declare dr uuid; n int;
begin
  if not rp_can_manage() then raise exception 'Keine Berechtigung'; end if;
  if exists (select 1 from rp_billing_run_items i left join rp_prenotifications p on p.item_id=i.id where i.run_id=p_run_id and i.status='invoiced' and p.id is not null) then
    raise exception 'Noch nicht alle Vorabinformationen versendet'; end if;
  insert into rp_direct_debit_runs(billing_run_id) values (p_run_id) on conflict (billing_run_id) do nothing;
  select id into dr from rp_direct_debit_runs where billing_run_id = p_run_id;
  insert into rp_direct_debit_items(debit_run_id, item_id, mandate_id, amount, end_to_end_id)
    select dr, i.id, i.mandate_id, i.gross_amount, 'WZ'||replace(i.billing_period,'-','')||left(replace(i.id::text,'-',''),12)
    from rp_billing_run_items i join rp_prenotifications p on p.item_id=i.id where i.run_id=p_run_id and i.status='prenotified'
    on conflict (item_id) do nothing;
  update rp_billing_run_items set status='ready_for_debit', updated_at=now() where run_id=p_run_id and status='prenotified';
  select count(*) into n from rp_direct_debit_items where debit_run_id=dr;
  update rp_direct_debit_runs set item_count=n, total=(select sum(amount) from rp_direct_debit_items where debit_run_id=dr), collection_date=(select min(due_date) from rp_billing_run_items where run_id=p_run_id) where id=dr;
  update rp_billing_runs set status='bereit_fuer_einzug', updated_at=now() where id=p_run_id;
  perform rp_audit('debit_prepared','rp_direct_debit_runs',dr,null,null,null,p_run_id,null,jsonb_build_object('items',n));
  return jsonb_build_object('ok',true,'items',n);
end $$;

-- Zahlungsstatus aus Bank & Zuordnung übernehmen (nur eindeutig: Rechnung vollständig ausgeglichen)
create or replace function public.rp_sync_payments(p_run_id uuid) returns int language plpgsql security definer set search_path=public as $$
declare n int := 0; r record;
begin
  if not rp_can_view() then raise exception 'Keine Berechtigung'; end if;
  for r in select i.id, i.customer_id, i.invoice_id, i.status, z.balance, z.total, z.last_payment_date from rp_billing_run_items i join zoho_invoices z on z.id=i.invoice_id
           where i.run_id=p_run_id and i.status in ('invoiced','prenotified','ready_for_debit','partially_paid') loop
    if coalesce(r.balance,0) <= 0.009 then
      update rp_billing_run_items set status='paid', paid_at=coalesce(r.last_payment_date,current_date), updated_at=now() where id=r.id;
      perform rp_audit('item_paid','rp_billing_run_items',r.id,r.customer_id,null,r.invoice_id,p_run_id,jsonb_build_object('status',r.status),jsonb_build_object('status','paid')); n := n+1;
    elsif r.balance < r.total and r.status <> 'partially_paid' then
      update rp_billing_run_items set status='partially_paid', updated_at=now() where id=r.id;
      perform rp_audit('item_partially_paid','rp_billing_run_items',r.id,r.customer_id,null,r.invoice_id,p_run_id,jsonb_build_object('status',r.status),jsonb_build_object('balance',r.balance)); n := n+1;
    end if;
  end loop;
  if not exists (select 1 from rp_billing_run_items where run_id=p_run_id and status in ('invoiced','prenotified','ready_for_debit','partially_paid','return_debit'))
     and exists (select 1 from rp_billing_run_items where run_id=p_run_id and status='paid') then
    update rp_billing_runs set status='bezahlt', updated_at=now() where id=p_run_id and status not in ('preview','geprueft');
  end if;
  return n;
end $$;

-- Rücklastschrift-Aktionen
create or replace function public.rp_return_debit_action(p_id uuid, p_status text, p_note text) returns void language plpgsql security definer set search_path=public as $$
declare rd rp_return_debits;
begin
  if not rp_can_manage() then raise exception 'Keine Berechtigung'; end if;
  select * into rd from rp_return_debits where id=p_id for update;
  update rp_return_debits set status=p_status, notes=coalesce(notes||E'\n','')||to_char(now(),'DD.MM.YYYY HH24:MI')||' '||coalesce(p_note,''), updated_at=now() where id=p_id;
  if rd.item_id is not null then update rp_billing_run_items set status='return_debit', updated_at=now() where id=rd.item_id and status <> 'return_debit'; end if;
  perform rp_audit('return_debit_'||p_status,'rp_return_debits',p_id,rd.customer_id,null,rd.invoice_id,null,jsonb_build_object('status',rd.status),jsonb_build_object('status',p_status),p_note);
end $$;

create or replace function public.rp_confirm_creditor(p_creditor_id text) returns void language plpgsql security definer set search_path=public as $$
begin
  if not rp_can_manage() then raise exception 'Keine Berechtigung'; end if;
  if p_creditor_id !~ '^[A-Z]{2}[0-9]{2}ZZZ[0-9]{11}$' then raise exception 'Gläubiger-ID ungültig (Format DEkkZZZ + 11 Ziffern)'; end if;
  update rp_settings set creditor_id = p_creditor_id where id=1;
  update rp_settings set creditor_id_confirmed = true where id=1;
  perform rp_audit('creditor_confirmed','rp_settings',null,null,null,null,null,null,jsonb_build_object('creditor_id',p_creditor_id));
end $$;

grant execute on function public.rp_list_mandates(), public.rp_get_mandate_iban(uuid), public.rp_validate_run(uuid), public.rp_prepare_run(text), public.rp_item_action(uuid[],text,text,text), public.rp_approve_run(uuid,text,text), public.rp_log_delivery(uuid,text,text,text,boolean,text,text), public.rp_prepare_direct_debit(uuid), public.rp_sync_payments(uuid), public.rp_return_debit_action(uuid,text,text), public.rp_confirm_creditor(text), public.rp_can_view(), public.rp_can_manage() to authenticated;
revoke execute on function public.rp_prepare_run(text), public.rp_approve_run(uuid,text,text), public.rp_item_action(uuid[],text,text,text), public.rp_log_delivery(uuid,text,text,text,boolean,text,text) from anon;
