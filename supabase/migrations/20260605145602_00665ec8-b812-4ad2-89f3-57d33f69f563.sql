INSERT INTO public.user_roles (user_id, role_id)
SELECT '5a858bbf-950e-488b-8098-0cde7a6cd7ea', id FROM public.roles WHERE name='QM'
ON CONFLICT DO NOTHING;