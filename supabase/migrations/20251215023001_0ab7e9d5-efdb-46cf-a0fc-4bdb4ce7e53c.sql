-- Atualizar conversas existentes para associar ao agente principal
UPDATE conversas c
SET agente_ia_id = (
  SELECT a.id 
  FROM agent_ia a 
  WHERE a.conta_id = c.conta_id 
    AND a.tipo = 'principal' 
    AND a.ativo = true 
  LIMIT 1
)
WHERE c.agente_ia_id IS NULL 
  AND c.agente_ia_ativo = true;