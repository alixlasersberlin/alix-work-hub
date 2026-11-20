CREATE OR REPLACE FUNCTION public.fibu_light_set_due_date_with_note(p_invoice_id uuid,p_due_date date,p_expected_due_date date,p_note text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE result jsonb; note_text text := btrim(coalesce(p_note,''));
BEGIN
 IF length(note_text)>2000 THEN RAISE EXCEPTION 'Bemerkung darf höchstens 2000 Zeichen enthalten.'; END IF;
 result := public.fibu_light_set_due_date(p_invoice_id,p_due_date,p_expected_due_date);
 IF note_text<>'' AND NOT coalesce((result->>'unchanged')::boolean,false) THEN
  PERFORM public.fibu_light_add_note(p_invoice_id,'Fälligkeit geändert auf '||to_char(p_due_date,'DD.MM.YYYY')||' · '||note_text);
 END IF;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.fibu_light_set_due_date_with_note(uuid,date,date,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.fibu_light_set_due_date_with_note(uuid,date,date,text) TO authenticated;