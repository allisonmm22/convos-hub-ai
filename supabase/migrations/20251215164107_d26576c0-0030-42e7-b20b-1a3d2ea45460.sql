-- Adicionar coluna para controlar múltiplas negociações por lead
ALTER TABLE public.agent_ia 
ADD COLUMN IF NOT EXISTS permitir_multiplas_negociacoes BOOLEAN DEFAULT true;