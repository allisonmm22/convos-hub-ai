-- Criar enums para status e tipos
CREATE TYPE public.status_conexao AS ENUM ('conectado', 'desconectado', 'aguardando');
CREATE TYPE public.tipo_mensagem AS ENUM ('texto', 'imagem', 'audio', 'video', 'documento', 'sticker');
CREATE TYPE public.direcao_mensagem AS ENUM ('entrada', 'saida');
CREATE TYPE public.status_negociacao AS ENUM ('aberto', 'ganho', 'perdido');

-- Tabela de contas (multi-tenant)
CREATE TABLE public.contas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de usuários/atendentes
CREATE TABLE public.usuarios (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  conta_id UUID REFERENCES public.contas(id) ON DELETE CASCADE NOT NULL,
  nome TEXT NOT NULL,
  email TEXT NOT NULL,
  avatar_url TEXT,
  is_admin BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, conta_id)
);

-- Tabela de conexões WhatsApp (Evolution API)
CREATE TABLE public.conexoes_whatsapp (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conta_id UUID REFERENCES public.contas(id) ON DELETE CASCADE NOT NULL,
  nome TEXT NOT NULL DEFAULT 'Principal',
  instance_name TEXT NOT NULL,
  token TEXT NOT NULL,
  webhook_url TEXT,
  status status_conexao DEFAULT 'desconectado',
  qrcode TEXT,
  numero TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de contatos
CREATE TABLE public.contatos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conta_id UUID REFERENCES public.contas(id) ON DELETE CASCADE NOT NULL,
  nome TEXT NOT NULL,
  telefone TEXT NOT NULL,
  email TEXT,
  avatar_url TEXT,
  tags TEXT[] DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(conta_id, telefone)
);

-- Tabela de conversas
CREATE TABLE public.conversas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conta_id UUID REFERENCES public.contas(id) ON DELETE CASCADE NOT NULL,
  contato_id UUID REFERENCES public.contatos(id) ON DELETE CASCADE NOT NULL,
  conexao_id UUID REFERENCES public.conexoes_whatsapp(id) ON DELETE SET NULL,
  atendente_id UUID REFERENCES public.usuarios(id) ON DELETE SET NULL,
  agente_ia_ativo BOOLEAN DEFAULT true,
  ultima_mensagem TEXT,
  ultima_mensagem_at TIMESTAMP WITH TIME ZONE,
  nao_lidas INTEGER DEFAULT 0,
  arquivada BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de mensagens
CREATE TABLE public.mensagens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversa_id UUID REFERENCES public.conversas(id) ON DELETE CASCADE NOT NULL,
  contato_id UUID REFERENCES public.contatos(id) ON DELETE CASCADE,
  usuario_id UUID REFERENCES public.usuarios(id) ON DELETE SET NULL,
  tipo tipo_mensagem DEFAULT 'texto',
  direcao direcao_mensagem NOT NULL,
  conteudo TEXT NOT NULL,
  media_url TEXT,
  metadata JSONB DEFAULT '{}',
  lida BOOLEAN DEFAULT false,
  enviada_por_ia BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de funis
CREATE TABLE public.funis (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conta_id UUID REFERENCES public.contas(id) ON DELETE CASCADE NOT NULL,
  nome TEXT NOT NULL,
  descricao TEXT,
  cor TEXT DEFAULT '#10b981',
  ordem INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de estágios
CREATE TABLE public.estagios (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  funil_id UUID REFERENCES public.funis(id) ON DELETE CASCADE NOT NULL,
  nome TEXT NOT NULL,
  cor TEXT DEFAULT '#3b82f6',
  ordem INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de negociações
CREATE TABLE public.negociacoes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conta_id UUID REFERENCES public.contas(id) ON DELETE CASCADE NOT NULL,
  contato_id UUID REFERENCES public.contatos(id) ON DELETE CASCADE NOT NULL,
  estagio_id UUID REFERENCES public.estagios(id) ON DELETE SET NULL,
  responsavel_id UUID REFERENCES public.usuarios(id) ON DELETE SET NULL,
  titulo TEXT NOT NULL,
  valor DECIMAL(15,2) DEFAULT 0,
  status status_negociacao DEFAULT 'aberto',
  probabilidade INTEGER DEFAULT 50,
  data_fechamento DATE,
  notas TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de agendamentos
CREATE TABLE public.agendamentos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conta_id UUID REFERENCES public.contas(id) ON DELETE CASCADE NOT NULL,
  contato_id UUID REFERENCES public.contatos(id) ON DELETE CASCADE,
  usuario_id UUID REFERENCES public.usuarios(id) ON DELETE SET NULL,
  titulo TEXT NOT NULL,
  descricao TEXT,
  data_inicio TIMESTAMP WITH TIME ZONE NOT NULL,
  data_fim TIMESTAMP WITH TIME ZONE,
  concluido BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de configurações do Agente IA
CREATE TABLE public.agent_ia (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conta_id UUID REFERENCES public.contas(id) ON DELETE CASCADE NOT NULL UNIQUE,
  nome TEXT DEFAULT 'Assistente',
  prompt_sistema TEXT DEFAULT 'Você é um assistente virtual amigável e profissional.',
  modelo TEXT DEFAULT 'google/gemini-2.5-flash',
  temperatura DECIMAL(2,1) DEFAULT 0.7,
  max_tokens INTEGER DEFAULT 1000,
  ativo BOOLEAN DEFAULT true,
  horario_inicio TIME DEFAULT '08:00',
  horario_fim TIME DEFAULT '18:00',
  dias_ativos INTEGER[] DEFAULT '{1,2,3,4,5}',
  mensagem_fora_horario TEXT DEFAULT 'Obrigado pelo contato! Nosso horário de atendimento é de segunda a sexta, das 8h às 18h.',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS em todas as tabelas
ALTER TABLE public.contas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conexoes_whatsapp ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contatos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mensagens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.funis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.estagios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.negociacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agendamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_ia ENABLE ROW LEVEL SECURITY;

-- Função para obter conta_id do usuário atual
CREATE OR REPLACE FUNCTION public.get_user_conta_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT conta_id FROM public.usuarios WHERE user_id = auth.uid() LIMIT 1
$$;

-- Políticas RLS para contas
CREATE POLICY "Usuarios podem ver suas contas" ON public.contas
  FOR SELECT USING (id IN (SELECT conta_id FROM public.usuarios WHERE user_id = auth.uid()));

CREATE POLICY "Usuarios podem atualizar suas contas" ON public.contas
  FOR UPDATE USING (id IN (SELECT conta_id FROM public.usuarios WHERE user_id = auth.uid()));

-- Políticas RLS para usuarios
CREATE POLICY "Usuarios podem ver usuarios da mesma conta" ON public.usuarios
  FOR SELECT USING (conta_id = public.get_user_conta_id());

CREATE POLICY "Usuarios podem inserir em suas contas" ON public.usuarios
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Usuarios podem atualizar seus dados" ON public.usuarios
  FOR UPDATE USING (user_id = auth.uid());

-- Políticas RLS para conexoes_whatsapp
CREATE POLICY "Usuarios podem ver conexoes da conta" ON public.conexoes_whatsapp
  FOR SELECT USING (conta_id = public.get_user_conta_id());

CREATE POLICY "Usuarios podem inserir conexoes" ON public.conexoes_whatsapp
  FOR INSERT WITH CHECK (conta_id = public.get_user_conta_id());

CREATE POLICY "Usuarios podem atualizar conexoes" ON public.conexoes_whatsapp
  FOR UPDATE USING (conta_id = public.get_user_conta_id());

CREATE POLICY "Usuarios podem deletar conexoes" ON public.conexoes_whatsapp
  FOR DELETE USING (conta_id = public.get_user_conta_id());

-- Políticas RLS para contatos
CREATE POLICY "Usuarios podem ver contatos da conta" ON public.contatos
  FOR SELECT USING (conta_id = public.get_user_conta_id());

CREATE POLICY "Usuarios podem inserir contatos" ON public.contatos
  FOR INSERT WITH CHECK (conta_id = public.get_user_conta_id());

CREATE POLICY "Usuarios podem atualizar contatos" ON public.contatos
  FOR UPDATE USING (conta_id = public.get_user_conta_id());

CREATE POLICY "Usuarios podem deletar contatos" ON public.contatos
  FOR DELETE USING (conta_id = public.get_user_conta_id());

-- Políticas RLS para conversas
CREATE POLICY "Usuarios podem ver conversas da conta" ON public.conversas
  FOR SELECT USING (conta_id = public.get_user_conta_id());

CREATE POLICY "Usuarios podem inserir conversas" ON public.conversas
  FOR INSERT WITH CHECK (conta_id = public.get_user_conta_id());

CREATE POLICY "Usuarios podem atualizar conversas" ON public.conversas
  FOR UPDATE USING (conta_id = public.get_user_conta_id());

-- Políticas RLS para mensagens
CREATE POLICY "Usuarios podem ver mensagens das conversas" ON public.mensagens
  FOR SELECT USING (conversa_id IN (SELECT id FROM public.conversas WHERE conta_id = public.get_user_conta_id()));

CREATE POLICY "Usuarios podem inserir mensagens" ON public.mensagens
  FOR INSERT WITH CHECK (conversa_id IN (SELECT id FROM public.conversas WHERE conta_id = public.get_user_conta_id()));

-- Políticas RLS para funis
CREATE POLICY "Usuarios podem ver funis da conta" ON public.funis
  FOR SELECT USING (conta_id = public.get_user_conta_id());

CREATE POLICY "Usuarios podem gerenciar funis" ON public.funis
  FOR ALL USING (conta_id = public.get_user_conta_id());

-- Políticas RLS para estagios
CREATE POLICY "Usuarios podem ver estagios" ON public.estagios
  FOR SELECT USING (funil_id IN (SELECT id FROM public.funis WHERE conta_id = public.get_user_conta_id()));

CREATE POLICY "Usuarios podem gerenciar estagios" ON public.estagios
  FOR ALL USING (funil_id IN (SELECT id FROM public.funis WHERE conta_id = public.get_user_conta_id()));

-- Políticas RLS para negociacoes
CREATE POLICY "Usuarios podem ver negociacoes da conta" ON public.negociacoes
  FOR SELECT USING (conta_id = public.get_user_conta_id());

CREATE POLICY "Usuarios podem gerenciar negociacoes" ON public.negociacoes
  FOR ALL USING (conta_id = public.get_user_conta_id());

-- Políticas RLS para agendamentos
CREATE POLICY "Usuarios podem ver agendamentos da conta" ON public.agendamentos
  FOR SELECT USING (conta_id = public.get_user_conta_id());

CREATE POLICY "Usuarios podem gerenciar agendamentos" ON public.agendamentos
  FOR ALL USING (conta_id = public.get_user_conta_id());

-- Políticas RLS para agent_ia
CREATE POLICY "Usuarios podem ver config IA da conta" ON public.agent_ia
  FOR SELECT USING (conta_id = public.get_user_conta_id());

CREATE POLICY "Usuarios podem gerenciar config IA" ON public.agent_ia
  FOR ALL USING (conta_id = public.get_user_conta_id());

-- Habilitar realtime para mensagens e conversas
ALTER PUBLICATION supabase_realtime ADD TABLE public.mensagens;
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversas;

-- Função para atualizar updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers para updated_at
CREATE TRIGGER update_contas_updated_at BEFORE UPDATE ON public.contas FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_usuarios_updated_at BEFORE UPDATE ON public.usuarios FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_conexoes_updated_at BEFORE UPDATE ON public.conexoes_whatsapp FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_contatos_updated_at BEFORE UPDATE ON public.contatos FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_conversas_updated_at BEFORE UPDATE ON public.conversas FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_funis_updated_at BEFORE UPDATE ON public.funis FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_estagios_updated_at BEFORE UPDATE ON public.estagios FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_negociacoes_updated_at BEFORE UPDATE ON public.negociacoes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_agendamentos_updated_at BEFORE UPDATE ON public.agendamentos FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_agent_ia_updated_at BEFORE UPDATE ON public.agent_ia FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();