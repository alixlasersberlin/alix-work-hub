-- 1) Presence erweitern (bestehende Tabelle wiederverwenden)
ALTER TABLE public.ac_user_presence
  ADD COLUMN IF NOT EXISTS current_activity text,
  ADD COLUMN IF NOT EXISTS manual_status boolean NOT NULL DEFAULT false;

-- Supervisor-Helper
CREATE OR REPLACE FUNCTION public.is_mobile_supervisor()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.roles r ON r.id = ur.role_id
    WHERE ur.user_id = auth.uid()
      AND r.name IN ('Super Admin','Admin','Teamleiter','Supervisor')
  );
$$;

-- 2) Schichtübergabe
CREATE TABLE IF NOT EXISTS public.shift_handovers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user_id uuid NOT NULL DEFAULT auth.uid(),
  to_user_id uuid,
  department text,
  summary text,
  status text NOT NULL DEFAULT 'OPEN',
  created_at timestamptz NOT NULL DEFAULT now(),
  accepted_at timestamptz,
  accepted_by_user_id uuid,
  cancelled_at timestamptz
);
GRANT SELECT, INSERT, UPDATE ON public.shift_handovers TO authenticated;
GRANT ALL ON public.shift_handovers TO service_role;
ALTER TABLE public.shift_handovers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "handover_select" ON public.shift_handovers FOR SELECT TO authenticated
  USING (from_user_id = auth.uid() OR to_user_id = auth.uid() OR to_user_id IS NULL OR public.is_mobile_supervisor());
CREATE POLICY "handover_insert" ON public.shift_handovers FOR INSERT TO authenticated
  WITH CHECK (from_user_id = auth.uid());
CREATE POLICY "handover_update" ON public.shift_handovers FOR UPDATE TO authenticated
  USING (from_user_id = auth.uid() OR to_user_id = auth.uid() OR to_user_id IS NULL OR public.is_mobile_supervisor())
  WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.shift_handover_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  handover_id uuid NOT NULL REFERENCES public.shift_handovers(id) ON DELETE CASCADE,
  item_type text NOT NULL,
  conversation_id uuid,
  ticket_id uuid,
  priority text,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.shift_handover_items TO authenticated;
GRANT ALL ON public.shift_handover_items TO service_role;
ALTER TABLE public.shift_handover_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "handover_items_all" ON public.shift_handover_items FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.shift_handovers h WHERE h.id = handover_id))
  WITH CHECK (EXISTS (SELECT 1 FROM public.shift_handovers h WHERE h.id = handover_id));
CREATE INDEX IF NOT EXISTS idx_handover_items_handover ON public.shift_handover_items(handover_id);
CREATE INDEX IF NOT EXISTS idx_handovers_status ON public.shift_handovers(status, created_at DESC);

-- 3) Follow-up Reminder (persönlich)
CREATE TABLE IF NOT EXISTS public.follow_up_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  conversation_id uuid,
  ticket_id uuid,
  remind_at timestamptz NOT NULL,
  note text,
  status text NOT NULL DEFAULT 'SCHEDULED',
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.follow_up_reminders TO authenticated;
GRANT ALL ON public.follow_up_reminders TO service_role;
ALTER TABLE public.follow_up_reminders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "followup_own" ON public.follow_up_reminders FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE INDEX IF NOT EXISTS idx_followup_due ON public.follow_up_reminders(status, remind_at);

-- 4) Feature Flags
INSERT INTO public.app_settings(key, value) VALUES
  ('command_center_enabled','true'),
  ('team_presence_enabled','true'),
  ('supervisor_cockpit_enabled','true'),
  ('magic_search_enabled','true'),
  ('follow_up_reminders_enabled','true'),
  ('shift_handover_enabled','true'),
  ('management_kpis_enabled','true'),
  ('ai_daily_brief_enabled','true'),
  ('sla_p1_warn_minutes','5'),
  ('sla_p1_overdue_minutes','10'),
  ('sla_p2_warn_minutes','15'),
  ('sla_p2_overdue_minutes','30'),
  ('sla_default_warn_minutes','60'),
  ('sla_default_overdue_minutes','120')
ON CONFLICT (key) DO NOTHING;

-- 5) Command-Center-Snapshot (eine Abfrage statt N+1)
CREATE OR REPLACE FUNCTION public.get_mobile_command_center()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  sup boolean;
  res jsonb;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.user_profiles p WHERE p.id = uid AND p.is_active) THEN
    RAISE EXCEPTION 'inactive user';
  END IF;
  sup := public.is_mobile_supervisor();

  SELECT jsonb_build_object(
    'generated_at', now(),
    'is_supervisor', sup,
    'counts', (
      SELECT jsonb_build_object(
        'unread', COALESCE(SUM(c.unread_count),0),
        'p1p2', COUNT(*) FILTER (WHERE c.priority IN ('P1','P2') AND c.status <> 'closed'),
        'unanswered', COUNT(*) FILTER (WHERE c.last_customer_message_at IS NOT NULL
              AND (c.last_agent_message_at IS NULL OR c.last_agent_message_at < c.last_customer_message_at)
              AND c.status <> 'closed'),
        'mine', COUNT(*) FILTER (WHERE c.assigned_to = uid AND c.status <> 'closed'),
        'unassigned', COUNT(*) FILTER (WHERE c.assigned_to IS NULL AND c.status <> 'closed')
      )
      FROM public.ac_conversations c
      WHERE COALESCE(c.is_test,false) = false
        AND COALESCE(c.inbox_status,'') <> 'ARCHIVED'
    ),
    'tickets', (
      SELECT jsonb_build_object(
        'open', COUNT(*) FILTER (WHERE t.status NOT IN ('closed','geschlossen','erledigt','resolved')),
        'mine', COUNT(*) FILTER (WHERE t.assigned_to = uid AND t.status NOT IN ('closed','geschlossen','erledigt','resolved')),
        'overdue', COUNT(*) FILTER (WHERE t.resolution_due_at IS NOT NULL AND t.resolution_due_at < now()
              AND t.status NOT IN ('closed','geschlossen','erledigt','resolved'))
      ) FROM public.tickets t
    ),
    'escalations', (
      SELECT COUNT(*) FROM public.conversation_escalations e
      WHERE e.status = 'TRIGGERED' AND e.cancelled_at IS NULL
        AND e.triggered_at > now() - interval '7 days'
    ),
    'reminders_due', (
      SELECT COUNT(*) FROM public.follow_up_reminders f
      WHERE f.user_id = uid AND f.status IN ('SCHEDULED','TRIGGERED') AND f.remind_at <= now()
    ),
    'priority_items', (
      SELECT COALESCE(jsonb_agg(x ORDER BY x->>'prio', (x->>'waiting_minutes')::numeric DESC), '[]'::jsonb)
      FROM (
        SELECT jsonb_build_object(
          'id', c.id,
          'kind', 'conversation',
          'prio', COALESCE(c.priority,'P3'),
          'title', COALESCE(ct.display_name, ct.phone_number, cu.company_name, cu.contact_name, 'Unbekannt'),
          'preview', c.last_message_preview,
          'assigned_to', c.assigned_to,
          'category', c.category,
          'waiting_minutes', ROUND(EXTRACT(EPOCH FROM (now() - COALESCE(c.last_customer_message_at, c.created_at)))/60)
        ) AS x
        FROM public.ac_conversations c
        LEFT JOIN public.ac_contacts ct ON ct.id = c.contact_id
        LEFT JOIN public.customers cu ON cu.id = c.customer_id
        WHERE COALESCE(c.is_test,false) = false
          AND c.status <> 'closed'
          AND COALESCE(c.inbox_status,'') <> 'ARCHIVED'
          AND c.last_customer_message_at IS NOT NULL
          AND (c.last_agent_message_at IS NULL OR c.last_agent_message_at < c.last_customer_message_at)
          AND (sup OR c.assigned_to = uid OR c.assigned_to IS NULL)
        ORDER BY COALESCE(c.priority,'P3'), c.last_customer_message_at ASC
        LIMIT 10
      ) s
    ),
    'team', CASE WHEN sup THEN (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'user_id', p.id,
        'name', p.full_name,
        'status', COALESCE(pr.status,'OFFLINE'),
        'activity', pr.current_activity,
        'last_seen_at', pr.last_seen_at,
        'chats', COALESCE(cc.n,0),
        'p1p2', COALESCE(cc.crit,0),
        'tickets', COALESCE(tt.n,0),
        'oldest_wait_minutes', cc.oldest
      ) ORDER BY p.full_name), '[]'::jsonb)
      FROM public.user_profiles p
      LEFT JOIN public.ac_user_presence pr ON pr.user_id = p.id
      LEFT JOIN LATERAL (
        SELECT COUNT(*) n,
               COUNT(*) FILTER (WHERE c.priority IN ('P1','P2')) crit,
               MAX(ROUND(EXTRACT(EPOCH FROM (now() - c.last_customer_message_at))/60)) oldest
        FROM public.ac_conversations c
        WHERE c.assigned_to = p.id AND c.status <> 'closed' AND COALESCE(c.is_test,false)=false
      ) cc ON true
      LEFT JOIN LATERAL (
        SELECT COUNT(*) n FROM public.tickets t
        WHERE t.assigned_to = p.id AND t.status NOT IN ('closed','geschlossen','erledigt','resolved')
      ) tt ON true
      WHERE p.is_active
    ) ELSE '[]'::jsonb END
  ) INTO res;

  RETURN res;
END;
$$;
REVOKE ALL ON FUNCTION public.get_mobile_command_center() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_mobile_command_center() TO authenticated;

-- 6) Magic Search
CREATE OR REPLACE FUNCTION public.mobile_magic_search(q text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  term text := trim(coalesce(q,''));
  pat text;
  digits text;
  phone_pat text;
  norm text;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.user_profiles p WHERE p.id = uid AND p.is_active) THEN
    RAISE EXCEPTION 'inactive user';
  END IF;
  IF length(term) < 2 THEN RETURN jsonb_build_object('customers','[]'::jsonb,'devices','[]'::jsonb,'tickets','[]'::jsonb,'orders','[]'::jsonb,'conversations','[]'::jsonb); END IF;

  pat := '%' || replace(replace(term,'%','\%'),'_','\_') || '%';
  norm := regexp_replace(upper(term), '[^A-Z0-9]', '', 'g');
  digits := regexp_replace(term, '\D', '', 'g');
  -- Telefon: letzte 8 Ziffern matchen (0160…, +49160…, 0049160…)
  phone_pat := CASE WHEN length(digits) >= 6 THEN '%' || right(digits, 8) || '%' ELSE NULL END;

  RETURN jsonb_build_object(
    'customers', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object('id',c.id,'company',c.company_name,'contact',c.contact_name,'email',c.email,'phone',c.phone,'number',c.external_customer_id)),'[]'::jsonb)
      FROM (
        SELECT * FROM public.customers c2
        WHERE c2.company_name ILIKE pat OR c2.contact_name ILIKE pat OR c2.email ILIKE pat
           OR c2.external_customer_id ILIKE pat
           OR (phone_pat IS NOT NULL AND regexp_replace(coalesce(c2.phone,''), '\D','','g') ILIKE phone_pat)
        LIMIT 12
      ) c
    ),
    'devices', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object('id',d.id,'serial',d.serial_number,'model',d.model_name,'status',d.device_status,'customer',d.customer_name)),'[]'::jsonb)
      FROM (
        SELECT * FROM public.lager_devices d2
        WHERE d2.serial_number ILIKE pat OR d2.model_name ILIKE pat OR d2.customer_name ILIKE pat
           OR regexp_replace(upper(coalesce(d2.serial_number,'')), '[^A-Z0-9]','','g') LIKE '%' || norm || '%'
        LIMIT 12
      ) d
    ),
    'tickets', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object('id',t.id,'number',t.ticket_number,'case',t.case_number,'subject',COALESCE(t.subject,t.title),'status',t.status,'priority',t.priority,'customer',COALESCE(t.company_name,t.customer_name),'serial',t.serial_number)),'[]'::jsonb)
      FROM (
        SELECT * FROM public.tickets t2
        WHERE t2.ticket_number ILIKE pat OR t2.case_number ILIKE pat OR t2.subject ILIKE pat OR t2.title ILIKE pat
           OR t2.customer_name ILIKE pat OR t2.company_name ILIKE pat OR t2.serial_number ILIKE pat
           OR (phone_pat IS NOT NULL AND regexp_replace(coalesce(t2.customer_phone,''), '\D','','g') ILIKE phone_pat)
        ORDER BY t2.created_at DESC
        LIMIT 12
      ) t
    ),
    'orders', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object('id',o.id,'number',o.order_number,'status',o.order_status,'total',o.total_amount,'date',o.order_date,'magic_status',o.magic_status)),'[]'::jsonb)
      FROM (
        SELECT * FROM public.orders o2
        WHERE o2.order_number ILIKE pat OR o2.internal_number ILIKE pat OR o2.case_number ILIKE pat
        ORDER BY o2.order_date DESC NULLS LAST
        LIMIT 12
      ) o
    ),
    'conversations', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object('id',c.id,'preview',c.last_message_preview,'priority',c.priority,'status',c.status,'at',c.last_message_at)),'[]'::jsonb)
      FROM (
        SELECT DISTINCT ON (c2.id) c2.*
        FROM public.ac_conversations c2
        LEFT JOIN public.ac_contacts ct ON ct.id = c2.contact_id
        WHERE COALESCE(c2.is_test,false)=false
          AND (c2.last_message_preview ILIKE pat OR c2.subject ILIKE pat
               OR ct.display_name ILIKE pat
               OR (phone_pat IS NOT NULL AND regexp_replace(coalesce(ct.phone_number,''), '\D','','g') ILIKE phone_pat))
        LIMIT 12
      ) c
    )
  );
END;
$$;
REVOKE ALL ON FUNCTION public.mobile_magic_search(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.mobile_magic_search(text) TO authenticated;