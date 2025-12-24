-- Remover a constraint antiga
ALTER TABLE estagios DROP CONSTRAINT IF EXISTS estagios_tipo_check;

-- Adicionar nova constraint incluindo 'cliente'
ALTER TABLE estagios ADD CONSTRAINT estagios_tipo_check 
CHECK (tipo = ANY (ARRAY['normal'::text, 'ganho'::text, 'perdido'::text, 'cliente'::text]));