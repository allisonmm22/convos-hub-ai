-- Permitir atualização de mensagens das conversas da conta
CREATE POLICY "Usuarios podem atualizar mensagens"
ON public.mensagens
FOR UPDATE
USING (
  conversa_id IN (
    SELECT conversas.id
    FROM conversas
    WHERE conversas.conta_id = get_user_conta_id()
  )
);