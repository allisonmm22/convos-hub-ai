-- Tabela de configuração de agendamento por agente
CREATE TABLE public.agent_ia_agendamento_config (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_ia_id UUID NOT NULL REFERENCES public.agent_ia(id) ON DELETE CASCADE,
  ativo BOOLEAN DEFAULT false,
  tipo_agenda TEXT DEFAULT 'interno', -- 'interno' ou 'google'
  google_calendar_id UUID REFERENCES public.calendarios_google(id) ON DELETE SET NULL,
  
  -- Configurações
  duracao_padrao INTEGER DEFAULT 60, -- minutos
  limite_por_horario INTEGER DEFAULT 1, -- quantos agendamentos por slot
  intervalo_entre_agendamentos INTEGER DEFAULT 0, -- minutos entre slots
  antecedencia_minima_horas INTEGER DEFAULT 1, -- mínimo de antecedência
  antecedencia_maxima_dias INTEGER DEFAULT 30, -- máximo de dias para agendar
  
  -- Instruções para IA
  nome_agendamento TEXT, -- Como a IA deve definir o nome do agendamento
  descricao_agendamento TEXT, -- Como a IA deve definir a descrição
  
  -- Prompts
  prompt_consulta_horarios TEXT, -- Quando ativar a consulta de horários
  prompt_marcacao_horario TEXT, -- Quando ativar a marcação de horário
  
  gerar_meet BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(agent_ia_id)
);

-- Tabela de horários disponíveis por dia da semana
CREATE TABLE public.agent_ia_agendamento_horarios (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  config_id UUID NOT NULL REFERENCES public.agent_ia_agendamento_config(id) ON DELETE CASCADE,
  dia_semana INTEGER NOT NULL CHECK (dia_semana >= 0 AND dia_semana <= 6), -- 0=Dom, 1=Seg, ..., 6=Sab
  hora_inicio TIME NOT NULL,
  hora_fim TIME NOT NULL,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.agent_ia_agendamento_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_ia_agendamento_horarios ENABLE ROW LEVEL SECURITY;

-- RLS policies for agent_ia_agendamento_config
CREATE POLICY "Usuarios podem ver config de agendamento do agente da conta"
ON public.agent_ia_agendamento_config
FOR SELECT
USING (
  agent_ia_id IN (
    SELECT id FROM public.agent_ia WHERE conta_id = get_user_conta_id()
  )
);

CREATE POLICY "Usuarios podem gerenciar config de agendamento do agente"
ON public.agent_ia_agendamento_config
FOR ALL
USING (
  agent_ia_id IN (
    SELECT id FROM public.agent_ia WHERE conta_id = get_user_conta_id()
  )
);

-- RLS policies for agent_ia_agendamento_horarios
CREATE POLICY "Usuarios podem ver horarios do agente da conta"
ON public.agent_ia_agendamento_horarios
FOR SELECT
USING (
  config_id IN (
    SELECT c.id FROM public.agent_ia_agendamento_config c
    JOIN public.agent_ia a ON c.agent_ia_id = a.id
    WHERE a.conta_id = get_user_conta_id()
  )
);

CREATE POLICY "Usuarios podem gerenciar horarios do agente"
ON public.agent_ia_agendamento_horarios
FOR ALL
USING (
  config_id IN (
    SELECT c.id FROM public.agent_ia_agendamento_config c
    JOIN public.agent_ia a ON c.agent_ia_id = a.id
    WHERE a.conta_id = get_user_conta_id()
  )
);

-- Trigger para updated_at
CREATE TRIGGER update_agent_ia_agendamento_config_updated_at
BEFORE UPDATE ON public.agent_ia_agendamento_config
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();