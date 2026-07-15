
CREATE OR REPLACE FUNCTION public.create_sms_auth_token_secret(p_token text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault
AS $$
DECLARE
  v_sid uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'Super Admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  v_sid := vault.create_secret(p_token, 'sms_settings_auth_token_'||extract(epoch from now())::text, 'sms_settings.auth_token');
  UPDATE public.sms_settings SET auth_token_secret_id = v_sid, updated_at = now(), updated_by = auth.uid() WHERE id = true;
  RETURN v_sid;
END;
$$;

REVOKE ALL ON FUNCTION public.create_sms_auth_token_secret(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_sms_auth_token_secret(text) TO authenticated;
