alter function public.rp_is_system() set search_path = public;
alter function public.rp_plan_due_in(public.rp_payment_plans, text) set search_path = public;
alter function public.rp_mask_iban(text) set search_path = public;
alter function public.rp_audit_immutable() set search_path = public;
do $$ declare f record; begin
  for f in select p.oid::regprocedure as sig, p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'rp\_%' loop
    execute format('revoke execute on function %s from public, anon', f.sig);
    if f.proname in ('rp_audit','rp_audit_trg','rp_settings_audit','rp_audit_immutable','rp_validate_item','rp_is_system','rp_mask_iban','rp_plan_due_in') then
      execute format('revoke execute on function %s from authenticated', f.sig);
    end if;
  end loop; end $$;
grant execute on function public.rp_is_system(), public.rp_mask_iban(text), public.rp_plan_due_in(public.rp_payment_plans, text) to authenticated;