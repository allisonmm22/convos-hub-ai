-- Adicionar política de INSERT para contas
CREATE POLICY "Usuarios podem criar contas" 
ON public.contas 
FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL);