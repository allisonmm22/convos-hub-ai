-- Add signature setting to usuarios table
ALTER TABLE public.usuarios ADD COLUMN IF NOT EXISTS assinatura_ativa boolean DEFAULT true;