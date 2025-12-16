-- Adicionar campo followup_ativo na tabela estagios
ALTER TABLE estagios 
ADD COLUMN followup_ativo boolean DEFAULT true;