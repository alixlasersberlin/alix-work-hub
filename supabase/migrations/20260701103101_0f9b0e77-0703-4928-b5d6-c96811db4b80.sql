CREATE OR REPLACE FUNCTION public.trg_ticket_notify_received()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
begin
  if coalesce(new.auto_notify_customer, false) and new.customer_email is not null and length(trim(new.customer_email)) > 0 then
    perform public.notify_customer_event(
      'ticket_received', new.id, null, new.customer_email, new.customer_name,
      new.external_ticket_id, null, null
    );
  end if;
  return new;
end;
$function$;