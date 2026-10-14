ALTER TABLE public.invoice_corrections
  ADD COLUMN IF NOT EXISTS credit_note_number text UNIQUE,
  ADD COLUMN IF NOT EXISTS amount_gross numeric(12,2),
  ADD COLUMN IF NOT EXISTS vat_rate numeric(5,2),
  ADD COLUMN IF NOT EXISTS amount_net numeric(12,2),
  ADD COLUMN IF NOT EXISTS amount_vat numeric(12,2),
  ADD COLUMN IF NOT EXISTS is_partial boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS sent_to text;

CREATE SEQUENCE IF NOT EXISTS public.credit_note_seq;

CREATE OR REPLACE FUNCTION public.create_credit_note(
  _original_invoice_id uuid, _amount_gross numeric, _vat_rate numeric, _reason text
) RETURNS public.invoice_corrections LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_inv record; v_already numeric; v_row public.invoice_corrections; v_net numeric; v_no text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Nicht angemeldet.'; END IF;
  IF NOT public.can_access_finance() THEN RAISE EXCEPTION 'Keine Berechtigung für Gutschriften.'; END IF;
  IF coalesce(btrim(_reason),'') = '' THEN RAISE EXCEPTION 'Begründung ist Pflicht.'; END IF;
  IF _amount_gross IS NULL OR _amount_gross <= 0 THEN RAISE EXCEPTION 'Betrag muss größer als 0 sein.'; END IF;
  IF _vat_rate IS NULL OR _vat_rate < 0 OR _vat_rate > 30 THEN RAISE EXCEPTION 'Ungültiger Steuersatz.'; END IF;
  SELECT id, total INTO v_inv FROM public.zoho_invoices WHERE id = _original_invoice_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Originalrechnung nicht gefunden.'; END IF;
  SELECT coalesce(sum(amount_gross),0) INTO v_already FROM public.invoice_corrections
    WHERE original_invoice_id = _original_invoice_id AND correction_type = 'gutschrift';
  IF v_inv.total IS NOT NULL AND v_already + _amount_gross > v_inv.total + 0.005 THEN
    RAISE EXCEPTION 'Gutschriften würden den Rechnungsbetrag übersteigen (bereits gutgeschrieben: % €).', v_already;
  END IF;
  v_net := round(_amount_gross / (1 + _vat_rate/100), 2);
  v_no := 'GS-' || to_char(now(),'YYYY') || '-' || lpad(nextval('public.credit_note_seq')::text, 5, '0');
  INSERT INTO public.invoice_corrections(original_invoice_id, correction_type, reason, created_by,
    credit_note_number, amount_gross, vat_rate, amount_net, amount_vat, is_partial)
  VALUES (_original_invoice_id, 'gutschrift', _reason, auth.uid(), v_no, round(_amount_gross,2), _vat_rate,
    v_net, round(_amount_gross,2) - v_net, (v_inv.total IS NULL OR round(_amount_gross,2) < v_inv.total))
  RETURNING * INTO v_row;
  PERFORM public.gobd_log_invoice_event(_original_invoice_id, 'INVOICE_CORRECTION_CREATED', _reason, NULL, NULL,
    jsonb_build_object('correction_type','gutschrift','correction_id',v_row.id,'credit_note_number',v_no,'amount_gross',_amount_gross));
  RETURN v_row;
END; $$;
REVOKE ALL ON FUNCTION public.create_credit_note(uuid, numeric, numeric, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.create_credit_note(uuid, numeric, numeric, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.mark_credit_note_sent(_id uuid, _to text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.can_access_finance() THEN RAISE EXCEPTION 'Keine Berechtigung.'; END IF;
  UPDATE public.invoice_corrections SET sent_at = now(), sent_to = left(_to, 320)
   WHERE id = _id AND correction_type = 'gutschrift';
END; $$;
REVOKE ALL ON FUNCTION public.mark_credit_note_sent(uuid, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.mark_credit_note_sent(uuid, text) TO authenticated;