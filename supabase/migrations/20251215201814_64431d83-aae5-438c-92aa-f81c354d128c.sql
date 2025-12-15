-- Adicionar coluna ativo na tabela contas
ALTER TABLE public.contas ADD COLUMN IF NOT EXISTS ativo boolean DEFAULT true;