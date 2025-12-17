-- Adicionar campos whatsapp e cpf na tabela contas
ALTER TABLE public.contas 
ADD COLUMN IF NOT EXISTS whatsapp text,
ADD COLUMN IF NOT EXISTS cpf text;