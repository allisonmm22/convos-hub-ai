-- Tabela para registrar mensagens já processadas (previne reprocessamento após exclusão)
CREATE TABLE public.mensagens_processadas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  evolution_msg_id TEXT NOT NULL,
  conta_id UUID NOT NULL REFERENCES public.contas(id) ON DELETE CASCADE,
  telefone TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(evolution_msg_id, conta_id)
);

-- Índice para buscas rápidas
CREATE INDEX idx_mensagens_processadas_lookup 
  ON public.mensagens_processadas(evolution_msg_id, conta_id);

-- Índice para limpeza por data
CREATE INDEX idx_mensagens_processadas_created_at 
  ON public.mensagens_processadas(created_at);

-- RLS para segurança
ALTER TABLE public.mensagens_processadas ENABLE ROW LEVEL SECURITY;

-- Apenas service role pode gerenciar (edge functions)
CREATE POLICY "Service role pode gerenciar mensagens processadas" 
  ON public.mensagens_processadas 
  FOR ALL 
  USING (true) 
  WITH CHECK (true);