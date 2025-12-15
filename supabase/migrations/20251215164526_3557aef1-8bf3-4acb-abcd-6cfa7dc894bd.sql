-- Adicionar coluna na tabela contas
ALTER TABLE public.contas 
ADD COLUMN IF NOT EXISTS permitir_multiplas_negociacoes BOOLEAN DEFAULT true;

-- Remover coluna da tabela agent_ia
ALTER TABLE public.agent_ia 
DROP COLUMN IF EXISTS permitir_multiplas_negociacoes;