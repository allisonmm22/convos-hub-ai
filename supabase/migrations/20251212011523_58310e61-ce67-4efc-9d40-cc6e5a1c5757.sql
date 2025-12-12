-- Tabela de etapas de atendimento do agente IA
CREATE TABLE public.agent_ia_etapas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_ia_id UUID NOT NULL REFERENCES public.agent_ia(id) ON DELETE CASCADE,
  numero INTEGER NOT NULL,
  tipo TEXT CHECK (tipo IN ('INICIO', 'FINAL', NULL)),
  nome TEXT NOT NULL,
  descricao TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela de perguntas frequentes do agente IA
CREATE TABLE public.agent_ia_perguntas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_ia_id UUID NOT NULL REFERENCES public.agent_ia(id) ON DELETE CASCADE,
  pergunta TEXT NOT NULL,
  resposta TEXT NOT NULL,
  ordem INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Adicionar coluna para API Key da OpenAI na tabela contas
ALTER TABLE public.contas ADD COLUMN openai_api_key TEXT;

-- Enable RLS
ALTER TABLE public.agent_ia_etapas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_ia_perguntas ENABLE ROW LEVEL SECURITY;

-- RLS policies para agent_ia_etapas
CREATE POLICY "Usuarios podem ver etapas do agente da conta"
ON public.agent_ia_etapas
FOR SELECT
USING (agent_ia_id IN (
  SELECT id FROM public.agent_ia WHERE conta_id = get_user_conta_id()
));

CREATE POLICY "Usuarios podem gerenciar etapas do agente"
ON public.agent_ia_etapas
FOR ALL
USING (agent_ia_id IN (
  SELECT id FROM public.agent_ia WHERE conta_id = get_user_conta_id()
));

-- RLS policies para agent_ia_perguntas
CREATE POLICY "Usuarios podem ver perguntas do agente da conta"
ON public.agent_ia_perguntas
FOR SELECT
USING (agent_ia_id IN (
  SELECT id FROM public.agent_ia WHERE conta_id = get_user_conta_id()
));

CREATE POLICY "Usuarios podem gerenciar perguntas do agente"
ON public.agent_ia_perguntas
FOR ALL
USING (agent_ia_id IN (
  SELECT id FROM public.agent_ia WHERE conta_id = get_user_conta_id()
));

-- Trigger para updated_at
CREATE TRIGGER update_agent_ia_etapas_updated_at
BEFORE UPDATE ON public.agent_ia_etapas
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_agent_ia_perguntas_updated_at
BEFORE UPDATE ON public.agent_ia_perguntas
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();