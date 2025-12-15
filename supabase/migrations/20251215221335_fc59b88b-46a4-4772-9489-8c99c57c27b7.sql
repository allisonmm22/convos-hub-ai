-- Adicionar campos para rastrear mensagens deletadas
ALTER TABLE public.mensagens ADD COLUMN IF NOT EXISTS deletada boolean DEFAULT false;
ALTER TABLE public.mensagens ADD COLUMN IF NOT EXISTS deletada_por uuid REFERENCES public.usuarios(id);
ALTER TABLE public.mensagens ADD COLUMN IF NOT EXISTS deletada_em timestamp with time zone;