INSERT INTO public.user_tenant_access (user_id, tenant_id)
SELECT p.id, t.id FROM public.user_profiles p CROSS JOIN public.tenants t
ON CONFLICT (user_id, tenant_id) DO NOTHING;

DO $$
BEGIN
 IF (SELECT count(*) FROM public.user_profiles) <> 17 OR (SELECT count(*) FROM public.tenants) <> 7 THEN
  RAISE EXCEPTION 'Bestand geändert: erwartete 17 Mitarbeiter und 7 Mandanten';
 END IF;
 IF EXISTS (SELECT 1 FROM public.user_profiles p CROSS JOIN public.tenants t WHERE NOT EXISTS (SELECT 1 FROM public.user_tenant_access a WHERE a.user_id=p.id AND a.tenant_id=t.id)) THEN
  RAISE EXCEPTION 'Mandantenfreigabe unvollständig';
 END IF;
END $$;