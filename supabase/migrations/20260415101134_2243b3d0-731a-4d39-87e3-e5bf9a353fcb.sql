
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;

CREATE OR REPLACE FUNCTION public.log_order_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
begin
  if old.order_status is distinct from new.order_status then
    insert into public.order_status_history (
      order_id, old_status, new_status, changed_by, change_note
    ) values (
      new.id, old.order_status, new.order_status, auth.uid(),
      'Automatische Statusänderung aus orders'
    );
  end if;
  return new;
end;
$$;

CREATE OR REPLACE FUNCTION public.set_updated_by()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
begin
  if auth.uid() is not null then
    new.updated_by = auth.uid();
  end if;
  return new;
end;
$$;

CREATE OR REPLACE FUNCTION public.check_user_profile_self_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.is_admin() THEN
    RETURN NEW;
  END IF;

  IF NEW.account_status IS DISTINCT FROM OLD.account_status
     OR NEW.is_active IS DISTINCT FROM OLD.is_active
     OR NEW.invitation_status IS DISTINCT FROM OLD.invitation_status
     OR NEW.password_reset_required IS DISTINCT FROM OLD.password_reset_required
     OR NEW.email IS DISTINCT FROM OLD.email
     OR NEW.department_id IS DISTINCT FROM OLD.department_id
     OR NEW.last_otp_verified_at IS DISTINCT FROM OLD.last_otp_verified_at
  THEN
    RAISE EXCEPTION 'You are not allowed to modify restricted profile fields';
  END IF;

  RETURN NEW;
END;
$$;
