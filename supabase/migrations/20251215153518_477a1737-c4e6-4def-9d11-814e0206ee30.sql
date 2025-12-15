-- Adicionar colunas para integração com Google Calendar na tabela agendamentos
ALTER TABLE public.agendamentos 
ADD COLUMN IF NOT EXISTS google_event_id TEXT,
ADD COLUMN IF NOT EXISTS google_meet_link TEXT;

-- Índice para busca por google_event_id
CREATE INDEX IF NOT EXISTS idx_agendamentos_google_event_id 
ON public.agendamentos(google_event_id) 
WHERE google_event_id IS NOT NULL;