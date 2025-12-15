-- Add agente_ia_id column to conversas table to track which specific AI agent is handling the conversation
ALTER TABLE public.conversas ADD COLUMN agente_ia_id uuid REFERENCES public.agent_ia(id);

-- Add index for better query performance
CREATE INDEX idx_conversas_agente_ia_id ON public.conversas(agente_ia_id);