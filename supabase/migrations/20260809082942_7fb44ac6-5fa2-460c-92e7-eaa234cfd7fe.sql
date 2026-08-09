CREATE TABLE IF NOT EXISTS public.delivery_approval_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  approval_id uuid NOT NULL,
  order_id uuid NOT NULL,
  stage text NOT NULL,
  user_id uuid,
  user_name text,
  token text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '14 days'),
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.delivery_approval_tokens TO service_role;
GRANT SELECT ON public.delivery_approval_tokens TO authenticated;

ALTER TABLE public.delivery_approval_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "dat_admin_read" ON public.delivery_approval_tokens;
CREATE POLICY "dat_admin_read" ON public.delivery_approval_tokens
FOR SELECT TO authenticated
USING (public.is_admin());

CREATE INDEX IF NOT EXISTS idx_dat_order ON public.delivery_approval_tokens(order_id);
CREATE INDEX IF NOT EXISTS idx_dat_token ON public.delivery_approval_tokens(token);