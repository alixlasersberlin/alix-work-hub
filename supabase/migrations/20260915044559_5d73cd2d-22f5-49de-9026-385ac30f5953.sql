
CREATE OR REPLACE FUNCTION public.gobd_restore_rowid(_r jsonb, _t text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public AS $function$
  SELECT coalesce(_r ->> 'id', _r ->> 'code',
                  public.gobd_restore_hash(_r, public.gobd_restore_idfields(_t)));
$function$;
