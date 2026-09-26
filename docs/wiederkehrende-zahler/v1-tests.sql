-- ALIXWORK – Wiederkehrende Zahler V1 – Abnahmetest
-- Läuft vollständig in EINER Transaktion und bricht am Ende absichtlich mit
-- RAISE EXCEPTION ab => alle Testdaten (Kunden, Pläne, Rechnungen, Nummernkreis-
-- Zähler) werden zurückgerollt. Produktive Daten bleiben unverändert.
do $$
declare
  res text[] := '{}';
  cust uuid[] := '{}'; mand uuid[] := '{}'; plan uuid[] := '{}';
  c uuid; m uuid; p uuid; i int; rid uuid; rid2 uuid; cnt int; cnt2 int; j jsonb; ok boolean; msg text;
  it record; inv_before int; inv_after int; pn uuid; rd uuid; other_mand uuid;
  confirm text := 'Ich habe den Monatslauf geprüft und möchte die ausgewählten Rechnungen erzeugen.';
begin
  select count(*) into inv_before from zoho_invoices;
  perform rp_confirm_creditor('DE02ZZZ00002605062');

  -- 20 Testkunden
  for i in 1..20 loop
    insert into customers(source_system, external_customer_id, company_name, email, phone, billing_address)
    values ('rp_test', 'RPTEST-'||i, 'RP-Testkunde '||i, 'rp-test'||i||'@example.invalid', '+4915100000'||lpad(i::text,2,'0'),
            jsonb_build_object('address','Teststr. '||i,'zip','12529','city','Schönefeld'))
    returning id into c;
    cust := cust || c;
    if i <= 15 or i >= 18 then
      insert into rp_mandates(customer_id, mandate_reference, mandate_date, account_holder, iban, status)
      values (c, 'RPTEST-M-'||i, '2026-01-01', 'RP-Testkunde '||i, 'DE8937040044053201300'||(i%10), 'aktiv') returning id into m;
    else m := null; end if;
    mand := mand || m;
    insert into rp_payment_plans(customer_id, product, net_amount, tax_rate, start_date, due_day, payment_method, mandate_id, notify_channel, status)
    values (c, 'Testleistung', 100, 19, '2026-01-01', 15, 'sepa', m, 'email',
            case when i = 18 then 'pausiert' when i = 20 then 'beendet' else 'aktiv' end)
    returning id into p;
    plan := plan || p;
  end loop;
  -- 19: diesen Monat ausgesetzt
  insert into rp_period_skips(plan_id, billing_period, reason) values (plan[19], '2026-11', 'Test');

  -- Abnahme: Lauf 2026-11
  rid := rp_prepare_run('2026-11');
  select count(*) filter (where status='ready'), count(*) filter (where status='blocker') into cnt, cnt2 from rp_billing_run_items where run_id=rid;
  res := res || format('A1 Abnahme 15 bereit / 2 Blocker: %s/%s -> %s', cnt, cnt2, case when cnt=15 and cnt2=2 then 'BESTANDEN' else 'FEHLER' end);
  select count(*) into cnt from rp_billing_run_items where run_id=rid and plan_id in (plan[18], plan[20]);
  res := res || format('T07/T08 pausiert+beendet nicht im Lauf: %s -> %s', cnt, case when cnt=0 then 'BESTANDEN' else 'FEHLER' end);
  select status into msg from rp_billing_run_items where run_id=rid and plan_id=plan[19];
  res := res || format('T09 ausgesetzt: %s -> %s', msg, case when msg='skipped' then 'BESTANDEN' else 'FEHLER' end);
  select issues::text into msg from rp_billing_run_items where run_id=rid and plan_id=plan[16];
  res := res || format('T02 ohne Mandat: %s', case when msg like '%Kein SEPA-Mandat%' then 'BESTANDEN' else 'FEHLER '||msg end);

  -- T01 erneutes Vorbereiten -> keine Duplikate
  rid2 := rp_prepare_run('2026-11');
  select count(*) into cnt from rp_billing_run_items where run_id=rid;
  res := res || format('T01/T15 erneut vorbereiten gleiche ID + 19 Positionen: %s -> %s', cnt, case when rid=rid2 and cnt=19 then 'BESTANDEN' else 'FEHLER' end);

  -- T03 inaktives Mandat, T04 fehlende IBAN, T05 fehlende Referenz (temporär an Kunde 1-3)
  update rp_mandates set status='widerrufen' where id=mand[1];
  update rp_mandates set iban=null where id=mand[2];
  update rp_mandates set mandate_reference='' where id=mand[3];
  perform rp_validate_run(rid);
  select issues::text into msg from rp_billing_run_items where run_id=rid and plan_id=plan[1];
  res := res || format('T03 inaktives Mandat: %s', case when msg like '%Mandat nicht aktiv%' then 'BESTANDEN' else 'FEHLER' end);
  select issues::text into msg from rp_billing_run_items where run_id=rid and plan_id=plan[2];
  res := res || format('T04 fehlende IBAN: %s', case when msg like '%IBAN fehlt%' then 'BESTANDEN' else 'FEHLER' end);
  select issues::text into msg from rp_billing_run_items where run_id=rid and plan_id=plan[3];
  res := res || format('T05 fehlende Mandatsreferenz: %s', case when msg like '%Mandatsreferenz fehlt%' then 'BESTANDEN' else 'FEHLER' end);
  update rp_mandates set status='aktiv' where id=mand[1];
  update rp_mandates set iban='DE89370400440532013001' where id=mand[2];
  update rp_mandates set mandate_reference='RPTEST-M-3' where id=mand[3];

  -- T06 fehlende Gläubiger-ID
  update rp_settings set creditor_id=null where id=1;
  perform rp_validate_run(rid);
  select issues::text into msg from rp_billing_run_items where run_id=rid and plan_id=plan[4];
  res := res || format('T06 fehlende Gläubiger-ID: %s', case when msg like '%Gläubiger-ID fehlt%' then 'BESTANDEN' else 'FEHLER' end);
  perform rp_confirm_creditor('DE02ZZZ00002605062');

  -- T17 manipulierte mandate_id (fremdes Mandat)
  update rp_billing_run_items set mandate_id=mand[6] where run_id=rid and plan_id=plan[5];
  perform rp_validate_run(rid);
  select issues::text into msg from rp_billing_run_items where run_id=rid and plan_id=plan[5];
  res := res || format('T17 fremdes Mandat: %s', case when msg like '%anderem Kunden%' then 'BESTANDEN' else 'FEHLER' end);
  update rp_billing_run_items set mandate_id=mand[5] where run_id=rid and plan_id=plan[5];
  perform rp_validate_run(rid);

  -- T10 Betragsänderung + Audit mit Original
  select id into p from rp_billing_run_items where run_id=rid and plan_id=plan[7];
  perform rp_item_action(array[p], 'set_amount', '150.00', 'Test');
  select gross_amount::text||'/'||original_gross_amount::text into msg from rp_billing_run_items where id=p;
  select count(*) into cnt from rp_audit_log where entity_id=p and action='amount_changed' and old_value->>'original'='119.00' and new_value->>'gross'='150.00';
  res := res || format('T10 Betrag einmalig 150 (Original 119) + Audit: %s audit=%s -> %s', msg, cnt, case when msg='150.00/119.00' and cnt=1 then 'BESTANDEN' else 'FEHLER' end);
  -- T11 Fälligkeitsänderung
  perform rp_item_action(array[p], 'set_due', '2026-11-20', 'Test');
  select count(*) into cnt from rp_billing_run_items where id=p and due_date='2026-11-20';
  select count(*) into cnt2 from rp_audit_log where entity_id=p and action='due_changed';
  res := res || format('T11 Fälligkeit geändert + Audit: %s', case when cnt=1 and cnt2=1 then 'BESTANDEN' else 'FEHLER' end);

  -- T14 unberechtigter Benutzer
  perform set_config('request.jwt.claims', json_build_object('sub', gen_random_uuid()::text, 'role','authenticated')::text, true);
  begin perform rp_approve_run(rid, confirm, 'k-unauth'); ok := false; exception when others then ok := sqlerrm like '%Keine Berechtigung%'; end;
  res := res || format('T14 unberechtigter Benutzer Freigabe: %s', case when ok then 'BESTANDEN' else 'FEHLER' end);
  begin perform rp_get_mandate_iban(mand[1]); ok := false; exception when others then ok := true; end;
  res := res || format('T14b unberechtigter IBAN-Abruf: %s', case when ok then 'BESTANDEN' else 'FEHLER' end);
  perform set_config('request.jwt.claims', '', true);

  -- Freigabe mit Blockern muss scheitern
  begin perform rp_approve_run(rid, confirm, 'k1'); ok := false; exception when others then ok := sqlerrm like '%Blocker%'; end;
  res := res || format('F1 Freigabe mit Blockern gesperrt: %s', case when ok then 'BESTANDEN' else 'FEHLER' end);
  -- ohne Bestätigungstext
  begin perform rp_approve_run(rid, 'ok', 'k1'); ok := false; exception when others then ok := true; end;
  res := res || format('F2 Freigabe ohne Bestätigung gesperrt: %s', case when ok then 'BESTANDEN' else 'FEHLER' end);

  -- Blocker entfernen, freigeben
  perform rp_item_action(array(select id from rp_billing_run_items where run_id=rid and status='blocker'), 'remove', null, 'Test');
  j := rp_approve_run(rid, confirm, 'k1');
  select count(*) into cnt from zoho_invoices where zoho_invoice_id like 'rp-%' and raw_data->>'rp_run_id' = rid::text;
  select count(*) into cnt2 from zoho_invoices where raw_data->>'rp_run_id' = rid::text and legal_invoice_number is not null;
  res := res || format('A2 Freigabe erzeugt 15 Rechnungen mit Nummer: %s/%s (%s) -> %s', cnt, cnt2, j::text, case when cnt=15 and cnt2=15 then 'BESTANDEN' else 'FEHLER' end);
  -- T12/T13 Doppelklick / erneuter Aufruf
  j := rp_approve_run(rid, confirm, 'k1');
  j := rp_approve_run(rid, confirm, 'k2');
  select count(*) into cnt from zoho_invoices where raw_data->>'rp_run_id' = rid::text;
  res := res || format('T12/T13 Doppel-Freigabe keine weiteren Rechnungen: %s (%s) -> %s', cnt, j->>'already', case when cnt=15 and (j->>'already')='true' then 'BESTANDEN' else 'FEHLER' end);
  -- T01/T19 harte Duplikatsperre (direkte zweite finale Position)
  select * into it from rp_billing_run_items where run_id=rid and invoice_id is not null limit 1;
  insert into rp_billing_runs(billing_period) values ('2030-01') returning id into rid2;
  begin
    insert into rp_billing_run_items(run_id, plan_id, customer_id, billing_period, net_amount, tax_amount, gross_amount, original_gross_amount, invoice_id)
    values (rid2, it.plan_id, it.customer_id, it.billing_period, 1, 0, 1, 1, it.invoice_id);
    ok := false;
  exception when unique_violation then ok := true; end;
  res := res || format('T19 Rechnung bereits vorhanden (DB-Sperre): %s', case when ok then 'BESTANDEN' else 'FEHLER' end);
  -- Änderung nach Freigabe gesperrt
  begin perform rp_item_action(array[it.id], 'set_amount', '1', 'x'); ok := false; exception when others then ok := sqlerrm like '%bereits freigegeben%'; end;
  res := res || format('F3 Änderung nach Freigabe gesperrt: %s', case when ok then 'BESTANDEN' else 'FEHLER' end);

  -- T20 Vorabinformation bereits versendet / erneut senden
  select id into pn from rp_prenotifications where item_id=it.id;
  perform rp_log_delivery(pn, 'email', 'x@example.invalid', 'uebergeben', false, null, null);
  perform rp_log_delivery(pn, 'email', 'x@example.invalid', 'uebergeben', true, null, null);
  select count(*) filter (where is_resend) into cnt from rp_notification_deliveries where prenotification_id=pn;
  select count(*) into cnt2 from rp_prenotifications where id=pn and status='versendet';
  res := res || format('T20 Vorabinfo versendet + Resend protokolliert: %s', case when cnt=1 and cnt2=1 then 'BESTANDEN' else 'FEHLER' end);
  select count(*) into cnt from rp_prenotifications p join rp_billing_run_items x on x.id=p.item_id where x.run_id=rid;
  res := res || format('A3 Vorabinformationen erstellt: %s -> %s', cnt, case when cnt=15 then 'BESTANDEN' else 'FEHLER' end);

  -- Bankzahlung eindeutig (Rechnung ausgeglichen)
  update zoho_invoices set balance=0, payment_status='paid', last_payment_date=current_date where id=it.invoice_id;
  perform rp_sync_payments(rid);
  select status into msg from rp_billing_run_items where id=it.id;
  res := res || format('T21 Bankzahlung zugeordnet -> Position %s: %s', msg, case when msg='paid' then 'BESTANDEN' else 'FEHLER' end);

  -- T18 Rücklastschrift
  select * into it from rp_billing_run_items where run_id=rid and status='invoiced' limit 1;
  insert into rp_return_debits(item_id, invoice_id, customer_id, original_amount, return_date, reason_code) values (it.id, it.invoice_id, it.customer_id, it.gross_amount, current_date, 'MD06') returning id into rd;
  perform rp_return_debit_action(rd, 'kunde_kontaktiert', 'Test');
  select status into msg from rp_billing_run_items where id=it.id;
  select count(*) into cnt from rp_audit_log where entity_id=rd;
  res := res || format('T18 Rücklastschrift: Position %s, Audit %s -> %s', msg, cnt, case when msg='return_debit' and cnt>=1 then 'BESTANDEN' else 'FEHLER' end);

  -- Audit unveränderbar
  begin update rp_audit_log set note='x' where id=(select max(id) from rp_audit_log); ok := false; exception when others then ok := true; end;
  res := res || format('F4 Audit unveränderbar: %s', case when ok then 'BESTANDEN' else 'FEHLER' end);

  select count(*) into inv_after from zoho_invoices where source_system <> 'x' and coalesce(raw_data->>'origin','') <> 'alixwork_recurring';
  res := res || format('D1 produktive Rechnungen unverändert: vorher %s / ohne Test %s -> %s', inv_before, inv_after, case when inv_before=inv_after then 'BESTANDEN' else 'FEHLER' end);

  raise exception 'RP_TEST_RESULTS|%', array_to_string(res, ' || ');
end $$;
