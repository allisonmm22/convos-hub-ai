-- Adicionar campo para marcar quando a memória foi limpa
ALTER TABLE conversas 
ADD COLUMN memoria_limpa_em timestamp with time zone;