
-- Only admins can insert (service_role bypasses RLS for edge functions)
CREATE POLICY "admins can insert otp challenges"
ON public.otp_challenges
FOR INSERT
TO authenticated
WITH CHECK (is_admin());

-- Only admins can update
CREATE POLICY "admins can update otp challenges"
ON public.otp_challenges
FOR UPDATE
TO authenticated
USING (is_admin())
WITH CHECK (is_admin());

-- Only admins can delete
CREATE POLICY "admins can delete otp challenges"
ON public.otp_challenges
FOR DELETE
TO authenticated
USING (is_admin());
