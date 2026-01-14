-- =====================================================
-- SCHEMA COMPLETO PARA SUPABASE EXTERNO
-- Execute este SQL no seu Supabase externo (cognityx)
-- =====================================================

-- Habilitar extensões necessárias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- ENUMS
-- =====================================================

DO $$ BEGIN
  CREATE TYPE app_role AS ENUM ('admin', 'atendente', 'super_admin');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE direcao_mensagem AS ENUM ('entrada', 'saida');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE status_conexao AS ENUM ('conectado', 'desconectado', 'aguardando');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE status_conversa AS ENUM ('em_atendimento', 'aguardando_cliente', 'encerrado');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE status_negociacao AS ENUM ('aberto', 'ganho', 'perdido');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE tipo_mensagem AS ENUM ('texto', 'imagem', 'audio', 'video', 'documento', 'sticker', 'sistema');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- =====================================================
-- TABELA DE CONTROLE DE SINCRONIZAÇÃO
-- =====================================================

CREATE TABLE IF NOT EXISTS sync_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tabela TEXT NOT NULL UNIQUE,
  ultimo_sync TIMESTAMPTZ NOT NULL DEFAULT '1970-01-01',
  registros_sincronizados INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- =====================================================
-- NÍVEL 0 - SEM DEPENDÊNCIAS
-- =====================================================

-- Tabela: planos
CREATE TABLE IF NOT EXISTS planos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  descricao TEXT,
  preco_mensal NUMERIC,
  limite_usuarios INTEGER DEFAULT 1,
  limite_conexoes_whatsapp INTEGER DEFAULT 1,
  limite_conexoes_evolution INTEGER DEFAULT 1,
  limite_conexoes_meta INTEGER DEFAULT 0,
  limite_agentes INTEGER DEFAULT 1,
  limite_funis INTEGER DEFAULT 1,
  limite_mensagens_mes INTEGER DEFAULT 1000,
  permite_instagram BOOLEAN DEFAULT false,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela: configuracoes_plataforma
CREATE TABLE IF NOT EXISTS configuracoes_plataforma (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chave TEXT NOT NULL UNIQUE,
  valor TEXT,
  descricao TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- =====================================================
-- NÍVEL 1 - DEPENDEM DE NÍVEL 0
-- =====================================================

-- Tabela: contas
CREATE TABLE IF NOT EXISTS contas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  cpf TEXT,
  whatsapp TEXT,
  openai_api_key TEXT,
  plano_id UUID REFERENCES planos(id),
  ativo BOOLEAN DEFAULT true,
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

-- =====================================================
-- NÍVEL 2 - DEPENDEM DE CONTAS
-- =====================================================

-- Tabela: usuarios
CREATE TABLE IF NOT EXISTS usuarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  conta_id UUID NOT NULL REFERENCES contas(id),
  nome TEXT NOT NULL,
  email TEXT NOT NULL,
  avatar_url TEXT,
  is_admin BOOLEAN DEFAULT false,
  assinatura_ativa BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela: contatos
CREATE TABLE IF NOT EXISTS contatos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conta_id UUID NOT NULL REFERENCES contas(id),
  nome TEXT NOT NULL,
  telefone TEXT NOT NULL,
  email TEXT,
  avatar_url TEXT,
  tags TEXT[],
  canal TEXT,
  is_grupo BOOLEAN DEFAULT false,
  grupo_jid TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela: conexoes_whatsapp
CREATE TABLE IF NOT EXISTS conexoes_whatsapp (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conta_id UUID NOT NULL REFERENCES contas(id),
  nome TEXT DEFAULT 'WhatsApp',
  instance_name TEXT NOT NULL,
  token TEXT NOT NULL,
  numero TEXT,
  qrcode TEXT,
  status status_conexao DEFAULT 'desconectado',
  webhook_url TEXT,
  tipo_provedor TEXT,
  tipo_canal TEXT,
  meta_access_token TEXT,
  meta_phone_number_id TEXT,
  meta_business_account_id TEXT,
  meta_webhook_verify_token TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela: funis
CREATE TABLE IF NOT EXISTS funis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conta_id UUID NOT NULL REFERENCES contas(id),
  nome TEXT NOT NULL,
  descricao TEXT,
  cor TEXT,
  ordem INTEGER,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela: agent_ia
CREATE TABLE IF NOT EXISTS agent_ia (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conta_id UUID NOT NULL REFERENCES contas(id),
  nome TEXT,
  descricao TEXT,
  tipo TEXT,
  gatilho TEXT,
  prompt_sistema TEXT,
  modelo TEXT,
  temperatura NUMERIC,
  max_tokens INTEGER,
  ativo BOOLEAN DEFAULT true,
  atender_24h BOOLEAN DEFAULT true,
  horario_inicio TEXT,
  horario_fim TEXT,
  dias_ativos INTEGER[],
  mensagem_fora_horario TEXT,
  tempo_espera_segundos INTEGER DEFAULT 30,
  quantidade_mensagens_contexto INTEGER DEFAULT 10,
  simular_digitacao BOOLEAN DEFAULT true,
  fracionar_mensagens BOOLEAN DEFAULT false,
  tamanho_max_fracao INTEGER,
  delay_entre_fracoes INTEGER,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela: tags
CREATE TABLE IF NOT EXISTS tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conta_id UUID NOT NULL REFERENCES contas(id),
  nome TEXT NOT NULL,
  cor TEXT DEFAULT '#3B82F6',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela: calendarios_google
CREATE TABLE IF NOT EXISTS calendarios_google (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conta_id UUID NOT NULL REFERENCES contas(id),
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

-- Tabela: campos_personalizados_grupos
CREATE TABLE IF NOT EXISTS campos_personalizados_grupos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conta_id UUID NOT NULL REFERENCES contas(id),
  nome TEXT NOT NULL,
  ordem INTEGER,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela: followup_regras
CREATE TABLE IF NOT EXISTS followup_regras (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conta_id UUID NOT NULL REFERENCES contas(id),
  agent_ia_id UUID REFERENCES agent_ia(id),
  nome TEXT NOT NULL,
  tipo TEXT DEFAULT 'mensagem_fixa',
  horas_sem_resposta INTEGER DEFAULT 24,
  max_tentativas INTEGER DEFAULT 3,
  intervalo_entre_tentativas INTEGER DEFAULT 24,
  mensagem_fixa TEXT,
  prompt_followup TEXT,
  quantidade_mensagens_contexto INTEGER DEFAULT 5,
  estagio_ids TEXT[],
  aplicar_ia_ativa BOOLEAN DEFAULT true,
  aplicar_ia_pausada BOOLEAN DEFAULT true,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela: lembrete_regras
CREATE TABLE IF NOT EXISTS lembrete_regras (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conta_id UUID NOT NULL REFERENCES contas(id),
  nome TEXT NOT NULL,
  tipo TEXT DEFAULT 'mensagem_fixa',
  minutos_antes INTEGER DEFAULT 60,
  mensagem_fixa TEXT,
  prompt_lembrete TEXT,
  incluir_detalhes BOOLEAN DEFAULT true,
  incluir_link_meet BOOLEAN DEFAULT true,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- =====================================================
-- NÍVEL 3 - DEPENDEM DE NÍVEL 2
-- =====================================================

-- Tabela: user_roles
CREATE TABLE IF NOT EXISTS user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela: atendente_config
CREATE TABLE IF NOT EXISTS atendente_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID NOT NULL REFERENCES usuarios(id),
  ver_todas_conversas BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela: estagios
CREATE TABLE IF NOT EXISTS estagios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  funil_id UUID NOT NULL REFERENCES funis(id),
  nome TEXT NOT NULL,
  cor TEXT,
  ordem INTEGER,
  tipo TEXT,
  followup_ativo BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela: agent_ia_etapas
CREATE TABLE IF NOT EXISTS agent_ia_etapas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_ia_id UUID NOT NULL REFERENCES agent_ia(id),
  nome TEXT NOT NULL,
  numero INTEGER NOT NULL,
  descricao TEXT,
  tipo TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela: agent_ia_perguntas
CREATE TABLE IF NOT EXISTS agent_ia_perguntas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_ia_id UUID NOT NULL REFERENCES agent_ia(id),
  pergunta TEXT NOT NULL,
  resposta TEXT NOT NULL,
  ordem INTEGER,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela: agent_ia_agendamento_config
CREATE TABLE IF NOT EXISTS agent_ia_agendamento_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_ia_id UUID NOT NULL REFERENCES agent_ia(id) UNIQUE,
  google_calendar_id UUID REFERENCES calendarios_google(id),
  tipo_agenda TEXT,
  nome_agendamento TEXT,
  descricao_agendamento TEXT,
  duracao_padrao INTEGER DEFAULT 60,
  intervalo_entre_agendamentos INTEGER DEFAULT 0,
  antecedencia_minima_horas INTEGER DEFAULT 1,
  antecedencia_maxima_dias INTEGER DEFAULT 30,
  limite_por_horario INTEGER DEFAULT 1,
  horario_inicio_dia TEXT,
  horario_fim_dia TEXT,
  gerar_meet BOOLEAN DEFAULT false,
  prompt_consulta_horarios TEXT,
  prompt_marcacao_horario TEXT,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela: campos_personalizados
CREATE TABLE IF NOT EXISTS campos_personalizados (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conta_id UUID NOT NULL REFERENCES contas(id),
  grupo_id UUID REFERENCES campos_personalizados_grupos(id),
  nome TEXT NOT NULL,
  tipo TEXT DEFAULT 'texto',
  opcoes JSONB,
  obrigatorio BOOLEAN DEFAULT false,
  ordem INTEGER,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- =====================================================
-- NÍVEL 4 - DEPENDEM DE NÍVEL 3
-- =====================================================

-- Tabela: agent_ia_agendamento_horarios
CREATE TABLE IF NOT EXISTS agent_ia_agendamento_horarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES agent_ia_agendamento_config(id),
  dia_semana INTEGER NOT NULL,
  hora_inicio TEXT NOT NULL,
  hora_fim TEXT NOT NULL,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela: conversas
CREATE TABLE IF NOT EXISTS conversas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conta_id UUID NOT NULL REFERENCES contas(id),
  contato_id UUID NOT NULL REFERENCES contatos(id),
  conexao_id UUID REFERENCES conexoes_whatsapp(id),
  atendente_id UUID REFERENCES usuarios(id),
  agente_ia_id UUID REFERENCES agent_ia(id),
  etapa_ia_atual UUID REFERENCES agent_ia_etapas(id),
  status status_conversa DEFAULT 'em_atendimento',
  canal TEXT,
  agente_ia_ativo BOOLEAN DEFAULT false,
  ultima_mensagem TEXT,
  ultima_mensagem_at TIMESTAMPTZ,
  nao_lidas INTEGER DEFAULT 0,
  arquivada BOOLEAN DEFAULT false,
  memoria_limpa_em TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela: negociacoes
CREATE TABLE IF NOT EXISTS negociacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conta_id UUID NOT NULL REFERENCES contas(id),
  contato_id UUID NOT NULL REFERENCES contatos(id),
  estagio_id UUID REFERENCES estagios(id),
  responsavel_id UUID REFERENCES usuarios(id),
  titulo TEXT NOT NULL,
  valor NUMERIC,
  status status_negociacao DEFAULT 'aberto',
  probabilidade INTEGER,
  data_fechamento TIMESTAMPTZ,
  notas TEXT,
  resumo_ia TEXT,
  resumo_gerado_em TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela: agendamentos
CREATE TABLE IF NOT EXISTS agendamentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conta_id UUID NOT NULL REFERENCES contas(id),
  contato_id UUID REFERENCES contatos(id),
  usuario_id UUID REFERENCES usuarios(id),
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

-- Tabela: contato_campos_valores
CREATE TABLE IF NOT EXISTS contato_campos_valores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contato_id UUID NOT NULL REFERENCES contatos(id),
  campo_id UUID NOT NULL REFERENCES campos_personalizados(id),
  valor TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- =====================================================
-- NÍVEL 5 - DEPENDEM DE NÍVEL 4
-- =====================================================

-- Tabela: mensagens
CREATE TABLE IF NOT EXISTS mensagens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversa_id UUID NOT NULL REFERENCES conversas(id),
  contato_id UUID REFERENCES contatos(id),
  usuario_id UUID REFERENCES usuarios(id),
  conteudo TEXT NOT NULL,
  tipo tipo_mensagem DEFAULT 'texto',
  direcao direcao_mensagem NOT NULL,
  media_url TEXT,
  metadata JSONB,
  lida BOOLEAN DEFAULT false,
  enviada_por_ia BOOLEAN DEFAULT false,
  enviada_por_dispositivo BOOLEAN DEFAULT false,
  deletada BOOLEAN DEFAULT false,
  deletada_em TIMESTAMPTZ,
  deletada_por UUID REFERENCES usuarios(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela: mensagens_processadas
CREATE TABLE IF NOT EXISTS mensagens_processadas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conta_id UUID NOT NULL REFERENCES contas(id),
  telefone TEXT NOT NULL,
  evolution_msg_id TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela: respostas_pendentes
CREATE TABLE IF NOT EXISTS respostas_pendentes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversa_id UUID NOT NULL REFERENCES conversas(id) UNIQUE,
  responder_em TIMESTAMPTZ NOT NULL,
  processando BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela: followup_enviados
CREATE TABLE IF NOT EXISTS followup_enviados (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  regra_id UUID NOT NULL REFERENCES followup_regras(id),
  conversa_id UUID NOT NULL REFERENCES conversas(id),
  tentativa INTEGER DEFAULT 1,
  mensagem_enviada TEXT,
  enviado_em TIMESTAMPTZ DEFAULT now(),
  respondido BOOLEAN DEFAULT false,
  respondido_em TIMESTAMPTZ
);

-- Tabela: followups_agendados
CREATE TABLE IF NOT EXISTS followups_agendados (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conta_id UUID NOT NULL REFERENCES contas(id),
  conversa_id UUID NOT NULL REFERENCES conversas(id),
  contato_id UUID NOT NULL REFERENCES contatos(id),
  agente_ia_id UUID REFERENCES agent_ia(id),
  data_agendada TIMESTAMPTZ NOT NULL,
  motivo TEXT,
  contexto TEXT,
  status TEXT DEFAULT 'pendente',
  mensagem_enviada TEXT,
  enviado_em TIMESTAMPTZ,
  criado_por UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela: negociacao_historico
CREATE TABLE IF NOT EXISTS negociacao_historico (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  negociacao_id UUID NOT NULL REFERENCES negociacoes(id),
  usuario_id UUID REFERENCES usuarios(id),
  tipo TEXT DEFAULT 'alteracao',
  descricao TEXT,
  estagio_anterior_id UUID REFERENCES estagios(id),
  estagio_novo_id UUID REFERENCES estagios(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela: negociacao_notas
CREATE TABLE IF NOT EXISTS negociacao_notas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  negociacao_id UUID NOT NULL REFERENCES negociacoes(id),
  usuario_id UUID REFERENCES usuarios(id),
  conteudo TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela: lembrete_enviados
CREATE TABLE IF NOT EXISTS lembrete_enviados (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  regra_id UUID NOT NULL REFERENCES lembrete_regras(id),
  agendamento_id UUID NOT NULL REFERENCES agendamentos(id),
  contato_id UUID REFERENCES contatos(id),
  mensagem_enviada TEXT,
  enviado_em TIMESTAMPTZ DEFAULT now()
);

-- Tabela: transferencias_atendimento
CREATE TABLE IF NOT EXISTS transferencias_atendimento (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversa_id UUID NOT NULL REFERENCES conversas(id),
  de_usuario_id UUID REFERENCES usuarios(id),
  para_usuario_id UUID REFERENCES usuarios(id),
  para_agente_ia BOOLEAN DEFAULT false,
  motivo TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela: notificacoes
CREATE TABLE IF NOT EXISTS notificacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conta_id UUID NOT NULL REFERENCES contas(id),
  usuario_id UUID REFERENCES usuarios(id),
  titulo TEXT NOT NULL,
  mensagem TEXT,
  tipo TEXT DEFAULT 'info',
  link TEXT,
  metadata JSONB,
  lida BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela: logs_atividade
CREATE TABLE IF NOT EXISTS logs_atividade (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conta_id UUID NOT NULL REFERENCES contas(id),
  usuario_id UUID REFERENCES usuarios(id),
  tipo TEXT NOT NULL,
  descricao TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela: uso_tokens
CREATE TABLE IF NOT EXISTS uso_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conta_id UUID NOT NULL REFERENCES contas(id),
  conversa_id UUID REFERENCES conversas(id),
  provider TEXT NOT NULL,
  modelo TEXT NOT NULL,
  prompt_tokens INTEGER DEFAULT 0,
  completion_tokens INTEGER DEFAULT 0,
  total_tokens INTEGER DEFAULT 0,
  custo_estimado NUMERIC,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =====================================================
-- ÍNDICES PARA PERFORMANCE
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_mensagens_conversa_id ON mensagens(conversa_id);
CREATE INDEX IF NOT EXISTS idx_mensagens_created_at ON mensagens(created_at);
CREATE INDEX IF NOT EXISTS idx_conversas_conta_id ON conversas(conta_id);
CREATE INDEX IF NOT EXISTS idx_conversas_contato_id ON conversas(contato_id);
CREATE INDEX IF NOT EXISTS idx_conversas_updated_at ON conversas(updated_at);
CREATE INDEX IF NOT EXISTS idx_contatos_conta_id ON contatos(conta_id);
CREATE INDEX IF NOT EXISTS idx_contatos_telefone ON contatos(telefone);
CREATE INDEX IF NOT EXISTS idx_usuarios_conta_id ON usuarios(conta_id);
CREATE INDEX IF NOT EXISTS idx_usuarios_user_id ON usuarios(user_id);
CREATE INDEX IF NOT EXISTS idx_negociacoes_conta_id ON negociacoes(conta_id);
CREATE INDEX IF NOT EXISTS idx_negociacoes_contato_id ON negociacoes(contato_id);
CREATE INDEX IF NOT EXISTS idx_sync_log_tabela ON sync_log(tabela);

-- =====================================================
-- FIM DO SCHEMA
-- =====================================================

-- Após executar este SQL, a sincronização automática
-- do Lovable Cloud vai popular todas as tabelas.
