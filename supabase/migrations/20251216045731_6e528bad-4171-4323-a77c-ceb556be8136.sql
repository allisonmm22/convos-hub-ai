-- Create lembrete_regras table for reminder rules
CREATE TABLE public.lembrete_regras (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conta_id UUID NOT NULL REFERENCES public.contas(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  ativo BOOLEAN DEFAULT true,
  minutos_antes INTEGER NOT NULL DEFAULT 30,
  tipo TEXT NOT NULL DEFAULT 'texto_fixo',
  mensagem_fixa TEXT,
  prompt_lembrete TEXT,
  incluir_link_meet BOOLEAN DEFAULT true,
  incluir_detalhes BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create lembrete_enviados table for tracking sent reminders
CREATE TABLE public.lembrete_enviados (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  regra_id UUID NOT NULL REFERENCES public.lembrete_regras(id) ON DELETE CASCADE,
  agendamento_id UUID NOT NULL REFERENCES public.agendamentos(id) ON DELETE CASCADE,
  contato_id UUID REFERENCES public.contatos(id) ON DELETE SET NULL,
  enviado_em TIMESTAMP WITH TIME ZONE DEFAULT now(),
  mensagem_enviada TEXT,
  UNIQUE(regra_id, agendamento_id)
);

-- Enable RLS
ALTER TABLE public.lembrete_regras ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lembrete_enviados ENABLE ROW LEVEL SECURITY;

-- RLS policies for lembrete_regras
CREATE POLICY "Usuarios podem ver regras da conta"
ON public.lembrete_regras FOR SELECT
USING (conta_id = get_user_conta_id());

CREATE POLICY "Usuarios podem gerenciar regras da conta"
ON public.lembrete_regras FOR ALL
USING (conta_id = get_user_conta_id());

-- RLS policies for lembrete_enviados
CREATE POLICY "Usuarios podem ver lembretes da conta"
ON public.lembrete_enviados FOR SELECT
USING (regra_id IN (
  SELECT id FROM public.lembrete_regras WHERE conta_id = get_user_conta_id()
));

CREATE POLICY "Usuarios podem gerenciar lembretes da conta"
ON public.lembrete_enviados FOR ALL
USING (regra_id IN (
  SELECT id FROM public.lembrete_regras WHERE conta_id = get_user_conta_id()
));

-- Create updated_at trigger
CREATE TRIGGER update_lembrete_regras_updated_at
BEFORE UPDATE ON public.lembrete_regras
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();