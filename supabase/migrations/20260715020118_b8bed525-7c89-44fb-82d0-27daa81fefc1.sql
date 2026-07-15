
-- 1) ticket_sla_settings: SELECT auf Ticket-Rollen einschränken
DROP POLICY IF EXISTS "ticket_sla_settings_select_auth" ON public.ticket_sla_settings;
CREATE POLICY "ticket_sla_settings_select_staff"
  ON public.ticket_sla_settings
  FOR SELECT
  TO authenticated
  USING (public.can_access_tickets() OR public.is_admin());

-- 2) customer_portal_tickets: Feld-Level-Schutz per Trigger
CREATE OR REPLACE FUNCTION public.customer_portal_tickets_guard_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Staff darf alles ändern
  IF public.can_access_mail() OR public.is_admin() THEN
    RETURN NEW;
  END IF;

  -- Portalkund:in: interne Felder auf OLD-Werte zurücksetzen
  IF public.is_portal_customer() THEN
    NEW.priority   := OLD.priority;
    NEW.assigned_to := OLD.assigned_to;
    NEW.status     := OLD.status;
    NEW.category   := OLD.category;
    NEW.closed_at  := OLD.closed_at;
    NEW.customer_id := OLD.customer_id;
    NEW.created_by := OLD.created_by;
    NEW.created_at := OLD.created_at;
    RETURN NEW;
  END IF;

  -- Alles andere: keine Änderung erlaubt
  RAISE EXCEPTION 'Not allowed to update customer_portal_tickets';
END;
$$;

DROP TRIGGER IF EXISTS trg_cpt_guard_fields ON public.customer_portal_tickets;
CREATE TRIGGER trg_cpt_guard_fields
  BEFORE UPDATE ON public.customer_portal_tickets
  FOR EACH ROW
  EXECUTE FUNCTION public.customer_portal_tickets_guard_fields();
