-- Alterar valor padrão do campo modelo para modelo válido da OpenAI
ALTER TABLE agent_ia 
ALTER COLUMN modelo SET DEFAULT 'gpt-4o-mini';

-- Corrigir agentes existentes com modelos incompatíveis (Lovable AI)
UPDATE agent_ia 
SET modelo = 'gpt-4o-mini' 
WHERE modelo LIKE 'google/%' OR modelo LIKE 'openai/%';