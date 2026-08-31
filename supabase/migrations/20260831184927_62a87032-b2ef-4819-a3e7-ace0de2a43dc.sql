DROP POLICY IF EXISTS ct_select ON public.compliance_tasks;
CREATE POLICY ct_select ON public.compliance_tasks FOR SELECT
USING (assignee_id = auth.uid() OR reviewer_id = auth.uid() OR auth.uid() = ANY (COALESCE(co_assignee_ids, '{}'::uuid[])) OR compliance_is_member(project_id));

DROP POLICY IF EXISTS ct_update ON public.compliance_tasks;
CREATE POLICY ct_update ON public.compliance_tasks FOR UPDATE
USING (compliance_can_write(project_id) AND (assignee_id = auth.uid() OR reviewer_id = auth.uid() OR auth.uid() = ANY (COALESCE(co_assignee_ids, '{}'::uuid[])) OR compliance_is_admin()))
WITH CHECK (compliance_can_write(project_id));

DROP POLICY IF EXISTS cts_select ON public.compliance_task_steps;
CREATE POLICY cts_select ON public.compliance_task_steps FOR SELECT
USING (EXISTS (SELECT 1 FROM public.compliance_tasks t WHERE t.id = compliance_task_steps.task_id AND (t.assignee_id = auth.uid() OR t.reviewer_id = auth.uid() OR auth.uid() = ANY (COALESCE(t.co_assignee_ids, '{}'::uuid[])) OR compliance_is_member(t.project_id))));

DROP POLICY IF EXISTS cts_write ON public.compliance_task_steps;
CREATE POLICY cts_write ON public.compliance_task_steps FOR ALL
USING (EXISTS (SELECT 1 FROM public.compliance_tasks t WHERE t.id = compliance_task_steps.task_id AND compliance_can_write(t.project_id) AND (t.assignee_id = auth.uid() OR t.reviewer_id = auth.uid() OR auth.uid() = ANY (COALESCE(t.co_assignee_ids, '{}'::uuid[])) OR compliance_is_admin())))
WITH CHECK (EXISTS (SELECT 1 FROM public.compliance_tasks t WHERE t.id = compliance_task_steps.task_id AND compliance_can_write(t.project_id)));