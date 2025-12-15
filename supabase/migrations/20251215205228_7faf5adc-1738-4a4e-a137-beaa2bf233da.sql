-- Tabela para rastrear uso de tokens de IA
CREATE TABLE public.uso_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conta_id uuid NOT NULL REFERENCES contas(id) ON DELETE CASCADE,
  conversa_id uuid REFERENCES conversas(id) ON DELETE SET NULL,
  provider text NOT NULL,
  modelo text NOT NULL,
  prompt_tokens integer NOT NULL DEFAULT 0,
  completion_tokens integer NOT NULL DEFAULT 0,
  total_tokens integer NOT NULL DEFAULT 0,
  custo_estimado numeric(10,6) DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Tabela para logs de atividade dos usuários
CREATE TABLE public.logs_atividade (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conta_id uuid NOT NULL REFERENCES contas(id) ON DELETE CASCADE,
  usuario_id uuid REFERENCES usuarios(id) ON DELETE SET NULL,
  tipo text NOT NULL,
  descricao text,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- Índices para performance
CREATE INDEX idx_uso_tokens_conta_id ON public.uso_tokens(conta_id);
CREATE INDEX idx_uso_tokens_created_at ON public.uso_tokens(created_at);
CREATE INDEX idx_logs_atividade_conta_id ON public.logs_atividade(conta_id);
CREATE INDEX idx_logs_atividade_created_at ON public.logs_atividade(created_at);
CREATE INDEX idx_logs_atividade_tipo ON public.logs_atividade(tipo);

-- RLS para uso_tokens
ALTER TABLE public.uso_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admin pode ver todos os tokens"
ON public.uso_tokens FOR SELECT
USING (is_super_admin());

CREATE POLICY "Service role pode inserir tokens"
ON public.uso_tokens FOR INSERT
WITH CHECK (true);

-- RLS para logs_atividade
ALTER TABLE public.logs_atividade ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admin pode ver todos os logs"
ON public.logs_atividade FOR SELECT
USING (is_super_admin());

CREATE POLICY "Service role pode inserir logs"
ON public.logs_atividade FOR INSERT
WITH CHECK (true);