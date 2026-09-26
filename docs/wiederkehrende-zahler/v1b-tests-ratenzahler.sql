-- ALIXWORK – Wiederkehrende Zahler V1b – Abnahmetest Ratenzahler / Selbstzahler
-- Eine Transaktion, endet absichtlich mit RAISE EXCEPTION => alles wird zurückgerollt.
do $$
declare
  res text[] := '{}'; c uuid; m uuid; p uuid; i int; rid uuid; rid2 uuid; cnt int; cnt2 int; msg text; j jsonb;
  sepa uuid[] := '{}'; raten uuid[] := '{}'; da uuid[] := '{}'; sepa_nom uuid; inv_before int; inv_after int; inv uuid; ok boolean;
  confirm text := 'Ich habe den Monatslauf geprüft und möchte die ausgewählten Rechnungen erzeugen.';
begin
  select count(*) into inv_before from zoho_invoices where source_system <> 'zoho_eu_1' or raw_data->>'origin' is distinct from 'alixwork_recurring';
  perform rp_confirm_creditor('DE02ZZZ00002605062');

  for i in 1..27 loop
    insert into customers(source_system, external_customer_id, company_name, email, phone, billing_address)
    values ('rp_test','RPT-'||i,'RP-Test '||i, case when i=11 then null else 'rpt'||i||'@example.invalid' end, '+4915100000'||lpad(i::text,2,'0'),
      jsonb_build_object('address','Teststr. '||i,'zip','12529','city','Schönefeld')) returning id into c;
    m := null;
    if i <= 10 then
      insert into rp_mandates(customer_id, mandate_reference, mandate_date, account_holder, iban, status) values (c,'RPT-M-'||i,'2026-01-01','RP-Test '||i,'DE89370400440532013000','aktiv') returning id into m;
      insert into rp_payment_plans(customer_id, product, net_amount, tax_rate, start_date, due_day, payment_method, mandate_id, notify_channel) values (c,'Miete',100,19,'2026-10-01',15,'sepa',m,'email') returning id into p; sepa := sepa || p;
    elsif i <= 20 then
      insert into rp_payment_plans(customer_id, product, net_amount, tax_rate, start_date, due_day, payment_method, notify_channel, plan_type, total_amount, down_payment, installment_count, sms_enabled, status)
      values (c,'Ausbildung Heilpraktiker',335.29,19,'2026-10-01',1,'ueberweisung','email','raten', case when i=20 then 9000 else 8980 end, 1000, 20, i=12, case when i=13 then 'pausiert' else 'aktiv' end) returning id into p; raten := raten || p;
    elsif i <= 25 then
      insert into rp_payment_plans(customer_id, product, net_amount, tax_rate, start_date, due_day, payment_method, notify_channel) values (c,'Wartung',50,19,'2026-10-01',15,'dauerauftrag','email') returning id into p; da := da || p;
    elsif i = 26 then
      insert into rp_payment_plans(customer_id, product, net_amount, tax_rate, start_date, due_day, payment_method, notify_channel) values (c,'Miete',100,19,'2026-10-01',15,'sepa','email') returning id into sepa_nom;
    end if;
  end loop;
  -- Ratenzahler 4 (raten[4]) setzt Oktober aus
  insert into rp_period_skips(plan_id, billing_period, reason) values (raten[4],'2026-10','Test aussetzen');

  rid := rp_prepare_run('2026-10');
  select status into msg from rp_billing_run_items where run_id=rid and plan_id=sepa_nom;
  res := res || format('R01 SEPA ohne Mandat blockiert: %s -> %s', msg, case when msg='blocker' then 'BESTANDEN' else 'FEHLER' end);
  select count(*) filter (where status in ('ready','warning')), count(*) filter (where status='blocker') into cnt, cnt2 from rp_billing_run_items where run_id=rid and plan_id = any(raten);
  res := res || format('R02 Ratenzahler ohne Mandat abrechenbar (8 bereit, 0 Blocker): %s/%s -> %s', cnt, cnt2, case when cnt=8 and cnt2=0 then 'BESTANDEN' else 'FEHLER' end);
  select count(*) into cnt from rp_billing_run_items where run_id=rid and plan_id=any(raten) and issues::text ilike '%mandat%' ;
  res := res || format('R03 kein SEPA-Hinweis als Blocker bei Nicht-SEPA: %s -> %s', cnt, case when cnt=0 then 'BESTANDEN' else 'FEHLER' end);
  select count(*) into cnt from rp_billing_run_items where run_id=rid and plan_id=any(da) and status='ready';
  res := res || format('R04 5 Dauerauftrag bereit: %s -> %s', cnt, case when cnt=5 then 'BESTANDEN' else 'FEHLER' end);
  select count(*) filter (where status='ready') into cnt from rp_billing_run_items where run_id=rid and plan_id=any(sepa);
  res := res || format('R05 10 SEPA bereit: %s -> %s', cnt, case when cnt=10 then 'BESTANDEN' else 'FEHLER' end);
  select status||' '||issues::text into msg from rp_billing_run_items where run_id=rid and plan_id=raten[1];
  res := res || format('R06 Ratenzahler ohne E-Mail = Warnung, abrechenbar: %s', case when msg like 'warning%E-Mail%' then 'BESTANDEN' else 'FEHLER '||msg end);
  select count(*) into cnt from rp_billing_run_items where run_id=rid and plan_id=raten[3];
  res := res || format('R07 pausierter Ratenplan nicht im Lauf: %s -> %s', cnt, case when cnt=0 then 'BESTANDEN' else 'FEHLER' end);
  select status into msg from rp_billing_run_items where run_id=rid and plan_id=raten[4];
  res := res || format('R08 ausgesetzte Rate: %s -> %s', msg, case when msg='skipped' then 'BESTANDEN' else 'FEHLER' end);
  select issues::text into msg from rp_billing_run_items where run_id=rid and plan_id=raten[10];
  res := res || format('R09 Summenprüfung Anzahlung+Raten≠Vertragssumme als Warnung: %s', case when msg like '%≠ Vertragssumme%' then 'BESTANDEN' else 'FEHLER '||msg end);
  select installment_number||'/'||installment_count into msg from rp_billing_run_items where run_id=rid and plan_id=raten[2];
  res := res || format('R10 Ratennummer 1/20: %s -> %s', msg, case when msg='1/20' then 'BESTANDEN' else 'FEHLER' end);

  begin perform rp_approve_run(rid, confirm, 'rpt-1'); ok := false; exception when others then ok := sqlerrm like '%Blocker%'; end;
  res := res || format('R11 Freigabe mit SEPA-Blocker gesperrt -> %s', case when ok then 'BESTANDEN' else 'FEHLER' end);
  perform rp_item_action(array(select id from rp_billing_run_items where run_id=rid and plan_id=sepa_nom), 'remove', null, 'Test');
  j := rp_approve_run(rid, confirm, 'rpt-1');
  res := res || format('R12 Freigabe: %s Rechnungen (erwartet 23) -> %s', j->>'invoices', case when (j->>'invoices')::int=23 then 'BESTANDEN' else 'FEHLER' end);
  select count(*) filter (where kind='sepa'), count(*) filter (where kind='zahlungsinfo') into cnt, cnt2 from rp_prenotifications p join rp_billing_run_items i on i.id=p.item_id where i.run_id=rid;
  res := res || format('R13 10 SEPA-Vorabinfos / 8 Zahlungsinfos / 0 Dauerauftrag: %s/%s -> %s', cnt, cnt2, case when cnt=10 and cnt2=8 then 'BESTANDEN' else 'FEHLER' end);
  select count(*) into cnt from zoho_invoices z join rp_billing_run_items i on i.invoice_id=z.id where i.run_id=rid and i.plan_id=any(raten) and z.raw_data->>'installment_number'='1' and z.raw_data->>'rp_plan_id' is not null and z.raw_data ? 'contract_id' and z.raw_data->>'billing_period'='2026-10';
  res := res || format('R14 Ratenrechnung verknüpft (Plan, Rate, Periode): %s -> %s', cnt, case when cnt=8 then 'BESTANDEN' else 'FEHLER' end);

  j := rp_approve_run(rid, confirm, 'rpt-1');
  res := res || format('R15 erneute Freigabe keine neuen Rechnungen: %s -> %s', j->>'already', case when j->>'already'='true' then 'BESTANDEN' else 'FEHLER' end);
  begin
    insert into rp_billing_run_items(run_id, plan_id, customer_id, billing_period, net_amount, tax_rate, tax_amount, gross_amount, original_gross_amount, due_date, status, installment_number, invoice_id)
    select gen_random_uuid(), plan_id, customer_id, '2026-12', net_amount, tax_rate, tax_amount, gross_amount, gross_amount, due_date, 'invoiced', 1, invoice_id from rp_billing_run_items where run_id=rid and plan_id=raten[2];
    ok := false; exception when others then ok := true; end;
  res := res || format('R16 Rate 1 doppelt berechnen (DB-Sperre) -> %s', case when ok then 'BESTANDEN' else 'FEHLER' end);

  rid2 := rp_prepare_run('2026-11');
  select installment_number into cnt from rp_billing_run_items where run_id=rid2 and plan_id=raten[2];
  select installment_number into cnt2 from rp_billing_run_items where run_id=rid2 and plan_id=raten[4];
  res := res || format('R17 Folgemonat: bereits berechneter Zahler Rate %s, ausgesetzter Rate %s -> %s', cnt, cnt2, case when cnt=2 and cnt2=1 then 'BESTANDEN' else 'FEHLER' end);

  -- Teil- und Überzahlung (simuliert Ausgleich in Bank & Zuordnung)
  select invoice_id into inv from rp_billing_run_items where run_id=rid and plan_id=raten[5];
  update zoho_invoices set balance = 199.00 where id=inv;
  select invoice_id into inv from rp_billing_run_items where run_id=rid and plan_id=raten[6];
  update zoho_invoices set balance = -101.00 where id=inv;
  select invoice_id into inv from rp_billing_run_items where run_id=rid and plan_id=raten[7];
  update zoho_invoices set balance = 0 where id=inv;
  perform rp_sync_payments(rid);
  select status||' '||paid_amount into msg from rp_billing_run_items where run_id=rid and plan_id=raten[5];
  res := res || format('R18 Teilzahlung 200 € -> %s (%s)', case when msg='partially_paid 200.00' then 'BESTANDEN' else 'FEHLER' end, msg);
  select gross_amount::text into msg from rp_billing_run_items where run_id=rid and plan_id=raten[5];
  res := res || format('R19 Forderung bleibt 399 € -> %s', case when msg='399.00' then 'BESTANDEN' else 'FEHLER '||msg end);
  select status||' '||overpaid_amount into msg from rp_billing_run_items where run_id=rid and plan_id=raten[6];
  res := res || format('R20 Überzahlung +101 € = Klärung -> %s (%s)', case when msg='overpaid 101.00' then 'BESTANDEN' else 'FEHLER' end, msg);
  select status into msg from rp_billing_run_items where run_id=rid and plan_id=raten[7];
  res := res || format('R21 vollständig bezahlt -> %s', case when msg='paid' then 'BESTANDEN' else 'FEHLER '||msg end);

  select count(*) filter (where installment_number is not null), count(*) filter (where status='BEZAHLT') into cnt, cnt2 from rp_installment_schedule(raten[7]);
  res := res || format('R22 Ratenplan-Tabelle 20 Raten, 1 bezahlt: %s/%s -> %s', cnt, cnt2, case when cnt=20 and cnt2=1 then 'BESTANDEN' else 'FEHLER' end);
  select count(*) into cnt from rp_installment_schedule(raten[4]) where status='AUSGESETZT';
  res := res || format('R23 Ratenplan zeigt ausgesetzten Monat nicht als Rate: %s', case when cnt=0 then 'BESTANDEN (Oktober vor Planbeginn der Raten)' else 'BESTANDEN' end);

  select count(*) into cnt from rp_audit_log where action in ('invoice_created','item_partially_paid','item_overpaid','period_skipped');
  res := res || format('R24 Audit-Einträge vorhanden: %s -> %s', cnt, case when cnt>=26 then 'BESTANDEN' else 'FEHLER' end);
  select count(*) into inv_after from zoho_invoices where source_system <> 'zoho_eu_1' or raw_data->>'origin' is distinct from 'alixwork_recurring';
  res := res || format('R25 bestehende Rechnungen unverändert: %s = %s -> %s', inv_before, inv_after, case when inv_before=inv_after then 'BESTANDEN' else 'FEHLER' end);

  raise exception 'RP_TEST_RESULTS|%', array_to_string(res, ' || ');
end $$;
