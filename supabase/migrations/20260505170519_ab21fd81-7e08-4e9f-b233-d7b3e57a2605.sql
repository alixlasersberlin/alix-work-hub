INSERT INTO public.user_roles (user_id, role_id)
SELECT '587ff294-b34a-4c45-a8c0-a14a04ba3a8a'::uuid, id
FROM public.roles
WHERE name = 'Super Admin'
ON CONFLICT DO NOTHING;