CREATE TEMP TABLE v6_approval_probe (LIKE public.finance_approvals INCLUDING DEFAULTS) ON COMMIT DROP;
CREATE TRIGGER v6_probe_guard BEFORE UPDATE ON v6_approval_probe FOR EACH ROW EXECUTE FUNCTION public.security_finance_approval_actor_guard();
DO $$
DECLARE actors uuid[]; tid uuid; rid uuid:=gen_random_uuid(); requester uuid:=gen_random_uuid(); rejected boolean;
BEGIN
 SELECT a.tenant_id,array_agg(DISTINCT p.id) INTO tid,actors FROM public.user_profiles p JOIN public.user_roles ur ON ur.user_id=p.id JOIN public.roles r ON r.id=ur.role_id JOIN public.user_tenant_access a ON a.user_id=p.id JOIN public.tenants t ON t.id=a.tenant_id WHERE p.is_active AND p.account_status='active' AND p.invitation_status='accepted' AND NOT p.password_reset_required AND t.is_active AND r.name IN ('Admin','Super Admin','Finance','Geschäftsführung') GROUP BY a.tenant_id HAVING count(DISTINCT p.id)>=2 LIMIT 1;
 IF cardinality(actors)<2 OR tid IS NULL THEN RAISE EXCEPTION 'Zwei autorisierte Firmenidentitäten fehlen für isolierte Triggerprüfung'; END IF;
 INSERT INTO v6_approval_probe(id,entity_type,entity_id,tenant_id,title,amount,requires_dual_approval,status,requested_by) VALUES(rid,'incoming_invoice',gen_random_uuid(),tid,'ISOLIERTE SICHERHEITSPRÜFUNG',0,true,'pending',requester);
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',actors[1],'role','authenticated')::text,true);
 rejected:=false;
 BEGIN UPDATE v6_approval_probe SET approved_by=actors[2],approved_at=now() WHERE id=rid; EXCEPTION WHEN insufficient_privilege THEN rejected:=true; END;
 IF NOT rejected THEN RAISE EXCEPTION 'Fremde Genehmigeridentität wurde akzeptiert'; END IF;
 rejected:=false;
 BEGIN UPDATE v6_approval_probe SET tenant_id=gen_random_uuid() WHERE id=rid; EXCEPTION WHEN insufficient_privilege THEN rejected:=true; END;
 IF NOT rejected THEN RAISE EXCEPTION 'Firmenzuordnung wurde manipuliert'; END IF;
 rejected:=false;
 BEGIN UPDATE v6_approval_probe SET status='approved',approved_by=actors[1] WHERE id=rid; EXCEPTION WHEN insufficient_privilege THEN rejected:=true; END;
 IF NOT rejected THEN RAISE EXCEPTION 'Vier-Augen-Regel wurde übersprungen'; END IF;
 UPDATE v6_approval_probe SET approved_by=actors[1],approved_at=now() WHERE id=rid;
 rejected:=false;
 BEGIN UPDATE v6_approval_probe SET second_approver_id=actors[1],status='approved' WHERE id=rid; EXCEPTION WHEN insufficient_privilege THEN rejected:=true; END;
 IF NOT rejected THEN RAISE EXCEPTION 'Doppelgenehmigung durch selben Mitarbeiter'; END IF;
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',actors[2],'role','authenticated')::text,true);
 UPDATE v6_approval_probe SET second_approver_id=actors[2],status='approved' WHERE id=rid;
 IF NOT EXISTS(SELECT 1 FROM v6_approval_probe WHERE id=rid AND status='approved' AND approved_by=actors[1] AND second_approver_id=actors[2]) THEN RAISE EXCEPTION 'Legitime Vier-Augen-Freigabe gesperrt'; END IF;
 PERFORM set_config('request.jwt.claims','{}',true);
 RAISE NOTICE '5 isolated approval trigger assertions passed; no business rows changed';
END $$;