
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. Add hash column
ALTER TABLE public.finance_stakeholders
  ADD COLUMN IF NOT EXISTS access_token_hash text;

-- 2. Backfill hashes for existing rows
UPDATE public.finance_stakeholders
  SET access_token_hash = encode(digest(access_token, 'sha256'), 'hex')
  WHERE access_token_hash IS NULL AND access_token IS NOT NULL;

-- 3. Enforce + unique
ALTER TABLE public.finance_stakeholders
  ALTER COLUMN access_token_hash SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS finance_stakeholders_access_token_hash_uidx
  ON public.finance_stakeholders(access_token_hash);

-- 4. Drop plaintext column (no longer readable by anyone)
ALTER TABLE public.finance_stakeholders DROP COLUMN access_token;

-- 5. RPC: create stakeholder, return plain token ONCE
CREATE OR REPLACE FUNCTION public.create_finance_stakeholder(
  p_name text,
  p_email text,
  p_role text,
  p_allowed_reports jsonb DEFAULT '[]'::jsonb,
  p_expires_at timestamptz DEFAULT NULL
) RETURNS TABLE (id uuid, access_token text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token text;
  v_id uuid;
BEGIN
  IF NOT (public.has_role(auth.uid(), 'Super Admin'::app_role)
          OR public.has_role(auth.uid(), 'Geschäftsführung'::app_role)) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  v_token := encode(gen_random_bytes(32), 'hex');

  INSERT INTO public.finance_stakeholders
    (name, email, role, allowed_reports, expires_at, access_token_hash, created_by)
  VALUES
    (p_name, p_email, p_role, COALESCE(p_allowed_reports, '[]'::jsonb), p_expires_at,
     encode(digest(v_token, 'sha256'), 'hex'), auth.uid())
  RETURNING finance_stakeholders.id INTO v_id;

  RETURN QUERY SELECT v_id, v_token;
END $$;

REVOKE ALL ON FUNCTION public.create_finance_stakeholder(text, text, text, jsonb, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_finance_stakeholder(text, text, text, jsonb, timestamptz) TO authenticated;

-- 6. RPC: rotate token
CREATE OR REPLACE FUNCTION public.rotate_finance_stakeholder_token(p_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token text;
BEGIN
  IF NOT (public.has_role(auth.uid(), 'Super Admin'::app_role)
          OR public.has_role(auth.uid(), 'Geschäftsführung'::app_role)) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  v_token := encode(gen_random_bytes(32), 'hex');
  UPDATE public.finance_stakeholders
    SET access_token_hash = encode(digest(v_token, 'sha256'), 'hex'),
        updated_at = now()
    WHERE id = p_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'not found';
  END IF;

  RETURN v_token;
END $$;

REVOKE ALL ON FUNCTION public.rotate_finance_stakeholder_token(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rotate_finance_stakeholder_token(uuid) TO authenticated;
