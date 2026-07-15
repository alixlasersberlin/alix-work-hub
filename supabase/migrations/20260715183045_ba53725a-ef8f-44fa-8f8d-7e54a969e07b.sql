-- Trigger: Wenn ein Reparaturauftrag als abgeschlossen/ausgeliefert/storniert markiert wird,
-- entfernt das System den [Reparatur: <id>]-Marker aus lager_devices.notes,
-- damit das Gerät wieder als frei angezeigt wird.

CREATE OR REPLACE FUNCTION public.release_lager_device_on_repair_close()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_marker text;
BEGIN
  IF NEW.repair_status IN ('Reparatur abgeschlossen','Ausgeliefert','Storniert')
     AND (TG_OP = 'INSERT' OR OLD.repair_status IS DISTINCT FROM NEW.repair_status) THEN

    v_marker := '\[Reparatur:\s*' || NEW.id::text || '\s*\]';

    UPDATE public.lager_devices
       SET notes = NULLIF(btrim(regexp_replace(notes, v_marker, '', 'gi')), ''),
           updated_at = now()
     WHERE notes ~* v_marker;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_release_lager_device_on_repair_close ON public.repair_orders;
CREATE TRIGGER trg_release_lager_device_on_repair_close
AFTER INSERT OR UPDATE OF repair_status ON public.repair_orders
FOR EACH ROW
EXECUTE FUNCTION public.release_lager_device_on_repair_close();

-- Backfill: bereits abgeschlossene/ausgelieferte/stornierte Reparaturen aufräumen
UPDATE public.lager_devices ld
   SET notes = NULLIF(btrim(regexp_replace(ld.notes, '\[Reparatur:\s*' || ro.id::text || '\s*\]', '', 'gi')), ''),
       updated_at = now()
  FROM public.repair_orders ro
 WHERE ro.repair_status IN ('Reparatur abgeschlossen','Ausgeliefert','Storniert')
   AND ld.notes ~* ('\[Reparatur:\s*' || ro.id::text || '\s*\]');