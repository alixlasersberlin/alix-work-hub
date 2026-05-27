UPDATE public.production_orders po
SET anmerkungen = NULLIF(
  trim(
    regexp_replace(
      regexp_replace(po.anmerkungen, '\s*\[LAGER-CHECK[^\]]*\]\s*', ' ', 'g'),
      '\s+', ' ', 'g'
    )
  ),
  ''
) || E'\n' || COALESCE(
  (
    SELECT m[1]
    FROM regexp_matches(po.anmerkungen, '\[LAGER-CHECK[^\]]*\]', 'g') AS m
    OFFSET (
      SELECT count(*) - 1
      FROM regexp_matches(po.anmerkungen, '\[LAGER-CHECK[^\]]*\]', 'g')
    )
    LIMIT 1
  ),
  ''
)
WHERE anmerkungen ~ '\[LAGER-CHECK[^\]]*\].*\[LAGER-CHECK[^\]]*\]';