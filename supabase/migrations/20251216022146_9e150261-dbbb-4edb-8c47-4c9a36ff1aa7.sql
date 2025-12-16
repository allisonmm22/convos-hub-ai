-- Add message fractionation configuration to agent_ia table
ALTER TABLE agent_ia ADD COLUMN IF NOT EXISTS fracionar_mensagens boolean DEFAULT false;
ALTER TABLE agent_ia ADD COLUMN IF NOT EXISTS tamanho_max_fracao integer DEFAULT 500;
ALTER TABLE agent_ia ADD COLUMN IF NOT EXISTS delay_entre_fracoes integer DEFAULT 2;