
CREATE OR REPLACE FUNCTION public.requires_reauth()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  select
    case
      when exists (
        select 1
        from public.user_profiles up
        where up.id = auth.uid()
          and (
            up.last_otp_verified_at is null
            or up.last_otp_verified_at < now() - interval '24 hours'
            or up.account_status <> 'active'
          )
      ) then true
      else false
    end;
$$;

CREATE OR REPLACE FUNCTION public.session_requires_reauth()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  select
    case
      when exists (
        select 1
        from public.login_sessions ls
        where ls.user_id = auth.uid()
          and ls.is_active = true
          and (
            ls.otp_verified_at is null
            or ls.otp_verified_at < now() - interval '24 hours'
            or ls.reauth_required = true
          )
      ) then true
      else false
    end;
$$;
