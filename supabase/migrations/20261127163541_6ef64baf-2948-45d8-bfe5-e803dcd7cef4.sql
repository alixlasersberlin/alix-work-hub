INSERT INTO public.user_menu_grants (user_id, path, created_by)
SELECT '6c2719cb-75f4-4f33-bdb3-7641d0e797e9'::uuid, p, '587ff294-b34a-4c45-a8c0-a14a04ba3a8a'::uuid
FROM unnest(ARRAY['/offene-posten-light','/fibu-light/bank']) p
WHERE NOT EXISTS (SELECT 1 FROM public.user_menu_grants g WHERE g.user_id='6c2719cb-75f4-4f33-bdb3-7641d0e797e9' AND g.path=p);