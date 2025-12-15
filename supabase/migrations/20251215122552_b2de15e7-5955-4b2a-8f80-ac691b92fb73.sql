-- Criar tabela de regras de follow-up
CREATE TABLE public.followup_regras (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conta_id UUID NOT NULL REFERENCES public.contas(id) ON DELETE CASCADE,
  agent_ia_id UUID REFERENCES public.agent_ia(id) ON DELETE SET NULL,
  nome TEXT NOT NULL,
  ativo BOOLEAN DEFAULT true,
  
  -- Tipo de follow-up
  tipo TEXT NOT NULL DEFAULT 'texto_fixo' CHECK (tipo IN ('texto_fixo', 'contextual_ia')),
  
  -- Para tipo texto_fixo
  mensagem_fixa TEXT,
  
  -- Para tipo contextual_ia  
  prompt_followup TEXT,
  quantidade_mensagens_contexto INTEGER DEFAULT 10,
  
  -- Gatilhos de tempo
  horas_sem_resposta INTEGER NOT NULL DEFAULT 24,
  
  -- Controles
  max_tentativas INTEGER DEFAULT 3,
  intervalo_entre_tentativas INTEGER DEFAULT 24,
  
  -- Filtros
  aplicar_ia_ativa BOOLEAN DEFAULT true,
  aplicar_ia_pausada BOOLEAN DEFAULT false,
  estagio_ids UUID[] DEFAULT NULL,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Criar tabela de follow-ups enviados
CREATE TABLE public.followup_enviados (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  regra_id UUID NOT NULL REFERENCES public.followup_regras(id) ON DELETE CASCADE,
  conversa_id UUID NOT NULL REFERENCES public.conversas(id) ON DELETE CASCADE,
  tentativa INTEGER NOT NULL DEFAULT 1,
  mensagem_enviada TEXT,
  enviado_em TIMESTAMP WITH TIME ZONE DEFAULT now(),
  respondido BOOLEAN DEFAULT false,
  respondido_em TIMESTAMP WITH TIME ZONE
);

-- Habilitar RLS
ALTER TABLE public.followup_regras ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.followup_enviados ENABLE ROW LEVEL SECURITY;

-- Políticas para followup_regras
CREATE POLICY "Usuarios podem ver regras da conta" ON public.followup_regras
  FOR SELECT USING (conta_id = get_user_conta_id());

CREATE POLICY "Usuarios podem gerenciar regras da conta" ON public.followup_regras
  FOR ALL USING (conta_id = get_user_conta_id());

-- Políticas para followup_enviados
CREATE POLICY "Usuarios podem ver followups da conta" ON public.followup_enviados
  FOR SELECT USING (
    regra_id IN (
      SELECT id FROM public.followup_regras 
      WHERE conta_id = get_user_conta_id()
    )
  );

CREATE POLICY "Usuarios podem gerenciar followups da conta" ON public.followup_enviados
  FOR ALL USING (
    regra_id IN (
      SELECT id FROM public.followup_regras 
      WHERE conta_id = get_user_conta_id()
    )
  );

-- Trigger para atualizar updated_at
CREATE TRIGGER update_followup_regras_updated_at
  BEFORE UPDATE ON public.followup_regras
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Adicionar tabelas ao realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.followup_regras;
ALTER PUBLICATION supabase_realtime ADD TABLE public.followup_enviados;