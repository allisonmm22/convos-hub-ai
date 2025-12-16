-- Adicionar campo de configuração para comportamento ao reabrir conversa encerrada
ALTER TABLE public.contas 
ADD COLUMN IF NOT EXISTS reabrir_com_ia boolean DEFAULT true;

-- Comentário explicativo
COMMENT ON COLUMN public.contas.reabrir_com_ia IS 'Define se conversa encerrada deve reabrir com agente IA (true) ou atendimento humano (false)';