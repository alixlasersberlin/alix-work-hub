-- Generic audit trigger that logs every write to public.audit_logs
create or replace function public.audit_trigger_fn()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_record_id text;
  v_details jsonb;
begin
  if TG_OP = 'DELETE' then
    v_record_id := (to_jsonb(OLD)->>'id');
    v_details := jsonb_build_object('old', to_jsonb(OLD));
  elsif TG_OP = 'INSERT' then
    v_record_id := (to_jsonb(NEW)->>'id');
    v_details := jsonb_build_object('new', to_jsonb(NEW));
  else
    v_record_id := (to_jsonb(NEW)->>'id');
    -- Skip if nothing actually changed
    if to_jsonb(NEW) = to_jsonb(OLD) then
      return NEW;
    end if;
    v_details := jsonb_build_object('old', to_jsonb(OLD), 'new', to_jsonb(NEW));
  end if;

  begin
    insert into public.audit_logs(user_id, action, module, record_id, details)
    values (auth.uid(), TG_OP, TG_TABLE_NAME, v_record_id, v_details);
  exception when others then
    -- never break the original transaction because of audit failure
    null;
  end;

  return coalesce(NEW, OLD);
end;
$$;

-- Attach trigger to all relevant business tables
do $$
declare
  t text;
  tables text[] := array[
    'orders','order_items','order_notes','order_documents','order_additional_deposits',
    'customers','deleted_customers',
    'production_orders','production_order_items',
    'suppliers',
    'lager_devices',
    'finance_records','invoice_workflow_states','bank_financing_requests',
    'route_plans',
    'product_categories','item_category_assignments',
    'email_templates',
    'app_settings','system_maintenance',
    'user_profiles','user_roles','user_invitations',
    'backups_metadata'
  ];
begin
  foreach t in array tables loop
    if exists (select 1 from information_schema.tables where table_schema='public' and table_name=t) then
      execute format('drop trigger if exists trg_audit_%I on public.%I', t, t);
      execute format(
        'create trigger trg_audit_%I after insert or update or delete on public.%I for each row execute function public.audit_trigger_fn()',
        t, t
      );
    end if;
  end loop;
end$$;