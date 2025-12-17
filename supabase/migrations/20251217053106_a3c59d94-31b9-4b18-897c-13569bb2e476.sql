-- Criar tabela de notas de negociação
CREATE TABLE public.negociacao_notas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  negociacao_id UUID NOT NULL REFERENCES negociacoes(id) ON DELETE CASCADE,
  conteudo TEXT NOT NULL,
  usuario_id UUID REFERENCES usuarios(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.negociacao_notas ENABLE ROW LEVEL SECURITY;

-- Política de leitura
CREATE POLICY "Usuarios podem ver notas da conta"
ON public.negociacao_notas FOR SELECT
USING (negociacao_id IN (
  SELECT id FROM negociacoes WHERE conta_id = get_user_conta_id()
));

-- Política de gerenciamento completo
CREATE POLICY "Usuarios podem gerenciar notas"
ON public.negociacao_notas FOR ALL
USING (negociacao_id IN (
  SELECT id FROM negociacoes WHERE conta_id = get_user_conta_id()
));

-- Trigger para atualizar updated_at
CREATE TRIGGER update_negociacao_notas_updated_at
BEFORE UPDATE ON public.negociacao_notas
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();