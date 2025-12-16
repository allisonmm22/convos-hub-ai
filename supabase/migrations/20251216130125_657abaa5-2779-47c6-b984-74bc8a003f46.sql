-- Adicionar campo para identificar o provedor (default 'evolution' para conexões existentes)
ALTER TABLE conexoes_whatsapp 
ADD COLUMN IF NOT EXISTS tipo_provedor TEXT DEFAULT 'evolution' CHECK (tipo_provedor IN ('evolution', 'meta'));

-- Campos específicos para Meta API (todos nullable)
ALTER TABLE conexoes_whatsapp 
ADD COLUMN IF NOT EXISTS meta_phone_number_id TEXT,
ADD COLUMN IF NOT EXISTS meta_business_account_id TEXT,
ADD COLUMN IF NOT EXISTS meta_access_token TEXT,
ADD COLUMN IF NOT EXISTS meta_webhook_verify_token TEXT;