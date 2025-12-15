-- Adicionar campos para identificar grupos no WhatsApp
ALTER TABLE public.contatos 
  ADD COLUMN IF NOT EXISTS is_grupo boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS grupo_jid text;

-- Índice para consultas otimizadas de grupos
CREATE INDEX IF NOT EXISTS idx_contatos_is_grupo ON public.contatos(is_grupo);
CREATE INDEX IF NOT EXISTS idx_contatos_grupo_jid ON public.contatos(grupo_jid);