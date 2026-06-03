UPDATE public.route_plans
   SET planning_status='erledigt', updated_at=now()
 WHERE id='9f467cab-9dd5-4ecc-95ca-abb0351affbe'
   AND planning_status NOT IN ('erledigt','abgesagt','storniert');