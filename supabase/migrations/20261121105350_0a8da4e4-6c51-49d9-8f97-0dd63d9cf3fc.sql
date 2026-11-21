CREATE OR REPLACE FUNCTION public.ph_set_de_identity(p_product_id uuid, p_remote_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE snap jsonb; other uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.user_profiles up JOIN public.user_roles ur ON ur.user_id=up.id JOIN public.roles r ON r.id=ur.role_id
     WHERE up.id=auth.uid() AND up.is_active AND up.account_status='active' AND r.name='Super Admin') THEN
    RAISE EXCEPTION 'Nur aktive Super Admins dürfen DE-Kennungen festlegen';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.ph_products WHERE id=p_product_id) THEN RAISE EXCEPTION 'Gerät nicht gefunden'; END IF;
  SELECT product_id INTO other FROM public.ph_lang_sync_map WHERE site_code='de' AND remote_product_id=p_remote_id::text AND product_id<>p_product_id LIMIT 1;
  IF other IS NOT NULL THEN RAISE EXCEPTION 'Diese DE-Kennung ist bereits einem anderen Gerät zugeordnet'; END IF;
  SELECT remote_snapshot INTO snap FROM public.ph_product_channels WHERE product_id=p_product_id AND channel_code='de';
  IF snap ? 'global_pending' OR snap ? 'global_offline_pending' THEN RAISE EXCEPTION 'DE-Vorgang läuft oder ist unklar; Kennung jetzt nicht änderbar'; END IF;
  INSERT INTO public.ph_lang_sync_map(product_id,site_code,remote_product_id,verified_at,note)
  VALUES (p_product_id,'de',p_remote_id::text,now(),'DE-Kennung manuell durch Super Admin '||auth.uid()||' am '||now())
  ON CONFLICT(product_id,site_code) DO UPDATE SET
    note=concat_ws(E'\n',ph_lang_sync_map.note,'Vorher: '||coalesce(ph_lang_sync_map.remote_product_id,'—'),EXCLUDED.note),
    remote_product_id=EXCLUDED.remote_product_id, remote_url=NULL, verified_at=now(), updated_at=now();
  RETURN jsonb_build_object('ok',true,'remote_product_id',p_remote_id);
END $$;
REVOKE ALL ON FUNCTION public.ph_set_de_identity(uuid,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ph_set_de_identity(uuid,uuid) TO authenticated;