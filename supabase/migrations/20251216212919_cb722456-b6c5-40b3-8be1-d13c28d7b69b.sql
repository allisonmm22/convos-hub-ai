-- Remove a constraint existente que limita tipo_provedor a apenas 'evolution' e 'meta'
ALTER TABLE conexoes_whatsapp DROP CONSTRAINT IF EXISTS conexoes_whatsapp_tipo_provedor_check;

-- Adiciona nova constraint incluindo 'instagram'
ALTER TABLE conexoes_whatsapp ADD CONSTRAINT conexoes_whatsapp_tipo_provedor_check 
CHECK (tipo_provedor IN ('evolution', 'meta', 'instagram'));