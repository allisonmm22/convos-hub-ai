-- Adicionar coluna para identificar mensagens enviadas pelo dispositivo físico
ALTER TABLE public.mensagens ADD COLUMN IF NOT EXISTS enviada_por_dispositivo boolean DEFAULT false;