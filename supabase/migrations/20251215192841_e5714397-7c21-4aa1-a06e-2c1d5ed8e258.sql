-- Permitir exclusão de conversas da conta
CREATE POLICY "Usuarios podem deletar conversas" ON public.conversas
  FOR DELETE
  USING (conta_id = get_user_conta_id());

-- Permitir exclusão de mensagens associadas
CREATE POLICY "Usuarios podem deletar mensagens" ON public.mensagens
  FOR DELETE
  USING (conversa_id IN (
    SELECT id FROM conversas WHERE conta_id = get_user_conta_id()
  ));