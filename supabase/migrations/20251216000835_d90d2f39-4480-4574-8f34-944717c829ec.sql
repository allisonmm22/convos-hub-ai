-- Remover o cron job que está causando duplicação
SELECT cron.unschedule('processar-respostas-pendentes');

-- Adicionar coluna de lock para evitar processamento paralelo
ALTER TABLE respostas_pendentes 
ADD COLUMN IF NOT EXISTS processando boolean DEFAULT false;