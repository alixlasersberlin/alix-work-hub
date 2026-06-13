CREATE OR REPLACE FUNCTION public.assign_repair_number()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
declare
  day_prefix text;
  daily_count int;
  new_num text;
begin
  if new.repair_number is null or length(trim(new.repair_number)) = 0 then
    day_prefix := to_char((now() at time zone 'Europe/Berlin')::date, 'YYYYMMDD');
    loop
      select count(*) + 1 into daily_count
      from public.repair_orders
      where repair_number like 'REP-' || day_prefix || '%';
      new_num := 'REP-' || day_prefix || lpad(daily_count::text, 2, '0');
      exit when not exists (select 1 from public.repair_orders where repair_number = new_num);
    end loop;
    new.repair_number := new_num;
  end if;
  return new;
end;
$function$;