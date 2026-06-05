
DROP POLICY IF EXISTS "qm insert bugs" ON public.bugs;
DROP POLICY IF EXISTS "qm read bugs" ON public.bugs;

CREATE POLICY "any authenticated can report bug"
  ON public.bugs FOR INSERT TO authenticated
  WITH CHECK (reporter_id = auth.uid());

CREATE POLICY "read own or qm bugs"
  ON public.bugs FOR SELECT TO authenticated
  USING (public.can_access_qm() OR reporter_id = auth.uid());
