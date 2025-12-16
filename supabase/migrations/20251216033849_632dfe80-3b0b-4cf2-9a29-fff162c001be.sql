-- Add columns for storing AI summary on negotiations
ALTER TABLE public.negociacoes 
ADD COLUMN IF NOT EXISTS resumo_ia text,
ADD COLUMN IF NOT EXISTS resumo_gerado_em timestamp with time zone;