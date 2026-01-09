-- Criar tabela de follow-ups agendados (criados pelo agente IA)
CREATE TABLE public.followups_agendados (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conta_id UUID NOT NULL,
  conversa_id UUID NOT NULL,
  contato_id UUID NOT NULL,
  agente_ia_id UUID,
  
  -- Dados do agendamento
  data_agendada TIMESTAMPTZ NOT NULL,
  motivo TEXT,
  contexto TEXT,
  
  -- Status
  status TEXT NOT NULL DEFAULT 'pendente',
  enviado_em TIMESTAMPTZ,
  mensagem_enviada TEXT,
  
  -- Metadados
  created_at TIMESTAMPTZ DEFAULT NOW(),
  criado_por TEXT DEFAULT 'agente_ia'
);

-- RLS
ALTER TABLE public.followups_agendados ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuarios podem ver followups da conta"
ON public.followups_agendados FOR SELECT
USING (conta_id = get_user_conta_id());

CREATE POLICY "Usuarios podem gerenciar followups da conta"
ON public.followups_agendados FOR ALL
USING (conta_id = get_user_conta_id());

-- Service role pode gerenciar (para edge functions)
CREATE POLICY "Service role pode gerenciar followups"
ON public.followups_agendados FOR ALL
USING (true)
WITH CHECK (true);

-- Índices para performance
CREATE INDEX idx_followups_agendados_status ON public.followups_agendados(status);
CREATE INDEX idx_followups_agendados_data ON public.followups_agendados(data_agendada);
CREATE INDEX idx_followups_agendados_contato ON public.followups_agendados(contato_id);

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.followups_agendados;