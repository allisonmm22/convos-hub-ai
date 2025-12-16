-- Add column to track current AI agent stage in conversation
ALTER TABLE public.conversas ADD COLUMN etapa_ia_atual uuid REFERENCES public.agent_ia_etapas(id);

-- Add comment for documentation
COMMENT ON COLUMN public.conversas.etapa_ia_atual IS 'Current AI agent service stage for this conversation';