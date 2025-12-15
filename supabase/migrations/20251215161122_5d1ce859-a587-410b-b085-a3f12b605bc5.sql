-- Adicionar campo de tempo de espera no agente IA
ALTER TABLE public.agent_ia ADD COLUMN IF NOT EXISTS tempo_espera_segundos INTEGER DEFAULT 5;

-- Criar tabela de respostas pendentes para sistema de debounce
CREATE TABLE public.respostas_pendentes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversa_id UUID NOT NULL REFERENCES public.conversas(id) ON DELETE CASCADE,
  responder_em TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(conversa_id)
);

-- Habilitar RLS
ALTER TABLE public.respostas_pendentes ENABLE ROW LEVEL SECURITY;

-- Política para service role (Edge Functions) poder gerenciar
CREATE POLICY "Service role pode gerenciar respostas pendentes"
ON public.respostas_pendentes
FOR ALL
USING (true)
WITH CHECK (true);

-- Índice para busca eficiente por tempo
CREATE INDEX idx_respostas_pendentes_responder_em ON public.respostas_pendentes(responder_em);