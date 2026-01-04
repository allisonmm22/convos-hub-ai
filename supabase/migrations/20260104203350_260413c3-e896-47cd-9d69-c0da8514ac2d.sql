-- Primeiro, remover duplicados mantendo apenas o mais recente
DELETE FROM agendamentos a
USING agendamentos b
WHERE a.google_event_id IS NOT NULL
  AND a.google_event_id = b.google_event_id
  AND a.conta_id = b.conta_id
  AND a.created_at < b.created_at;

-- Depois, adicionar constraint UNIQUE para evitar novos duplicados
CREATE UNIQUE INDEX IF NOT EXISTS agendamentos_google_event_unique 
ON agendamentos (google_event_id, conta_id) 
WHERE google_event_id IS NOT NULL;