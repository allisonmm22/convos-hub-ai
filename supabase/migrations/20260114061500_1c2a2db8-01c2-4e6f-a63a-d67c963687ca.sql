-- Permitir que usuários autenticados vejam suas próprias roles
-- Isso resolve o problema do super_admin não conseguir ler sua role
CREATE POLICY "Usuarios podem ver suas proprias roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (user_id = auth.uid());