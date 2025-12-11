-- Criar enum status_conversa
CREATE TYPE public.status_conversa AS ENUM ('em_atendimento', 'aguardando_cliente', 'encerrado');

-- Adicionar coluna status na tabela conversas
ALTER TABLE public.conversas 
ADD COLUMN status public.status_conversa DEFAULT 'em_atendimento';

-- Criar tabela de transferências de atendimento
CREATE TABLE public.transferencias_atendimento (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversa_id UUID NOT NULL REFERENCES public.conversas(id) ON DELETE CASCADE,
  de_usuario_id UUID REFERENCES public.usuarios(id),
  para_usuario_id UUID REFERENCES public.usuarios(id),
  para_agente_ia BOOLEAN DEFAULT false,
  motivo TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.transferencias_atendimento ENABLE ROW LEVEL SECURITY;

-- RLS policies para transferencias
CREATE POLICY "Usuarios podem ver transferencias da conta"
ON public.transferencias_atendimento FOR SELECT
USING (conversa_id IN (SELECT id FROM public.conversas WHERE conta_id = get_user_conta_id()));

CREATE POLICY "Usuarios podem inserir transferencias"
ON public.transferencias_atendimento FOR INSERT
WITH CHECK (conversa_id IN (SELECT id FROM public.conversas WHERE conta_id = get_user_conta_id()));