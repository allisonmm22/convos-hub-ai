-- Adicionar novos campos para configuração granular de conexões
ALTER TABLE planos 
  ADD COLUMN IF NOT EXISTS limite_conexoes_evolution INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS limite_conexoes_meta INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS permite_instagram BOOLEAN NOT NULL DEFAULT false;

-- Migrar dados existentes: limite_conexoes_whatsapp → limite_conexoes_evolution
UPDATE planos SET limite_conexoes_evolution = limite_conexoes_whatsapp WHERE limite_conexoes_evolution = 1;