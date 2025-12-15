-- Política para super admin ver todos os agentes IA
CREATE POLICY "Super admin pode ver todos agentes"
  ON public.agent_ia FOR SELECT
  USING (is_super_admin());

-- Política para super admin ver todos os funis
CREATE POLICY "Super admin pode ver todos funis"
  ON public.funis FOR SELECT
  USING (is_super_admin());

-- Política para super admin ver todas as conexões WhatsApp
CREATE POLICY "Super admin pode ver todas conexoes"
  ON public.conexoes_whatsapp FOR SELECT
  USING (is_super_admin());