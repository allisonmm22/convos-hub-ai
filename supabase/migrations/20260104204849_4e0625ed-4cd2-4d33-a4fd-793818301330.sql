-- Adicionar colunas de horário de funcionamento para agendamentos
ALTER TABLE agent_ia_agendamento_config
ADD COLUMN IF NOT EXISTS horario_inicio_dia TIME DEFAULT '08:00:00',
ADD COLUMN IF NOT EXISTS horario_fim_dia TIME DEFAULT '18:00:00';

COMMENT ON COLUMN agent_ia_agendamento_config.horario_inicio_dia IS 'Horário de início do expediente para agendamentos';
COMMENT ON COLUMN agent_ia_agendamento_config.horario_fim_dia IS 'Horário de fim do expediente para agendamentos';