-- Adicionar campo tipo_canal na tabela conexoes_whatsapp para diferenciar WhatsApp de Instagram
ALTER TABLE conexoes_whatsapp ADD COLUMN IF NOT EXISTS tipo_canal TEXT DEFAULT 'whatsapp';

-- Adicionar campo canal nas conversas para identificar origem da conversa
ALTER TABLE conversas ADD COLUMN IF NOT EXISTS canal TEXT DEFAULT 'whatsapp';

-- Adicionar campo canal nos contatos para identificar origem do contato
ALTER TABLE contatos ADD COLUMN IF NOT EXISTS canal TEXT DEFAULT 'whatsapp';

-- Criar índice para performance em queries filtradas por canal
CREATE INDEX IF NOT EXISTS idx_conversas_canal ON conversas(canal);
CREATE INDEX IF NOT EXISTS idx_contatos_canal ON contatos(canal);
CREATE INDEX IF NOT EXISTS idx_conexoes_tipo_canal ON conexoes_whatsapp(tipo_canal);