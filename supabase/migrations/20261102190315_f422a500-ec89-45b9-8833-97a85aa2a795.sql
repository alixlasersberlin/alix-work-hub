DO $$ DECLARE t uuid; e jsonb; r jsonb; lead uuid; n bigint; BEGIN
 SELECT id INTO t FROM public.tenants WHERE is_active AND zoho_source_system IS NOT NULL LIMIT 1;
 IF t IS NULL THEN RAISE EXCEPTION 'Test benötigt vorhandenen aktiven Mandanten'; END IF;
 BEGIN
 PERFORM set_config('request.jwt.claim.role','service_role',true);
 e=jsonb_build_object('event','sales.whatsapp.inbound','source','alixsmart','version',1,'event_id','synthetic-ml-wa-test-event','occurred_at','2026-11-02T19:00:00Z','data',jsonb_build_object('tenant_id',t,'contact_id','synthetic-ml-wa-contact','conversation_id','synthetic-ml-wa-conversation','message_id','synthetic-ml-wa-message','phone','+9998877665544','text','Synthetische Preisfrage','area','sales','direction','inbound','relevance','sales','priority','Hoch'));
 r=public.ml_wa_ingest(e);
 IF r->>'status'<>'created' THEN RAISE EXCEPTION 'Neue Anfrage wurde nicht als Lead erstellt'; END IF;
 lead=(r->>'lead_id')::uuid;
 IF NOT EXISTS(SELECT 1 FROM public.sales_leads WHERE id=lead AND assigned_user IS NULL AND lead_status='Neu' AND source='whatsapp_sales') THEN RAISE EXCEPTION 'Neu/unzugewiesen Regel verletzt'; END IF;
 r=public.ml_wa_ingest(e);
 IF r->>'deduped'<>'true' THEN RAISE EXCEPTION 'Ereignisduplikat nicht gesperrt'; END IF;
 e=jsonb_set(e,'{event_id}','"synthetic-ml-wa-test-event-2"');
 r=public.ml_wa_ingest(e);
 IF r->>'deduped'<>'true' THEN RAISE EXCEPTION 'Nachrichtenduplikat nicht gesperrt'; END IF;
 SELECT count(*) INTO n FROM public.sales_lead_history WHERE lead_id=lead AND action='whatsapp_received';
 IF n<>1 THEN RAISE EXCEPTION 'Doppelte Historie'; END IF;
 BEGIN
 PERFORM public.ml_wa_ingest(jsonb_set(e,'{data,text}','"Abweichender Inhalt"'));
 RAISE EXCEPTION 'Konflikttest fehlgeschlagen' USING ERRCODE='P0002';
 EXCEPTION WHEN SQLSTATE 'P0001' THEN NULL; END;
 e=jsonb_set(jsonb_set(e,'{event_id}','"synthetic-service-event"'),'{data}',(e->'data')||jsonb_build_object('contact_id','synthetic-service-contact','conversation_id','synthetic-service-conversation','message_id','synthetic-service-message','phone','+9998877665533','relevance','service'));
 r=public.ml_wa_ingest(e);
 IF r->>'status'<>'ignored' THEN RAISE EXCEPTION 'Serviceanfrage erzeugt Lead'; END IF;
 PERFORM set_config('request.jwt.claim.role','authenticated',true);
 BEGIN
 PERFORM public.ml_wa_ingest(e);
 RAISE EXCEPTION 'Service-only-Test fehlgeschlagen' USING ERRCODE='P0002';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN
 PERFORM public.ml_wa_inbox();
 RAISE EXCEPTION 'Admin-Eingangtest fehlgeschlagen' USING ERRCODE='P0002';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 RAISE EXCEPTION 'synthetic_tests_passed_rollback' USING ERRCODE='ZX001';
 EXCEPTION WHEN SQLSTATE 'ZX001' THEN NULL;
 END;
 IF EXISTS(SELECT 1 FROM public.sales_leads WHERE metadata->'whatsapp_sales'->>'contact_id'='synthetic-ml-wa-contact') THEN RAISE EXCEPTION 'Testdaten nicht zurückgerollt'; END IF;
 END $$;