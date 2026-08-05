CREATE OR REPLACE FUNCTION public.audit_trigger_fn()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  v_record_id text;
  v_old jsonb;
  v_new jsonb;
  v_diff_old jsonb := '{}'::jsonb;
  v_diff_new jsonb := '{}'::jsonb;
  k text;
  -- große/irrelevante Spalten nie protokollieren
  v_skip text[] := array['raw_data','details','payload','content','ocr_text','body','html','file_data','embedding','updated_at','search_vector'];
begin
  if TG_OP = 'DELETE' then
    v_record_id := (to_jsonb(OLD)->>'id');
    v_diff_old := to_jsonb(OLD) - v_skip;
    insert into public.audit_logs(user_id, action, module, record_id, details)
    values (auth.uid(), TG_OP, TG_TABLE_NAME, v_record_id, jsonb_build_object('old', v_diff_old));
    return OLD;
  elsif TG_OP = 'INSERT' then
    v_record_id := (to_jsonb(NEW)->>'id');
    insert into public.audit_logs(user_id, action, module, record_id, details)
    values (auth.uid(), TG_OP, TG_TABLE_NAME, v_record_id, jsonb_build_object('new', to_jsonb(NEW) - v_skip));
    return NEW;
  end if;

  v_record_id := (to_jsonb(NEW)->>'id');
  v_old := to_jsonb(OLD) - v_skip;
  v_new := to_jsonb(NEW) - v_skip;
  if v_old = v_new then
    return NEW;
  end if;

  for k in select jsonb_object_keys(v_new) loop
    if (v_new -> k) is distinct from (v_old -> k) then
      v_diff_new := v_diff_new || jsonb_build_object(k, v_new -> k);
      v_diff_old := v_diff_old || jsonb_build_object(k, coalesce(v_old -> k, 'null'::jsonb));
    end if;
  end loop;

  if v_diff_new = '{}'::jsonb then
    return NEW;
  end if;

  begin
    insert into public.audit_logs(user_id, action, module, record_id, details)
    values (auth.uid(), TG_OP, TG_TABLE_NAME, v_record_id,
            jsonb_build_object('old', v_diff_old, 'new', v_diff_new));
  exception when others then
    null;
  end;

  return NEW;
end;
$function$;

-- Altlasten abbauen: Details älterer Einträge entfernen (Metadaten bleiben erhalten)
UPDATE public.audit_logs
   SET details = jsonb_build_object('trimmed', true)
 WHERE created_at < now() - interval '30 days'
   AND details IS NOT NULL
   AND pg_column_size(details) > 2000;