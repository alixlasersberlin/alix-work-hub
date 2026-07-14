
-- 1) Restrict DELETE to Super Admin on the flagged tables

DROP POLICY IF EXISTS "app_notif_own_delete" ON public.app_notifications;
CREATE POLICY "app_notif_super_admin_delete" ON public.app_notifications
  FOR DELETE TO authenticated
  USING (has_role('Super Admin'));

DROP POLICY IF EXISTS "ticket_notifications delete own" ON public.ticket_notifications;
CREATE POLICY "ticket_notifications delete super admin" ON public.ticket_notifications
  FOR DELETE TO authenticated
  USING (has_role('Super Admin'));

DROP POLICY IF EXISTS "ticket_participants delete assigner or super admin" ON public.ticket_participants;
CREATE POLICY "ticket_participants delete super admin" ON public.ticket_participants
  FOR DELETE TO authenticated
  USING (has_role('Super Admin'));

-- 2) Per-package ownership check for mediapaket-files storage bucket
--    File path convention: "<media_package_id>/..."

CREATE OR REPLACE FUNCTION public.can_access_media_package_file(_path text, _write boolean)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  pkg_id uuid;
  uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN
    RETURN false;
  END IF;

  -- Super Admin / Admin bypass
  IF public.has_role('Super Admin') OR public.is_admin() THEN
    RETURN true;
  END IF;

  -- Role must permit the operation at all
  IF _write THEN
    IF NOT public.can_manage_media_packages() THEN
      RETURN false;
    END IF;
  ELSE
    IF NOT public.can_read_media_packages() THEN
      RETURN false;
    END IF;
  END IF;

  -- Parse first path segment as media_package_id
  BEGIN
    pkg_id := split_part(_path, '/', 1)::uuid;
  EXCEPTION WHEN others THEN
    RETURN false;
  END;

  -- User must be assigned to, or creator of, the specific package
  RETURN EXISTS (
    SELECT 1
    FROM public.media_packages mp
    WHERE mp.id = pkg_id
      AND (mp.assigned_user_id = uid OR mp.created_by = uid)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.can_access_media_package_file(text, boolean) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.can_access_media_package_file(text, boolean) TO authenticated, service_role;

DROP POLICY IF EXISTS "mp_storage_read_staff" ON storage.objects;
CREATE POLICY "mp_storage_read_staff" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'mediapaket-files'
    AND public.can_access_media_package_file(name, false)
  );

DROP POLICY IF EXISTS "mp_storage_write_staff" ON storage.objects;
CREATE POLICY "mp_storage_write_staff" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'mediapaket-files'
    AND public.can_access_media_package_file(name, true)
  );

DROP POLICY IF EXISTS "mp_storage_update_staff" ON storage.objects;
CREATE POLICY "mp_storage_update_staff" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'mediapaket-files'
    AND public.can_access_media_package_file(name, true)
  )
  WITH CHECK (
    bucket_id = 'mediapaket-files'
    AND public.can_access_media_package_file(name, true)
  );
