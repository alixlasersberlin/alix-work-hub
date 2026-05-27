do $$
declare
  r record;
  t text;
  protected_tables text[] := array['audit_logs','order_status_history'];
begin
  -- Drop every existing DELETE policy on public tables
  for r in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and cmd = 'DELETE'
  loop
    execute format('drop policy if exists %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;

  -- Recreate a uniform Super-Admin-only DELETE policy on every public BASE TABLE,
  -- except the immutable log tables.
  for t in
    select c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind = 'r'
      and c.relrowsecurity = true
      and not (c.relname = any(protected_tables))
  loop
    execute format(
      'create policy "only super admin can delete" on public.%I for delete to authenticated using (public.has_role(''Super Admin''))',
      t
    );
  end loop;
end$$;