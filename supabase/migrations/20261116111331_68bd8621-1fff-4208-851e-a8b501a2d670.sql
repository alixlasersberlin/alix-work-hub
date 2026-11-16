DO $$
DECLARE restored_count integer;
BEGIN
  LOCK TABLE public.user_roles IN SHARE ROW EXCLUSIVE MODE;
  SELECT count(*) INTO restored_count FROM public.audit_logs a
  JOIN public.roles r ON r.id = (a.details->'old'->>'role_id')::uuid
  WHERE a.module='user_roles' AND a.action='DELETE'
    AND a.created_at='2026-11-15 14:21:31.745689+00'::timestamptz
    AND a.details->'old'->>'user_id' IN ('45820f2c-6d6c-4067-9816-cc6dc4500db4','7212fdcc-3bc3-4092-85cc-f96c6821c21e')
    AND (a.details->'old'->>'created_at')::timestamptz < '2026-11-15 00:00:00+00'::timestamptz;
  IF restored_count <> 9 THEN RAISE EXCEPTION 'Original role evidence incomplete: expected 9 assignments, found %', restored_count; END IF;

  INSERT INTO public.user_roles (id,user_id,role_id,created_at)
  SELECT (a.details->'old'->>'id')::uuid,
         (a.details->'old'->>'user_id')::uuid,
         (a.details->'old'->>'role_id')::uuid,
         (a.details->'old'->>'created_at')::timestamptz
  FROM public.audit_logs a
  WHERE a.module='user_roles' AND a.action='DELETE'
    AND a.created_at='2026-11-15 14:21:31.745689+00'::timestamptz
    AND a.details->'old'->>'user_id' IN ('45820f2c-6d6c-4067-9816-cc6dc4500db4','7212fdcc-3bc3-4092-85cc-f96c6821c21e')
    AND (a.details->'old'->>'created_at')::timestamptz < '2026-11-15 00:00:00+00'::timestamptz
  ON CONFLICT (user_id,role_id) DO NOTHING;

  DELETE FROM public.user_roles ur USING public.roles r
  WHERE ur.role_id=r.id AND r.name='Angebotsersteller'
    AND ur.user_id IN ('45820f2c-6d6c-4067-9816-cc6dc4500db4','7212fdcc-3bc3-4092-85cc-f96c6821c21e')
    AND ur.created_at='2026-11-15 14:21:31.745689+00'::timestamptz;

  IF EXISTS (
    SELECT 1 FROM public.audit_logs a
    WHERE a.module='user_roles' AND a.action='DELETE'
      AND a.created_at='2026-11-15 14:21:31.745689+00'::timestamptz
      AND a.details->'old'->>'user_id' IN ('45820f2c-6d6c-4067-9816-cc6dc4500db4','7212fdcc-3bc3-4092-85cc-f96c6821c21e')
      AND NOT EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id=(a.details->'old'->>'user_id')::uuid AND ur.role_id=(a.details->'old'->>'role_id')::uuid)
  ) THEN RAISE EXCEPTION 'Role restoration verification failed'; END IF;
END $$;