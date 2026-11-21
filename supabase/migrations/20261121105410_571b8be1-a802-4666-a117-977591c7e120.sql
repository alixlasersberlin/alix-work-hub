CREATE SCHEMA IF NOT EXISTS ph_identity_private;
REVOKE ALL ON SCHEMA ph_identity_private FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA ph_identity_private TO authenticated;
ALTER FUNCTION public.ph_set_de_identity(uuid,uuid) SET SCHEMA ph_identity_private;
REVOKE ALL ON FUNCTION ph_identity_private.ph_set_de_identity(uuid,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION ph_identity_private.ph_set_de_identity(uuid,uuid) TO authenticated;
CREATE OR REPLACE FUNCTION public.ph_set_de_identity(p_product_id uuid, p_remote_id uuid)
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path = public AS $$
  SELECT ph_identity_private.ph_set_de_identity(p_product_id, p_remote_id) $$;
REVOKE ALL ON FUNCTION public.ph_set_de_identity(uuid,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ph_set_de_identity(uuid,uuid) TO authenticated;