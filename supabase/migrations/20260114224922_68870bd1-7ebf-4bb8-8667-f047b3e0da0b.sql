-- Adicionar coluna para reativação automática da IA na tabela contas
ALTER TABLE public.contas 
ADD COLUMN IF NOT EXISTS reativar_ia_auto boolean DEFAULT false;

-- Comentário explicativo
COMMENT ON COLUMN public.contas.reativar_ia_auto IS 'Quando true, reativa a IA automaticamente quando lead envia mensagem em conversa pausada';