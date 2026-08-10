CREATE OR REPLACE FUNCTION public.merge_customers(_primary_id uuid, _duplicate_ids uuid[])
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  r record;
  moved jsonb := '{}'::jsonb;
  rc integer;
  dup_texts text[];
  result jsonb;
BEGIN
  IF NOT public.has_role('Super Admin') THEN
    RAISE EXCEPTION 'Nur Super Admin darf Kunden zusammenführen';
  END IF;

  IF _primary_id IS NULL OR _duplicate_ids IS NULL OR array_length(_duplicate_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'Primärer Kunde und Duplikate erforderlich';
  END IF;

  IF _primary_id = ANY(_duplicate_ids) THEN
    RAISE EXCEPTION 'Primärer Kunde darf nicht in der Duplikatliste sein';
  END IF;

  -- Textuelle Kennungen der Duplikate (UUID + externe Zoho-Kundennummer)
  SELECT array_agg(DISTINCT x) INTO dup_texts FROM (
    SELECT id::text AS x FROM public.customers WHERE id = ANY(_duplicate_ids)
    UNION
    SELECT external_customer_id FROM public.customers
      WHERE id = ANY(_duplicate_ids) AND external_customer_id IS NOT NULL AND external_customer_id <> ''
  ) s;

  -- 1) Alle Tabellen mit uuid-Spalte customer_id
  FOR r IN
    SELECT c.table_name
    FROM information_schema.columns c
    JOIN information_schema.tables t
      ON t.table_schema = c.table_schema AND t.table_name = c.table_name AND t.table_type = 'BASE TABLE'
    WHERE c.table_schema = 'public' AND c.column_name = 'customer_id' AND c.data_type = 'uuid'
      AND c.table_name <> 'customers'
  LOOP
    EXECUTE format('UPDATE public.%I SET customer_id = $1 WHERE customer_id = ANY($2)', r.table_name)
      USING _primary_id, _duplicate_ids;
    GET DIAGNOSTICS rc = ROW_COUNT;
    IF rc > 0 THEN moved := moved || jsonb_build_object(r.table_name, rc); END IF;
  END LOOP;

  -- 2) Alle Tabellen mit text-Spalte customer_id (Zoho-Rechnungen, Collect etc.)
  IF dup_texts IS NOT NULL THEN
    FOR r IN
      SELECT c.table_name
      FROM information_schema.columns c
      JOIN information_schema.tables t
        ON t.table_schema = c.table_schema AND t.table_name = c.table_name AND t.table_type = 'BASE TABLE'
      WHERE c.table_schema = 'public' AND c.column_name = 'customer_id'
        AND c.data_type IN ('text','character varying')
        AND c.table_name <> 'customers'
    LOOP
      EXECUTE format('UPDATE public.%I SET customer_id = $1 WHERE customer_id = ANY($2)', r.table_name)
        USING _primary_id::text, dup_texts;
      GET DIAGNOSTICS rc = ROW_COUNT;
      IF rc > 0 THEN moved := moved || jsonb_build_object(r.table_name, rc); END IF;
    END LOOP;
  END IF;

  UPDATE public.customers p SET
    email        = COALESCE(NULLIF(p.email, ''), d.email),
    phone        = COALESCE(NULLIF(p.phone, ''), d.phone),
    company_name = COALESCE(NULLIF(p.company_name, ''), d.company_name),
    contact_name = COALESCE(NULLIF(p.contact_name, ''), d.contact_name),
    birth_date   = COALESCE(p.birth_date, d.birth_date),
    updated_at   = now()
  FROM (
    SELECT
      (array_agg(email)        FILTER (WHERE email IS NOT NULL AND email <> ''))[1] AS email,
      (array_agg(phone)        FILTER (WHERE phone IS NOT NULL AND phone <> ''))[1] AS phone,
      (array_agg(company_name) FILTER (WHERE company_name IS NOT NULL AND company_name <> ''))[1] AS company_name,
      (array_agg(contact_name) FILTER (WHERE contact_name IS NOT NULL AND contact_name <> ''))[1] AS contact_name,
      (array_agg(birth_date)   FILTER (WHERE birth_date IS NOT NULL))[1] AS birth_date
    FROM public.customers
    WHERE id = ANY(_duplicate_ids)
  ) d
  WHERE p.id = _primary_id;

  DELETE FROM public.customers WHERE id = ANY(_duplicate_ids);
  GET DIAGNOSTICS rc = ROW_COUNT;

  result := jsonb_build_object('primary_id', _primary_id, 'deleted', rc, 'moved', moved);
  RETURN result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.auto_merge_safe_customer_duplicates(_dry_run boolean DEFAULT true)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  g record;
  groups int := 0;
  merged int := 0;
  details jsonb := '[]'::jsonb;
BEGIN
  IF NOT public.has_role('Super Admin') THEN
    RAISE EXCEPTION 'Nur Super Admin darf Kunden zusammenführen';
  END IF;

  FOR g IN
    SELECT
      lower(btrim(company_name)) AS name_key,
      COALESCE(source_system, '-') AS src,
      (array_agg(id ORDER BY (external_customer_id IS NULL), created_at))[1] AS primary_id,
      (array_agg(id ORDER BY (external_customer_id IS NULL), created_at))[2:] AS dup_ids,
      count(*) AS cnt
    FROM public.customers
    WHERE company_name IS NOT NULL AND btrim(company_name) <> ''
    GROUP BY 1, 2
    HAVING count(*) > 1
  LOOP
    groups := groups + 1;
    merged := merged + array_length(g.dup_ids, 1);
    details := details || jsonb_build_object(
      'name', g.name_key, 'source_system', g.src,
      'primary_id', g.primary_id, 'duplicates', array_length(g.dup_ids, 1)
    );
    IF NOT _dry_run THEN
      PERFORM public.merge_customers(g.primary_id, g.dup_ids);
    END IF;
  END LOOP;

  RETURN jsonb_build_object('dry_run', _dry_run, 'groups', groups, 'merged_customers', merged, 'details', details);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.auto_merge_safe_customer_duplicates(boolean) TO authenticated;