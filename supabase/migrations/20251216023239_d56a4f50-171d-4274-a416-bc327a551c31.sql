-- Add typing simulation field to agent_ia
ALTER TABLE public.agent_ia
ADD COLUMN simular_digitacao boolean DEFAULT false;