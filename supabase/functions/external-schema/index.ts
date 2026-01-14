import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SCHEMA_SQL = `-- ============================================
-- ZapCRM - Schema Completo para Supabase Externo
-- Gerado em: ${new Date().toISOString()}
-- ============================================

-- EXTENSÕES NECESSÁRIAS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- ENUMS
-- ============================================
CREATE TYPE app_role AS ENUM ('admin', 'atendente', 'super_admin');
CREATE TYPE direcao_mensagem AS ENUM ('entrada', 'saida');
CREATE TYPE status_conexao AS ENUM ('conectado', 'desconectado', 'aguardando');
CREATE TYPE status_conversa AS ENUM ('em_atendimento', 'aguardando_cliente', 'encerrado');
CREATE TYPE status_negociacao AS ENUM ('aberto', 'ganho', 'perdido');
CREATE TYPE tipo_mensagem AS ENUM ('texto', 'imagem', 'audio', 'video', 'documento', 'sticker', 'sistema');

-- ============================================
-- FUNÇÃO AUXILIAR - updated_at
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ============================================
-- FUNÇÕES DE SEGURANÇA
-- ============================================
CREATE OR REPLACE FUNCTION get_user_conta_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT conta_id FROM public.usuarios WHERE user_id = auth.uid() LIMIT 1
$$;

CREATE OR REPLACE FUNCTION get_current_usuario_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.usuarios WHERE user_id = auth.uid() LIMIT 1
$$;

CREATE OR REPLACE FUNCTION has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role::text = 'super_admin'
  )
$$;

CREATE OR REPLACE FUNCTION atendente_ver_todas(_usuario_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT ver_todas_conversas FROM public.atendente_config WHERE usuario_id = _usuario_id),
    false
  )
$$;

-- ============================================
-- NÍVEL 0: Tabelas independentes
-- ============================================

CREATE TABLE planos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  descricao TEXT,
  preco_mensal NUMERIC,
  limite_usuarios INTEGER DEFAULT 1,
  limite_conexoes_whatsapp INTEGER DEFAULT 1,
  limite_conexoes_evolution INTEGER DEFAULT 1,
  limite_conexoes_meta INTEGER DEFAULT 0,
  limite_mensagens_mes INTEGER DEFAULT 1000,
  limite_agentes INTEGER DEFAULT 1,
  limite_funis INTEGER DEFAULT 1,
  permite_instagram BOOLEAN DEFAULT false,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE configuracoes_plataforma (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  chave TEXT NOT NULL UNIQUE,
  valor TEXT,
  descricao TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- NÍVEL 1: Depende de planos
-- ============================================

CREATE TABLE contas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  cpf TEXT,
  whatsapp TEXT,
  ativo BOOLEAN DEFAULT true,
  plano_id UUID REFERENCES planos(id),
  openai_api_key TEXT,
  permitir_multiplas_negociacoes BOOLEAN DEFAULT false,
  reabrir_com_ia BOOLEAN DEFAULT false,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  stripe_subscription_status TEXT,
  stripe_current_period_start TIMESTAMPTZ,
  stripe_current_period_end TIMESTAMPTZ,
  stripe_cancel_at_period_end BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- NÍVEL 2: Depende de contas
-- ============================================

CREATE TABLE usuarios (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  conta_id UUID NOT NULL REFERENCES contas(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  email TEXT NOT NULL,
  avatar_url TEXT,
  assinatura_ativa BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE user_roles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE atendente_config (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE UNIQUE,
  ver_todas_conversas BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE conexoes_whatsapp (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  conta_id UUID NOT NULL REFERENCES contas(id) ON DELETE CASCADE,
  nome TEXT DEFAULT 'WhatsApp',
  instance_name TEXT NOT NULL,
  token TEXT NOT NULL,
  numero TEXT,
  qrcode TEXT,
  status status_conexao DEFAULT 'desconectado',
  webhook_url TEXT,
  tipo_canal TEXT DEFAULT 'whatsapp',
  tipo_provedor TEXT DEFAULT 'evolution',
  meta_access_token TEXT,
  meta_phone_number_id TEXT,
  meta_business_account_id TEXT,
  meta_webhook_verify_token TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE contatos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  conta_id UUID NOT NULL REFERENCES contas(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  telefone TEXT NOT NULL,
  email TEXT,
  avatar_url TEXT,
  tags TEXT[],
  canal TEXT DEFAULT 'whatsapp',
  is_grupo BOOLEAN DEFAULT false,
  grupo_jid TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE funis (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  conta_id UUID NOT NULL REFERENCES contas(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  descricao TEXT,
  cor TEXT,
  ordem INTEGER,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE agent_ia (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  conta_id UUID NOT NULL REFERENCES contas(id) ON DELETE CASCADE,
  nome TEXT,
  descricao TEXT,
  prompt_sistema TEXT,
  gatilho TEXT,
  ativo BOOLEAN DEFAULT true,
  modelo TEXT DEFAULT 'gpt-4o-mini',
  temperatura NUMERIC DEFAULT 0.7,
  max_tokens INTEGER DEFAULT 500,
  quantidade_mensagens_contexto INTEGER DEFAULT 10,
  tempo_espera_segundos INTEGER DEFAULT 5,
  simular_digitacao BOOLEAN DEFAULT true,
  fracionar_mensagens BOOLEAN DEFAULT false,
  tamanho_max_fracao INTEGER DEFAULT 300,
  delay_entre_fracoes INTEGER DEFAULT 2,
  atender_24h BOOLEAN DEFAULT true,
  horario_inicio TEXT,
  horario_fim TEXT,
  dias_ativos INTEGER[],
  mensagem_fora_horario TEXT,
  tipo TEXT DEFAULT 'atendimento',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE tags (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  conta_id UUID NOT NULL REFERENCES contas(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  cor TEXT DEFAULT '#3B82F6',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE calendarios_google (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  conta_id UUID NOT NULL REFERENCES contas(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  email_google TEXT NOT NULL,
  calendar_id TEXT,
  access_token TEXT,
  refresh_token TEXT,
  token_expiry TIMESTAMPTZ,
  cor TEXT,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE campos_personalizados_grupos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  conta_id UUID NOT NULL REFERENCES contas(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  ordem INTEGER,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE campos_personalizados (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  conta_id UUID NOT NULL REFERENCES contas(id) ON DELETE CASCADE,
  grupo_id UUID REFERENCES campos_personalizados_grupos(id) ON DELETE SET NULL,
  nome TEXT NOT NULL,
  tipo TEXT DEFAULT 'texto',
  opcoes JSONB,
  obrigatorio BOOLEAN DEFAULT false,
  ordem INTEGER,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE lembrete_regras (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  conta_id UUID NOT NULL REFERENCES contas(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  tipo TEXT DEFAULT 'fixa',
  mensagem_fixa TEXT,
  prompt_lembrete TEXT,
  minutos_antes INTEGER DEFAULT 60,
  incluir_detalhes BOOLEAN DEFAULT true,
  incluir_link_meet BOOLEAN DEFAULT true,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE logs_atividade (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  conta_id UUID NOT NULL REFERENCES contas(id) ON DELETE CASCADE,
  usuario_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  tipo TEXT NOT NULL,
  descricao TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE notificacoes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  conta_id UUID NOT NULL REFERENCES contas(id) ON DELETE CASCADE,
  usuario_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  titulo TEXT NOT NULL,
  mensagem TEXT,
  tipo TEXT DEFAULT 'info',
  lida BOOLEAN DEFAULT false,
  link TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE mensagens_processadas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  conta_id UUID NOT NULL REFERENCES contas(id) ON DELETE CASCADE,
  telefone TEXT NOT NULL,
  evolution_msg_id TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- NÍVEL 3: Depende de nível 2
-- ============================================

CREATE TABLE estagios (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  funil_id UUID NOT NULL REFERENCES funis(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  cor TEXT,
  ordem INTEGER,
  tipo TEXT,
  followup_ativo BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE agent_ia_perguntas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_ia_id UUID NOT NULL REFERENCES agent_ia(id) ON DELETE CASCADE,
  pergunta TEXT NOT NULL,
  resposta TEXT NOT NULL,
  ordem INTEGER,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE agent_ia_etapas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_ia_id UUID NOT NULL REFERENCES agent_ia(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  numero INTEGER NOT NULL,
  descricao TEXT,
  tipo TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE agent_ia_agendamento_config (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_ia_id UUID NOT NULL REFERENCES agent_ia(id) ON DELETE CASCADE UNIQUE,
  google_calendar_id UUID REFERENCES calendarios_google(id) ON DELETE SET NULL,
  ativo BOOLEAN DEFAULT false,
  tipo_agenda TEXT DEFAULT 'interno',
  nome_agendamento TEXT,
  descricao_agendamento TEXT,
  duracao_padrao INTEGER DEFAULT 60,
  intervalo_entre_agendamentos INTEGER DEFAULT 0,
  antecedencia_minima_horas INTEGER DEFAULT 24,
  antecedencia_maxima_dias INTEGER DEFAULT 30,
  horario_inicio_dia TEXT DEFAULT '09:00',
  horario_fim_dia TEXT DEFAULT '18:00',
  limite_por_horario INTEGER DEFAULT 1,
  gerar_meet BOOLEAN DEFAULT false,
  prompt_consulta_horarios TEXT,
  prompt_marcacao_horario TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE agent_ia_agendamento_horarios (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  config_id UUID NOT NULL REFERENCES agent_ia_agendamento_config(id) ON DELETE CASCADE,
  dia_semana INTEGER NOT NULL,
  hora_inicio TEXT NOT NULL,
  hora_fim TEXT NOT NULL,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE conversas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  conta_id UUID NOT NULL REFERENCES contas(id) ON DELETE CASCADE,
  contato_id UUID NOT NULL REFERENCES contatos(id) ON DELETE CASCADE,
  conexao_id UUID REFERENCES conexoes_whatsapp(id) ON DELETE SET NULL,
  atendente_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  agente_ia_id UUID REFERENCES agent_ia(id) ON DELETE SET NULL,
  agente_ia_ativo BOOLEAN DEFAULT false,
  etapa_ia_atual UUID REFERENCES agent_ia_etapas(id) ON DELETE SET NULL,
  status status_conversa DEFAULT 'em_atendimento',
  ultima_mensagem TEXT,
  ultima_mensagem_at TIMESTAMPTZ,
  nao_lidas INTEGER DEFAULT 0,
  arquivada BOOLEAN DEFAULT false,
  canal TEXT DEFAULT 'whatsapp',
  memoria_limpa_em TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE negociacoes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  conta_id UUID NOT NULL REFERENCES contas(id) ON DELETE CASCADE,
  contato_id UUID NOT NULL REFERENCES contatos(id) ON DELETE CASCADE,
  estagio_id UUID REFERENCES estagios(id) ON DELETE SET NULL,
  responsavel_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  titulo TEXT NOT NULL,
  valor NUMERIC,
  status status_negociacao DEFAULT 'aberto',
  probabilidade INTEGER,
  notas TEXT,
  data_fechamento TIMESTAMPTZ,
  resumo_ia TEXT,
  resumo_gerado_em TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE agendamentos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  conta_id UUID NOT NULL REFERENCES contas(id) ON DELETE CASCADE,
  contato_id UUID REFERENCES contatos(id) ON DELETE SET NULL,
  usuario_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  titulo TEXT NOT NULL,
  descricao TEXT,
  data_inicio TIMESTAMPTZ NOT NULL,
  data_fim TIMESTAMPTZ,
  google_event_id TEXT,
  google_meet_link TEXT,
  concluido BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE contato_campos_valores (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  contato_id UUID NOT NULL REFERENCES contatos(id) ON DELETE CASCADE,
  campo_id UUID NOT NULL REFERENCES campos_personalizados(id) ON DELETE CASCADE,
  valor TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE followup_regras (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  conta_id UUID NOT NULL REFERENCES contas(id) ON DELETE CASCADE,
  agent_ia_id UUID REFERENCES agent_ia(id) ON DELETE SET NULL,
  nome TEXT NOT NULL,
  tipo TEXT DEFAULT 'fixa',
  mensagem_fixa TEXT,
  prompt_followup TEXT,
  horas_sem_resposta INTEGER DEFAULT 24,
  max_tentativas INTEGER DEFAULT 3,
  intervalo_entre_tentativas INTEGER DEFAULT 24,
  estagio_ids TEXT[],
  aplicar_ia_ativa BOOLEAN DEFAULT true,
  aplicar_ia_pausada BOOLEAN DEFAULT true,
  quantidade_mensagens_contexto INTEGER DEFAULT 5,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- NÍVEL 4: Depende de nível 3
-- ============================================

CREATE TABLE mensagens (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  conversa_id UUID NOT NULL REFERENCES conversas(id) ON DELETE CASCADE,
  contato_id UUID REFERENCES contatos(id) ON DELETE SET NULL,
  usuario_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  conteudo TEXT NOT NULL,
  direcao direcao_mensagem NOT NULL,
  tipo tipo_mensagem DEFAULT 'texto',
  media_url TEXT,
  metadata JSONB,
  lida BOOLEAN DEFAULT false,
  enviada_por_ia BOOLEAN DEFAULT false,
  enviada_por_dispositivo BOOLEAN DEFAULT false,
  deletada BOOLEAN DEFAULT false,
  deletada_em TIMESTAMPTZ,
  deletada_por UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE respostas_pendentes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  conversa_id UUID NOT NULL REFERENCES conversas(id) ON DELETE CASCADE UNIQUE,
  responder_em TIMESTAMPTZ NOT NULL,
  processando BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE negociacao_historico (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  negociacao_id UUID NOT NULL REFERENCES negociacoes(id) ON DELETE CASCADE,
  usuario_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  estagio_anterior_id UUID REFERENCES estagios(id) ON DELETE SET NULL,
  estagio_novo_id UUID REFERENCES estagios(id) ON DELETE SET NULL,
  tipo TEXT DEFAULT 'mudanca_estagio',
  descricao TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE negociacao_notas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  negociacao_id UUID NOT NULL REFERENCES negociacoes(id) ON DELETE CASCADE,
  usuario_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  conteudo TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE transferencias_atendimento (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  conversa_id UUID NOT NULL REFERENCES conversas(id) ON DELETE CASCADE,
  de_usuario_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  para_usuario_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  para_agente_ia BOOLEAN DEFAULT false,
  motivo TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE followup_enviados (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  regra_id UUID NOT NULL REFERENCES followup_regras(id) ON DELETE CASCADE,
  conversa_id UUID NOT NULL REFERENCES conversas(id) ON DELETE CASCADE,
  tentativa INTEGER DEFAULT 1,
  mensagem_enviada TEXT,
  enviado_em TIMESTAMPTZ DEFAULT now(),
  respondido BOOLEAN DEFAULT false,
  respondido_em TIMESTAMPTZ
);

CREATE TABLE lembrete_enviados (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  regra_id UUID NOT NULL REFERENCES lembrete_regras(id) ON DELETE CASCADE,
  agendamento_id UUID NOT NULL REFERENCES agendamentos(id) ON DELETE CASCADE,
  contato_id UUID REFERENCES contatos(id) ON DELETE SET NULL,
  mensagem_enviada TEXT,
  enviado_em TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE followups_agendados (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  conta_id UUID NOT NULL REFERENCES contas(id) ON DELETE CASCADE,
  conversa_id UUID NOT NULL REFERENCES conversas(id) ON DELETE CASCADE,
  contato_id UUID NOT NULL REFERENCES contatos(id) ON DELETE CASCADE,
  agente_ia_id UUID REFERENCES agent_ia(id) ON DELETE SET NULL,
  data_agendada TIMESTAMPTZ NOT NULL,
  motivo TEXT,
  contexto TEXT,
  status TEXT DEFAULT 'pendente',
  mensagem_enviada TEXT,
  enviado_em TIMESTAMPTZ,
  criado_por TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE uso_tokens (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  conta_id UUID NOT NULL REFERENCES contas(id) ON DELETE CASCADE,
  conversa_id UUID REFERENCES conversas(id) ON DELETE SET NULL,
  provider TEXT NOT NULL,
  modelo TEXT NOT NULL,
  prompt_tokens INTEGER DEFAULT 0,
  completion_tokens INTEGER DEFAULT 0,
  total_tokens INTEGER DEFAULT 0,
  custo_estimado NUMERIC,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- ÍNDICES
-- ============================================
CREATE INDEX idx_usuarios_user_id ON usuarios(user_id);
CREATE INDEX idx_usuarios_conta_id ON usuarios(conta_id);
CREATE INDEX idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX idx_conversas_conta_id ON conversas(conta_id);
CREATE INDEX idx_conversas_contato_id ON conversas(contato_id);
CREATE INDEX idx_conversas_status ON conversas(status);
CREATE INDEX idx_mensagens_conversa_id ON mensagens(conversa_id);
CREATE INDEX idx_mensagens_created_at ON mensagens(created_at);
CREATE INDEX idx_contatos_conta_id ON contatos(conta_id);
CREATE INDEX idx_contatos_telefone ON contatos(telefone);
CREATE INDEX idx_negociacoes_conta_id ON negociacoes(conta_id);
CREATE INDEX idx_negociacoes_estagio_id ON negociacoes(estagio_id);
CREATE INDEX idx_estagios_funil_id ON estagios(funil_id);
CREATE INDEX idx_agent_ia_conta_id ON agent_ia(conta_id);
CREATE INDEX idx_conexoes_conta_id ON conexoes_whatsapp(conta_id);
CREATE INDEX idx_agendamentos_conta_id ON agendamentos(conta_id);
CREATE INDEX idx_agendamentos_data_inicio ON agendamentos(data_inicio);
CREATE INDEX idx_mensagens_processadas ON mensagens_processadas(conta_id, telefone, evolution_msg_id);
CREATE INDEX idx_respostas_pendentes_responder_em ON respostas_pendentes(responder_em);
CREATE INDEX idx_followups_agendados_data ON followups_agendados(data_agendada, status);

-- ============================================
-- TRIGGERS
-- ============================================
CREATE TRIGGER update_contas_updated_at BEFORE UPDATE ON contas FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_usuarios_updated_at BEFORE UPDATE ON usuarios FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_conversas_updated_at BEFORE UPDATE ON conversas FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_contatos_updated_at BEFORE UPDATE ON contatos FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_funis_updated_at BEFORE UPDATE ON funis FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_estagios_updated_at BEFORE UPDATE ON estagios FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_negociacoes_updated_at BEFORE UPDATE ON negociacoes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_agent_ia_updated_at BEFORE UPDATE ON agent_ia FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_conexoes_updated_at BEFORE UPDATE ON conexoes_whatsapp FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_agendamentos_updated_at BEFORE UPDATE ON agendamentos FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_tags_updated_at BEFORE UPDATE ON tags FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_planos_updated_at BEFORE UPDATE ON planos FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- REALTIME
-- ============================================
ALTER PUBLICATION supabase_realtime ADD TABLE mensagens;
ALTER PUBLICATION supabase_realtime ADD TABLE conversas;
ALTER PUBLICATION supabase_realtime ADD TABLE notificacoes;
ALTER PUBLICATION supabase_realtime ADD TABLE negociacoes;
ALTER PUBLICATION supabase_realtime ADD TABLE contatos;

-- ============================================
-- SUCESSO!
-- ============================================
SELECT 'Schema criado com sucesso!' AS status;
`;

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const download = url.searchParams.get('download') === 'true';

    const headers: Record<string, string> = {
      ...corsHeaders,
      'Content-Type': 'text/plain; charset=utf-8',
    };

    if (download) {
      headers['Content-Disposition'] = 'attachment; filename="schema-supabase-externo.sql"';
    }

    return new Response(SCHEMA_SQL, { headers });
  } catch (error) {
    console.error('Erro ao gerar schema:', error);
    return new Response(
      JSON.stringify({ error: 'Erro ao gerar schema SQL' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
