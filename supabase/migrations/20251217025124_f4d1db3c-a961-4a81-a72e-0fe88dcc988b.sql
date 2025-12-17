-- Adicionar coluna de limite de mensagens por mês na tabela planos
ALTER TABLE public.planos ADD COLUMN limite_mensagens_mes INTEGER NOT NULL DEFAULT 10000;

-- Atualizar planos existentes com limites baseados no nome
UPDATE public.planos SET limite_mensagens_mes = 2000 WHERE LOWER(nome) LIKE '%starter%';
UPDATE public.planos SET limite_mensagens_mes = 10000 WHERE LOWER(nome) LIKE '%pro%';
UPDATE public.planos SET limite_mensagens_mes = 50000 WHERE LOWER(nome) LIKE '%business%';
UPDATE public.planos SET limite_mensagens_mes = 999999 WHERE LOWER(nome) LIKE '%enterprise%';