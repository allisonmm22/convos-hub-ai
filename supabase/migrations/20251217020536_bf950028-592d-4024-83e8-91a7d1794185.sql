-- Fase 1: Otimizações de Performance

-- 1. Adicionar campo de limite de contexto configurável por agente
ALTER TABLE public.agent_ia 
ADD COLUMN IF NOT EXISTS quantidade_mensagens_contexto integer DEFAULT 20;

COMMENT ON COLUMN public.agent_ia.quantidade_mensagens_contexto IS 'Limite de mensagens no contexto da IA (padrão: 20, máx recomendado: 50)';

-- 2. Criar índices compostos para queries frequentes

-- Índice para buscar conversas ativas da conta
CREATE INDEX IF NOT EXISTS idx_conversas_conta_status_arquivada 
ON public.conversas(conta_id, status) 
WHERE arquivada = false;

-- Índice para ordenar mensagens por conversa
CREATE INDEX IF NOT EXISTS idx_mensagens_conversa_created 
ON public.mensagens(conversa_id, created_at DESC);

-- Índice para buscar contatos por telefone
CREATE INDEX IF NOT EXISTS idx_contatos_conta_telefone 
ON public.contatos(conta_id, telefone);

-- Índice para respostas pendentes por tempo
CREATE INDEX IF NOT EXISTS idx_respostas_pendentes_responder_em 
ON public.respostas_pendentes(responder_em) 
WHERE processando = false;

-- Índice para agendamentos próximos
CREATE INDEX IF NOT EXISTS idx_agendamentos_conta_data 
ON public.agendamentos(conta_id, data_inicio) 
WHERE concluido = false;