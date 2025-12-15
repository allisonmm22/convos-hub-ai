-- Create table for negotiation movement history
CREATE TABLE public.negociacao_historico (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  negociacao_id UUID NOT NULL REFERENCES public.negociacoes(id) ON DELETE CASCADE,
  estagio_anterior_id UUID REFERENCES public.estagios(id) ON DELETE SET NULL,
  estagio_novo_id UUID REFERENCES public.estagios(id) ON DELETE SET NULL,
  usuario_id UUID REFERENCES public.usuarios(id) ON DELETE SET NULL,
  tipo TEXT NOT NULL DEFAULT 'mudanca_estagio',
  descricao TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.negociacao_historico ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Usuarios podem ver historico da conta" 
ON public.negociacao_historico 
FOR SELECT 
USING (negociacao_id IN (
  SELECT id FROM negociacoes WHERE conta_id = get_user_conta_id()
));

CREATE POLICY "Usuarios podem inserir historico" 
ON public.negociacao_historico 
FOR INSERT 
WITH CHECK (negociacao_id IN (
  SELECT id FROM negociacoes WHERE conta_id = get_user_conta_id()
));

-- Index for performance
CREATE INDEX idx_negociacao_historico_negociacao_id ON public.negociacao_historico(negociacao_id);
CREATE INDEX idx_negociacao_historico_created_at ON public.negociacao_historico(created_at DESC);