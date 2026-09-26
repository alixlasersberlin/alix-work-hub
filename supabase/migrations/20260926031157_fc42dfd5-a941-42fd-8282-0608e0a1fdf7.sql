
alter table public.rp_payment_plans drop constraint if exists rp_payment_plans_payment_method_check;
alter table public.rp_payment_plans add constraint rp_payment_plans_payment_method_check check (payment_method in ('sepa','ueberweisung','dauerauftrag','rechnung','bar','sonstige'));
alter table public.rp_payment_plans
  add column plan_type text not null default 'laufend' check (plan_type in ('laufend','raten')),
  add column total_amount numeric(12,2),
  add column down_payment numeric(12,2) not null default 0,
  add column installment_count int check (installment_count is null or installment_count between 1 and 240),
  add column sms_enabled boolean not null default false;

alter table public.rp_billing_run_items
  add column payment_method text,
  add column installment_number int,
  add column installment_count int,
  add column paid_amount numeric(12,2) not null default 0,
  add column overpaid_amount numeric(12,2) not null default 0;
alter table public.rp_billing_run_items drop constraint if exists rp_billing_run_items_status_check;
alter table public.rp_billing_run_items add constraint rp_billing_run_items_status_check check (status in ('ready','warning','blocker','removed','skipped','invoiced','prenotified','ready_for_debit','paid','partially_paid','overpaid','return_debit','error'));
create unique index uq_rp_final_installment on public.rp_billing_run_items (plan_id, installment_number) where invoice_id is not null and installment_number is not null;

alter table public.rp_prenotifications add column kind text not null default 'sepa' check (kind in ('sepa','zahlungsinfo'));
alter table public.rp_prenotifications alter column creditor_id drop not null;

alter table public.rp_settings
  add column info_email_subject text not null default 'Zahlungsinformation – Rate {{installment_number}}/{{installment_count}} – Rechnung {{invoice_number}}',
  add column info_email_body text not null default E'Guten Tag {{customer_name}},\n\nIhre nächste Rate in Höhe von {{amount}} ist am {{due_date}} fällig.\n\nRate: {{installment_number}} von {{installment_count}}\nRechnung: {{invoice_number}}\n\nBitte überweisen Sie den Rechnungsbetrag unter Angabe der Rechnungsnummer.\n\nDie Rechnung finden Sie im Anhang bzw. in Ihrem Kundenportal.\n\nFreundliche Grüße\nAlix Lasers ®',
  add column info_sms_body text not null default 'ALIX: Ihre Rate {{installment_number}}/{{installment_count}} über {{amount}} ist am {{due_date}} fällig. Rechnung {{invoice_number}} wurde per E-Mail bereitgestellt.';

create table public.rp_special_payments (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.rp_payment_plans(id),
  amount numeric(12,2) not null check (amount > 0),
  payment_date date not null default current_date,
  note text,
  created_at timestamptz not null default now(), created_by uuid default auth.uid());
grant select, insert, delete on public.rp_special_payments to authenticated;
grant all on public.rp_special_payments to service_role;
alter table public.rp_special_payments enable row level security;
create policy rp_sp_sel on public.rp_special_payments for select to authenticated using (rp_can_view());
create policy rp_sp_ins on public.rp_special_payments for insert to authenticated with check (rp_can_manage());
create policy rp_sp_del on public.rp_special_payments for delete to authenticated using (has_role('Super Admin'));
create or replace function public.rp_sp_audit() returns trigger language plpgsql security definer set search_path=public as $$
begin perform rp_audit('special_payment','rp_special_payments',new.id,(select customer_id from rp_payment_plans where id=new.plan_id),null,null,null,null,to_jsonb(new),new.note); return new; end $$;
create trigger trg_rp_sp_audit after insert on public.rp_special_payments for each row execute function public.rp_sp_audit();
revoke execute on function public.rp_sp_audit() from public, anon, authenticated;

grant insert, delete on public.rp_period_skips to authenticated;
create policy rp_skips_ins on public.rp_period_skips for insert to authenticated with check (rp_can_manage());
create or replace function public.rp_skip_audit() returns trigger language plpgsql security definer set search_path=public as $$
begin perform rp_audit('period_skipped','rp_period_skips',new.id,(select customer_id from rp_payment_plans where id=new.plan_id),null,null,null,null,to_jsonb(new),new.reason); return new; end $$;
create trigger trg_rp_skip_audit after insert on public.rp_period_skips for each row execute function public.rp_skip_audit();
revoke execute on function public.rp_skip_audit() from public, anon, authenticated;

-- Hilfsfunktionen
create or replace function public.rp_invoiced_count(p_plan uuid) returns int language sql stable security definer set search_path=public as $$
  select count(*)::int from rp_billing_run_items where plan_id=p_plan and invoice_id is not null and installment_number is not null $$;
create or replace function public.rp_financed_amount(p public.rp_payment_plans) returns numeric language sql stable set search_path=public as $$
  select case when p.total_amount is not null then p.total_amount - coalesce(p.down_payment,0) else coalesce(p.installment_count,0) * p.gross_amount end $$;
revoke execute on function public.rp_invoiced_count(uuid), public.rp_financed_amount(public.rp_payment_plans) from public, anon;

-- Validierung (zahlungsartabhängig)
create or replace function public.rp_validate_item(p_item_id uuid) returns void language plpgsql security definer set search_path=public as $$
declare it rp_billing_run_items; pl rp_payment_plans; m rp_mandates; c customers; s rp_settings; ctr record; iss jsonb := '[]'; lvl text; has_zoho boolean; exp numeric; sp numeric;
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
    select status into ctr from finance_contracts where id = pl.contract_id;
    if ctr.status is null then iss := iss || jsonb_build_object('level','BLOCKER','code','contract','msg','Vertrag nicht gefunden');
    elsif lower(ctr.status) in ('beendet','gekuendigt','storniert','cancelled','ended','inaktiv') then iss := iss || jsonb_build_object('level','BLOCKER','code','contract','msg','Vertrag nicht aktiv ('||ctr.status||')'); end if;
  end if;
  if not rp_plan_due_in(pl, it.billing_period) then iss := iss || jsonb_build_object('level','BLOCKER','code','period','msg','Abrechnungsperiode passt nicht zum Zahlungsplan'); end if;
  if exists (select 1 from rp_billing_run_items x where x.plan_id = it.plan_id and x.billing_period = it.billing_period and x.invoice_id is not null and x.id <> it.id) then
    iss := iss || jsonb_build_object('level','BLOCKER','code','duplicate','msg','Rechnung für diesen Zeitraum bereits vorhanden'); end if;
  if it.installment_number is not null and exists (select 1 from rp_billing_run_items x where x.plan_id = it.plan_id and x.installment_number = it.installment_number and x.invoice_id is not null and x.id <> it.id) then
    iss := iss || jsonb_build_object('level','BLOCKER','code','dup_rate','msg','Rate '||it.installment_number||' wurde bereits berechnet'); end if;
  if pl.plan_type = 'raten' and pl.installment_count is not null and it.installment_number > pl.installment_count then
    iss := iss || jsonb_build_object('level','BLOCKER','code','rate_over','msg','Alle Raten bereits berechnet'); end if;
  if coalesce(it.gross_amount,0) <= 0 then iss := iss || jsonb_build_object('level','BLOCKER','code','amount','msg','Betrag fehlt oder ist 0'); end if;
  if it.tax_rate is null then iss := iss || jsonb_build_object('level','BLOCKER','code','tax','msg','Steuersatz fehlt'); end if;
  if c.billing_address is null or coalesce(c.billing_address->>'address', c.billing_address->>'street', c.billing_address->>'street1', '') = '' or coalesce(c.billing_address->>'zip', c.billing_address->>'postal_code', c.billing_address->>'zipcode','') = '' then
    iss := iss || jsonb_build_object('level','WARNUNG','code','address','msg','Rechnungsadresse unvollständig'); end if;
  if it.due_date is null then iss := iss || jsonb_build_object('level','BLOCKER','code','due','msg','Fälligkeitsdatum fehlt'); end if;
  if pl.payment_method is null then iss := iss || jsonb_build_object('level','BLOCKER','code','method','msg','Zahlungsart fehlt'); end if;

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
    elsif not s.creditor_id_confirmed then iss := iss || jsonb_build_object('level','BLOCKER','code','creditor_confirm','msg','Gläubiger-ID noch nicht bestätigt (Einstellungen)'); end if;
    if it.due_date is not null and it.due_date < current_date + s.prenotification_days then
      iss := iss || jsonb_build_object('level','BLOCKER','code','prenotification','msg','Vorabinformation nicht mehr fristgerecht möglich ('||s.prenotification_days||' Tage Vorlauf)'); end if;
    if pl.notify_channel in ('email','email_sms') and coalesce(pl.email, c.email, '') = '' then iss := iss || jsonb_build_object('level','BLOCKER','code','email','msg','E-Mail-Adresse fehlt (Vorabinformation Pflicht)'); end if;
  else
    iss := iss || jsonb_build_object('level','HINWEIS','code','selfpay','msg', case pl.payment_method when 'dauerauftrag' then 'Dauerauftrag – Zahlung abwarten' when 'bar' then 'Barzahlung' else 'Selbstzahler – Zahlungsinformation statt Lastschrift' end);
    if pl.payment_method in ('ueberweisung','rechnung','sonstige') and pl.notify_channel in ('email','email_sms') and coalesce(pl.email, c.email, '') = '' then
      iss := iss || jsonb_build_object('level','WARNUNG','code','email','msg','E-Mail-Adresse fehlt – Zahlungsinformation kann nicht versendet werden'); end if;
  end if;
  if (pl.notify_channel in ('sms','email_sms') or pl.sms_enabled) and coalesce(pl.phone, c.phone, '') = '' then iss := iss || jsonb_build_object('level','WARNUNG','code','phone','msg','Mobilnummer fehlt – SMS entfällt'); end if;
  if pl.plan_type = 'raten' then
    if pl.installment_count is null then iss := iss || jsonb_build_object('level','BLOCKER','code','rate_count','msg','Anzahl Raten fehlt');
    elsif pl.total_amount is not null then
      select coalesce(sum(amount),0) into sp from rp_special_payments where plan_id = pl.id;
      exp := coalesce(pl.down_payment,0) + pl.installment_count * pl.gross_amount + sp;
      if abs(exp - pl.total_amount) > 0.05 then iss := iss || jsonb_build_object('level','WARNUNG','code','consistency','msg','Anzahlung + Raten + Sonderzahlungen = '||exp||' € ≠ Vertragssumme '||pl.total_amount||' €'); end if;
    end if;
  end if;
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

-- Vorbereiten mit Ratennummern
create or replace function public.rp_prepare_run(p_period text) returns uuid language plpgsql security definer set search_path=public as $$
declare rid uuid; st text; pl rp_payment_plans; due date; r record; nr int;
begin
  if not rp_can_view() then raise exception 'Keine Berechtigung'; end if;
  if p_period !~ '^\d{4}-(0[1-9]|1[0-2])$' then raise exception 'Ungültige Periode'; end if;
  insert into rp_billing_runs(billing_period) values (p_period) on conflict (billing_period) do nothing returning id into rid;
  if rid is null then select id, status into rid, st from rp_billing_runs where billing_period = p_period; else st := 'preview';
    perform rp_audit('run_prepared','rp_billing_runs',rid,null,null,null,rid,null,jsonb_build_object('period',p_period)); end if;
  perform 1 from rp_billing_runs where id = rid for update;
  if st not in ('preview','geprueft') then return rid; end if;
  for pl in select * from rp_payment_plans where status in ('aktiv','fehler') loop
    continue when not rp_plan_due_in(pl, p_period);
    nr := null;
    if pl.plan_type = 'raten' then
      nr := rp_invoiced_count(pl.id) + 1;
      continue when pl.installment_count is not null and nr > pl.installment_count;
    end if;
    due := make_date(split_part(p_period,'-',1)::int, split_part(p_period,'-',2)::int, pl.due_day);
    insert into rp_billing_run_items(run_id, plan_id, customer_id, contract_id, mandate_id, billing_period, net_amount, tax_rate, tax_amount, gross_amount, original_gross_amount, due_date, status, payment_method, installment_number, installment_count)
    values (rid, pl.id, pl.customer_id, pl.contract_id, case when pl.payment_method='sepa' then pl.mandate_id end, p_period, pl.net_amount, pl.tax_rate, pl.gross_amount - pl.net_amount, pl.gross_amount, pl.gross_amount, due,
      case when exists (select 1 from rp_period_skips k where k.plan_id=pl.id and k.billing_period=p_period) then 'skipped' else 'ready' end,
      pl.payment_method, nr, pl.installment_count)
    on conflict (run_id, plan_id) do nothing;
  end loop;
  for r in select id from rp_billing_run_items where run_id = rid and status in ('ready','warning','blocker') loop perform rp_validate_item(r.id); end loop;
  update rp_billing_runs set updated_at = now() where id = rid;
  return rid;
end $$;

-- Freigabe: SEPA → Vorabinfo, Überweisung/Rechnung/Sonstige → Zahlungsinfo, Dauerauftrag/Bar → keine
create or replace function public.rp_approve_run(p_run_id uuid, p_confirmation text, p_idempotency_key text) returns jsonb language plpgsql security definer set search_path=public as $$
declare run rp_billing_runs; it rp_billing_run_items; c customers; pl rp_payment_plans; m rp_mandates; s rp_settings; inv_id uuid; n int := 0; blockers int; total numeric := 0; label text;
begin
  if not rp_can_manage() then raise exception 'Keine Berechtigung zur Freigabe'; end if;
  if p_confirmation is distinct from 'Ich habe den Monatslauf geprüft und möchte die ausgewählten Rechnungen erzeugen.' then raise exception 'Bestätigungstext fehlt'; end if;
  select * into run from rp_billing_runs where id = p_run_id for update;
  if run.id is null then raise exception 'Lauf nicht gefunden'; end if;
  if run.status not in ('preview','geprueft') then return jsonb_build_object('ok',true,'already',true,'status',run.status); end if;
  if exists (select 1 from rp_billing_runs where idempotency_key = p_idempotency_key and id <> p_run_id) then raise exception 'Idempotenzschlüssel bereits verwendet'; end if;
  for it in select * from rp_billing_run_items where run_id = p_run_id and status in ('ready','warning','blocker') loop perform rp_validate_item(it.id); end loop;
  select count(*) into blockers from rp_billing_run_items where run_id = p_run_id and status = 'blocker';
  if blockers > 0 then raise exception 'Freigabe nicht möglich: % Blocker vorhanden', blockers; end if;
  select * into s from rp_settings where id = 1;
  update rp_billing_runs set status='freigegeben', approved_at=now(), approved_by=auth.uid(), approval_confirmation=p_confirmation, idempotency_key=p_idempotency_key, updated_at=now() where id=p_run_id;
  for it in select * from rp_billing_run_items where run_id = p_run_id and status in ('ready','warning') and invoice_id is null for update loop
    select * into c from customers where id = it.customer_id;
    select * into pl from rp_payment_plans where id = it.plan_id;
    label := coalesce(pl.description,'') || case when it.installment_number is not null then ' – Rate '||it.installment_number||'/'||coalesce(it.installment_count::text,'?') else ' ('||it.billing_period||')' end;
    insert into zoho_invoices(source_system, zoho_invoice_id, reference_number, customer_id, customer_name, billing_address, invoice_date, due_date, currency, total, balance, status, payment_status, raw_data, synced_at, accounting_region)
    values ('zoho_eu_1', 'rp-'||it.id::text, case when it.installment_number is not null then 'Rate '||it.installment_number||'/'||coalesce(it.installment_count::text,'?') else 'WZ '||it.billing_period end,
      c.external_customer_id, coalesce(c.company_name, c.contact_name), c.billing_address, current_date, it.due_date, 'EUR', it.gross_amount, it.gross_amount, 'sent', 'unpaid',
      jsonb_build_object('origin','alixwork_recurring','rp_item_id',it.id,'rp_run_id',p_run_id,'rp_plan_id',it.plan_id,'contract_id',it.contract_id,'billing_period',it.billing_period,'installment_number',it.installment_number,'installment_count',it.installment_count,
        'line_items',jsonb_build_array(jsonb_build_object('name',pl.product,'description',trim(label),'quantity',1,'rate',it.net_amount,'tax_percentage',it.tax_rate,'item_total',it.net_amount)),'sub_total',it.net_amount,'tax_total',it.tax_amount,'total',it.gross_amount,'payment_method',pl.payment_method),
      now(), coalesce(c.accounting_region,'EU'))
    returning id into inv_id;
    perform assign_invoice_number(inv_id);
    update rp_billing_run_items set invoice_id = inv_id, status = 'invoiced', updated_at = now() where id = it.id;
    if pl.payment_method = 'sepa' then
      select * into m from rp_mandates where id = it.mandate_id;
      insert into rp_prenotifications(item_id, invoice_id, customer_id, amount, collection_date, creditor_name, creditor_id, mandate_reference, kind)
      values (it.id, inv_id, it.customer_id, it.gross_amount, it.due_date, s.creditor_name, s.creditor_id, m.mandate_reference, 'sepa');
    elsif pl.payment_method in ('ueberweisung','rechnung','sonstige') then
      insert into rp_prenotifications(item_id, invoice_id, customer_id, amount, collection_date, creditor_name, creditor_id, mandate_reference, kind)
      values (it.id, inv_id, it.customer_id, it.gross_amount, it.due_date, s.creditor_name, null, null, 'zahlungsinfo');
    end if;
    perform rp_audit('invoice_created','zoho_invoices',inv_id,it.customer_id,it.contract_id,inv_id,p_run_id,null,jsonb_build_object('amount',it.gross_amount,'period',it.billing_period,'rate',it.installment_number,'method',pl.payment_method));
    n := n + 1; total := total + it.gross_amount;
  end loop;
  update rp_billing_runs set status='rechnungen_erzeugt', updated_at=now() where id=p_run_id;
  perform rp_audit('run_approved','rp_billing_runs',p_run_id,null,null,null,p_run_id,jsonb_build_object('status',run.status),jsonb_build_object('status','rechnungen_erzeugt','invoices',n,'total',total));
  return jsonb_build_object('ok',true,'invoices',n,'total',total);
end $$;

create or replace function public.rp_prepare_direct_debit(p_run_id uuid) returns jsonb language plpgsql security definer set search_path=public as $$
declare dr uuid; n int;
begin
  if not rp_can_manage() then raise exception 'Keine Berechtigung'; end if;
  if exists (select 1 from rp_billing_run_items i join rp_prenotifications p on p.item_id=i.id and p.kind='sepa' where i.run_id=p_run_id and i.status='invoiced') then
    raise exception 'Noch nicht alle SEPA-Vorabinformationen versendet'; end if;
  insert into rp_direct_debit_runs(billing_run_id) values (p_run_id) on conflict (billing_run_id) do nothing;
  select id into dr from rp_direct_debit_runs where billing_run_id = p_run_id;
  insert into rp_direct_debit_items(debit_run_id, item_id, mandate_id, amount, end_to_end_id)
    select dr, i.id, i.mandate_id, i.gross_amount, 'WZ'||replace(i.billing_period,'-','')||left(replace(i.id::text,'-',''),12)
    from rp_billing_run_items i join rp_prenotifications p on p.item_id=i.id and p.kind='sepa' where i.run_id=p_run_id and i.status='prenotified'
    on conflict (item_id) do nothing;
  update rp_billing_run_items i set status='ready_for_debit', updated_at=now() from rp_prenotifications p where p.item_id=i.id and p.kind='sepa' and i.run_id=p_run_id and i.status='prenotified';
  select count(*) into n from rp_direct_debit_items where debit_run_id=dr;
  update rp_direct_debit_runs set item_count=n, total=(select sum(amount) from rp_direct_debit_items where debit_run_id=dr), collection_date=(select min(due_date) from rp_billing_run_items where run_id=p_run_id and payment_method='sepa') where id=dr;
  update rp_billing_runs set status='bereit_fuer_einzug', updated_at=now() where id=p_run_id;
  perform rp_audit('debit_prepared','rp_direct_debit_runs',dr,null,null,null,p_run_id,null,jsonb_build_object('items',n));
  return jsonb_build_object('ok',true,'items',n);
end $$;

-- Zahlungsabgleich inkl. Teil- und Überzahlung (nur auf Basis der in Bank & Zuordnung ausgeglichenen Rechnung)
create or replace function public.rp_sync_payments(p_run_id uuid) returns int language plpgsql security definer set search_path=public as $$
declare n int := 0; r record; paid numeric; newst text;
begin
  if not rp_can_view() then raise exception 'Keine Berechtigung'; end if;
  for r in select i.id, i.customer_id, i.invoice_id, i.status, i.paid_amount, z.balance, z.total, z.last_payment_date from rp_billing_run_items i join zoho_invoices z on z.id=i.invoice_id
           where (p_run_id is null or i.run_id=p_run_id) and i.status in ('invoiced','prenotified','ready_for_debit','partially_paid','overpaid','paid') loop
    paid := coalesce(r.total,0) - coalesce(r.balance,0);
    newst := case when coalesce(r.balance,0) < -0.009 then 'overpaid' when coalesce(r.balance,0) <= 0.009 then 'paid' when paid > 0.009 then 'partially_paid' else r.status end;
    if newst <> r.status or paid <> r.paid_amount then
      update rp_billing_run_items set status=newst, paid_amount=paid, overpaid_amount=greatest(-coalesce(r.balance,0),0),
        paid_at=case when newst in ('paid','overpaid') then coalesce(r.last_payment_date,current_date) else paid_at end, updated_at=now() where id=r.id;
      perform rp_audit('item_'||newst,'rp_billing_run_items',r.id,r.customer_id,null,r.invoice_id,p_run_id,jsonb_build_object('status',r.status,'paid',r.paid_amount),jsonb_build_object('status',newst,'paid',paid,'balance',r.balance)); n := n+1;
    end if;
  end loop;
  if p_run_id is not null and not exists (select 1 from rp_billing_run_items where run_id=p_run_id and status in ('invoiced','prenotified','ready_for_debit','partially_paid','overpaid','return_debit'))
     and exists (select 1 from rp_billing_run_items where run_id=p_run_id and status='paid') then
    update rp_billing_runs set status='bezahlt', updated_at=now() where id=p_run_id and status not in ('preview','geprueft');
  end if;
  return n;
end $$;

-- Ratenplan-Tabelle
create or replace function public.rp_installment_schedule(p_plan_id uuid)
returns table(installment_number int, due_date date, amount numeric, invoice_id uuid, invoice_number text, paid_amount numeric, open_amount numeric, status text, days_overdue int, billing_period text)
language plpgsql stable security definer set search_path=public as $$
declare pl rp_payment_plans; k int; per date; last_nr int := 0; last_per date; bal numeric;
begin
  if not rp_can_view() then raise exception 'Keine Berechtigung'; end if;
  select * into pl from rp_payment_plans where id = p_plan_id;
  if pl.id is null or pl.plan_type <> 'raten' then return; end if;
  for installment_number, due_date, amount, invoice_id, invoice_number, paid_amount, open_amount, status, billing_period in
    select i.installment_number, i.due_date, i.gross_amount, i.invoice_id, coalesce(z.legal_invoice_number, z.invoice_number), coalesce(z.total,0)-coalesce(z.balance,0), coalesce(z.balance,0),
      case when coalesce(z.balance,0) < -0.009 then 'ÜBERZAHLUNG' when coalesce(z.balance,0) <= 0.009 then 'BEZAHLT'
           when coalesce(z.total,0)-coalesce(z.balance,0) > 0.009 then case when i.due_date < current_date then 'ÜBERFÄLLIG (TEILBEZAHLT)' else 'TEILBEZAHLT' end
           when i.due_date < current_date then 'ÜBERFÄLLIG' else 'OFFEN' end, i.billing_period
    from rp_billing_run_items i left join zoho_invoices z on z.id=i.invoice_id
    where i.plan_id = p_plan_id and i.invoice_id is not null and i.installment_number is not null order by i.installment_number
  loop
    days_overdue := case when status like 'ÜBERFÄLLIG%' then current_date - due_date else 0 end;
    last_nr := installment_number; last_per := to_date(billing_period||'-01','YYYY-MM-DD');
    return next;
  end loop;
  -- geplante Raten
  per := coalesce(last_per + (pl.interval_months || ' months')::interval, date_trunc('month', pl.start_date))::date;
  k := last_nr + 1;
  while k <= coalesce(pl.installment_count, 0) loop
    billing_period := to_char(per,'YYYY-MM');
    installment_number := k; due_date := make_date(extract(year from per)::int, extract(month from per)::int, pl.due_day);
    amount := pl.gross_amount; invoice_id := null; invoice_number := null; paid_amount := 0; open_amount := pl.gross_amount; days_overdue := 0;
    if exists (select 1 from rp_period_skips s where s.plan_id=pl.id and s.billing_period=to_char(per,'YYYY-MM')) then
      status := 'AUSGESETZT'; installment_number := null; amount := 0; open_amount := 0;
      return next;
    else
      status := case when pl.status = 'pausiert' then 'PAUSIERT' when pl.status = 'beendet' then 'STORNIERT' else 'GEPLANT' end;
      return next; k := k + 1;
    end if;
    per := (per + (pl.interval_months || ' months')::interval)::date;
  end loop;
end $$;

grant execute on function public.rp_installment_schedule(uuid) to authenticated;
revoke execute on function public.rp_installment_schedule(uuid) from anon, public;
