-- Add tipo column to estagios table for stage classification
ALTER TABLE public.estagios 
ADD COLUMN tipo text DEFAULT 'normal' CHECK (tipo IN ('normal', 'ganho', 'perdido'));