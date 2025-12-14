-- Adicionar coluna atender_24h na tabela agent_ia
ALTER TABLE public.agent_ia ADD COLUMN IF NOT EXISTS atender_24h BOOLEAN DEFAULT false;