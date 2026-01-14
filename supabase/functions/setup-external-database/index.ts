import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// SQL completo para criar o schema no banco externo
const SCHEMA_SQL = `
-- ==========================================
-- ENUMS
-- ==========================================
DO $$ BEGIN
  CREATE TYPE app_role AS ENUM ('admin', 'atendente', 'super_admin');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE direcao_mensagem AS ENUM ('entrada', 'saida');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE status_conexao AS ENUM ('conectado', 'desconectado', 'aguardando');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE status_conversa AS ENUM ('em_atendimento', 'aguardando_cliente', 'encerrado');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE status_negociacao AS ENUM ('aberto', 'ganho', 'perdido');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE tipo_mensagem AS ENUM ('texto', 'imagem', 'audio', 'video', 'documento', 'sticker', 'sistema');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- ==========================================
-- FUNÇÕES AUXILIARES
-- ==========================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ==========================================
-- NÍVEL 0: Tabelas sem dependências
-- ==========================================

-- Tabela sync_log para controle de sincronização
CREATE TABLE IF NOT EXISTS public.sync_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tabela TEXT UNIQUE NOT NULL,
  ultimo_sync TIMESTAMPTZ,
  registros_sync INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Planos
CREATE TABLE IF NOT EXISTS public.planos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  descricao TEXT,
  preco_mensal NUMERIC,
  limite_usuarios INT DEFAULT 1,
  limite_conexoes_whatsapp INT DEFAULT 1,
  limite_conexoes_evolution INT DEFAULT 1,
  limite_conexoes_meta INT DEFAULT 0,
  limite_agentes INT DEFAULT 1,
  limite_funis INT DEFAULT 1,
  limite_mensagens_mes INT DEFAULT 1000,
  permite_instagram BOOLEAN DEFAULT false,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Configurações da plataforma
CREATE TABLE IF NOT EXISTS public.configuracoes_plataforma (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chave TEXT UNIQUE NOT NULL,
  valor TEXT,
  descricao TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ==========================================
-- NÍVEL 1: Dependem do nível 0
-- ==========================================

-- Contas
CREATE TABLE IF NOT EXISTS public.contas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  whatsapp TEXT,
  cpf TEXT,
  openai_api_key TEXT,
  ativo BOOLEAN DEFAULT true,
  plano_id UUID REFERENCES public.planos(id),
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

-- ==========================================
-- NÍVEL 2: Dependem do nível 1
-- ==========================================

-- Usuários
CREATE TABLE IF NOT EXISTS public.usuarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  conta_id UUID NOT NULL REFERENCES public.contas(id),
  nome TEXT NOT NULL,
  email TEXT NOT NULL,
  avatar_url TEXT,
  is_admin BOOLEAN DEFAULT false,
  assinatura_ativa BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Contatos
CREATE TABLE IF NOT EXISTS public.contatos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conta_id UUID NOT NULL REFERENCES public.contas(id),
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

-- Conexões WhatsApp
CREATE TABLE IF NOT EXISTS public.conexoes_whatsapp (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conta_id UUID NOT NULL REFERENCES public.contas(id),
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

-- Funis
CREATE TABLE IF NOT EXISTS public.funis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conta_id UUID NOT NULL REFERENCES public.contas(id),
  nome TEXT NOT NULL,
  descricao TEXT,
  cor TEXT,
  ordem INT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Agentes IA
CREATE TABLE IF NOT EXISTS public.agent_ia (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conta_id UUID NOT NULL REFERENCES public.contas(id),
  nome TEXT,
  descricao TEXT,
  tipo TEXT,
  gatilho TEXT,
  prompt_sistema TEXT,
  modelo TEXT,
  temperatura NUMERIC,
  max_tokens INT,
  ativo BOOLEAN DEFAULT true,
  atender_24h BOOLEAN DEFAULT false,
  horario_inicio TIME,
  horario_fim TIME,
  dias_ativos INT[],
  mensagem_fora_horario TEXT,
  tempo_espera_segundos INT DEFAULT 30,
  simular_digitacao BOOLEAN DEFAULT true,
  fracionar_mensagens BOOLEAN DEFAULT false,
  tamanho_max_fracao INT,
  delay_entre_fracoes INT,
  quantidade_mensagens_contexto INT DEFAULT 10,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Tags
CREATE TABLE IF NOT EXISTS public.tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conta_id UUID NOT NULL REFERENCES public.contas(id),
  nome TEXT NOT NULL,
  cor TEXT DEFAULT '#3B82F6',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Calendários Google
CREATE TABLE IF NOT EXISTS public.calendarios_google (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conta_id UUID NOT NULL REFERENCES public.contas(id),
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

-- Grupos de campos personalizados
CREATE TABLE IF NOT EXISTS public.campos_personalizados_grupos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conta_id UUID NOT NULL REFERENCES public.contas(id),
  nome TEXT NOT NULL,
  ordem INT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Regras de followup
CREATE TABLE IF NOT EXISTS public.followup_regras (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conta_id UUID NOT NULL REFERENCES public.contas(id),
  nome TEXT NOT NULL,
  tipo TEXT DEFAULT 'fixo',
  horas_sem_resposta INT DEFAULT 24,
  mensagem_fixa TEXT,
  prompt_followup TEXT,
  quantidade_mensagens_contexto INT,
  max_tentativas INT DEFAULT 3,
  intervalo_entre_tentativas INT DEFAULT 24,
  aplicar_ia_ativa BOOLEAN DEFAULT true,
  aplicar_ia_pausada BOOLEAN DEFAULT true,
  estagio_ids TEXT[],
  agent_ia_id UUID REFERENCES public.agent_ia(id),
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Regras de lembrete
CREATE TABLE IF NOT EXISTS public.lembrete_regras (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conta_id UUID NOT NULL REFERENCES public.contas(id),
  nome TEXT NOT NULL,
  tipo TEXT DEFAULT 'fixo',
  minutos_antes INT DEFAULT 60,
  mensagem_fixa TEXT,
  prompt_lembrete TEXT,
  incluir_detalhes BOOLEAN DEFAULT true,
  incluir_link_meet BOOLEAN DEFAULT true,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ==========================================
-- NÍVEL 3: Dependem do nível 2
-- ==========================================

-- User roles
CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, role)
);

-- Config de atendente
CREATE TABLE IF NOT EXISTS public.atendente_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID NOT NULL REFERENCES public.usuarios(id),
  ver_todas_conversas BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(usuario_id)
);

-- Estágios
CREATE TABLE IF NOT EXISTS public.estagios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  funil_id UUID NOT NULL REFERENCES public.funis(id),
  nome TEXT NOT NULL,
  ordem INT,
  cor TEXT,
  tipo TEXT,
  followup_ativo BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Etapas do agente IA
CREATE TABLE IF NOT EXISTS public.agent_ia_etapas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_ia_id UUID NOT NULL REFERENCES public.agent_ia(id),
  numero INT NOT NULL,
  nome TEXT NOT NULL,
  descricao TEXT,
  tipo TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Perguntas do agente IA
CREATE TABLE IF NOT EXISTS public.agent_ia_perguntas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_ia_id UUID NOT NULL REFERENCES public.agent_ia(id),
  pergunta TEXT NOT NULL,
  resposta TEXT NOT NULL,
  ordem INT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Config de agendamento do agente IA
CREATE TABLE IF NOT EXISTS public.agent_ia_agendamento_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_ia_id UUID NOT NULL REFERENCES public.agent_ia(id) ON DELETE CASCADE,
  google_calendar_id UUID REFERENCES public.calendarios_google(id),
  tipo_agenda TEXT DEFAULT 'interno',
  duracao_padrao INT DEFAULT 30,
  intervalo_entre_agendamentos INT DEFAULT 15,
  antecedencia_minima_horas INT DEFAULT 2,
  antecedencia_maxima_dias INT DEFAULT 30,
  horario_inicio_dia TIME DEFAULT '08:00',
  horario_fim_dia TIME DEFAULT '18:00',
  limite_por_horario INT DEFAULT 1,
  gerar_meet BOOLEAN DEFAULT false,
  nome_agendamento TEXT,
  descricao_agendamento TEXT,
  prompt_consulta_horarios TEXT,
  prompt_marcacao_horario TEXT,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(agent_ia_id)
);

-- Campos personalizados
CREATE TABLE IF NOT EXISTS public.campos_personalizados (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conta_id UUID NOT NULL REFERENCES public.contas(id),
  grupo_id UUID REFERENCES public.campos_personalizados_grupos(id),
  nome TEXT NOT NULL,
  tipo TEXT DEFAULT 'texto',
  opcoes JSONB,
  obrigatorio BOOLEAN DEFAULT false,
  ordem INT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ==========================================
-- NÍVEL 4: Dependem do nível 3
-- ==========================================

-- Horários de agendamento do agente IA
CREATE TABLE IF NOT EXISTS public.agent_ia_agendamento_horarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES public.agent_ia_agendamento_config(id) ON DELETE CASCADE,
  dia_semana INT NOT NULL,
  hora_inicio TIME NOT NULL,
  hora_fim TIME NOT NULL,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Conversas
CREATE TABLE IF NOT EXISTS public.conversas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conta_id UUID NOT NULL REFERENCES public.contas(id),
  contato_id UUID NOT NULL REFERENCES public.contatos(id),
  conexao_id UUID REFERENCES public.conexoes_whatsapp(id),
  atendente_id UUID REFERENCES public.usuarios(id),
  agente_ia_id UUID REFERENCES public.agent_ia(id),
  etapa_ia_atual UUID REFERENCES public.agent_ia_etapas(id),
  status status_conversa DEFAULT 'aguardando_cliente',
  canal TEXT,
  ultima_mensagem TEXT,
  ultima_mensagem_at TIMESTAMPTZ,
  nao_lidas INT DEFAULT 0,
  agente_ia_ativo BOOLEAN DEFAULT true,
  arquivada BOOLEAN DEFAULT false,
  memoria_limpa_em TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Negociações
CREATE TABLE IF NOT EXISTS public.negociacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conta_id UUID NOT NULL REFERENCES public.contas(id),
  contato_id UUID NOT NULL REFERENCES public.contatos(id),
  estagio_id UUID REFERENCES public.estagios(id),
  responsavel_id UUID REFERENCES public.usuarios(id),
  titulo TEXT NOT NULL,
  valor NUMERIC,
  probabilidade INT,
  notas TEXT,
  resumo_ia TEXT,
  resumo_gerado_em TIMESTAMPTZ,
  status status_negociacao DEFAULT 'aberto',
  data_fechamento TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Agendamentos
CREATE TABLE IF NOT EXISTS public.agendamentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conta_id UUID NOT NULL REFERENCES public.contas(id),
  contato_id UUID REFERENCES public.contatos(id),
  usuario_id UUID REFERENCES public.usuarios(id),
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

-- Valores dos campos personalizados dos contatos
CREATE TABLE IF NOT EXISTS public.contato_campos_valores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contato_id UUID NOT NULL REFERENCES public.contatos(id),
  campo_id UUID NOT NULL REFERENCES public.campos_personalizados(id),
  valor TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ==========================================
-- NÍVEL 5: Dependem do nível 4
-- ==========================================

-- Mensagens
CREATE TABLE IF NOT EXISTS public.mensagens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversa_id UUID NOT NULL REFERENCES public.conversas(id),
  contato_id UUID REFERENCES public.contatos(id),
  usuario_id UUID REFERENCES public.usuarios(id),
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
  deletada_por UUID REFERENCES public.usuarios(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Mensagens processadas
CREATE TABLE IF NOT EXISTS public.mensagens_processadas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conta_id UUID NOT NULL REFERENCES public.contas(id),
  telefone TEXT NOT NULL,
  evolution_msg_id TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Respostas pendentes
CREATE TABLE IF NOT EXISTS public.respostas_pendentes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversa_id UUID NOT NULL REFERENCES public.conversas(id) ON DELETE CASCADE,
  responder_em TIMESTAMPTZ NOT NULL,
  processando BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(conversa_id)
);

-- Followups enviados
CREATE TABLE IF NOT EXISTS public.followup_enviados (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversa_id UUID NOT NULL REFERENCES public.conversas(id),
  regra_id UUID NOT NULL REFERENCES public.followup_regras(id),
  tentativa INT DEFAULT 1,
  mensagem_enviada TEXT,
  respondido BOOLEAN DEFAULT false,
  respondido_em TIMESTAMPTZ,
  enviado_em TIMESTAMPTZ DEFAULT now()
);

-- Followups agendados
CREATE TABLE IF NOT EXISTS public.followups_agendados (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conta_id UUID NOT NULL,
  conversa_id UUID NOT NULL,
  contato_id UUID NOT NULL,
  agente_ia_id UUID,
  data_agendada TIMESTAMPTZ NOT NULL,
  motivo TEXT,
  contexto TEXT,
  status TEXT DEFAULT 'pendente',
  mensagem_enviada TEXT,
  enviado_em TIMESTAMPTZ,
  criado_por TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Histórico de negociação
CREATE TABLE IF NOT EXISTS public.negociacao_historico (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  negociacao_id UUID NOT NULL REFERENCES public.negociacoes(id),
  usuario_id UUID REFERENCES public.usuarios(id),
  tipo TEXT DEFAULT 'movimentacao',
  estagio_anterior_id UUID REFERENCES public.estagios(id),
  estagio_novo_id UUID REFERENCES public.estagios(id),
  descricao TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Notas de negociação
CREATE TABLE IF NOT EXISTS public.negociacao_notas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  negociacao_id UUID NOT NULL REFERENCES public.negociacoes(id),
  usuario_id UUID REFERENCES public.usuarios(id),
  conteudo TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Lembretes enviados
CREATE TABLE IF NOT EXISTS public.lembrete_enviados (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  regra_id UUID NOT NULL REFERENCES public.lembrete_regras(id),
  agendamento_id UUID NOT NULL REFERENCES public.agendamentos(id),
  contato_id UUID REFERENCES public.contatos(id),
  mensagem_enviada TEXT,
  enviado_em TIMESTAMPTZ DEFAULT now()
);

-- Transferências de atendimento
CREATE TABLE IF NOT EXISTS public.transferencias_atendimento (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversa_id UUID NOT NULL REFERENCES public.conversas(id),
  de_usuario_id UUID REFERENCES public.usuarios(id),
  para_usuario_id UUID REFERENCES public.usuarios(id),
  para_agente_ia BOOLEAN DEFAULT false,
  motivo TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Notificações
CREATE TABLE IF NOT EXISTS public.notificacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conta_id UUID NOT NULL REFERENCES public.contas(id),
  usuario_id UUID REFERENCES public.usuarios(id),
  tipo TEXT DEFAULT 'info',
  titulo TEXT NOT NULL,
  mensagem TEXT,
  link TEXT,
  metadata JSONB,
  lida BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Logs de atividade
CREATE TABLE IF NOT EXISTS public.logs_atividade (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conta_id UUID NOT NULL REFERENCES public.contas(id),
  usuario_id UUID REFERENCES public.usuarios(id),
  tipo TEXT NOT NULL,
  descricao TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Uso de tokens
CREATE TABLE IF NOT EXISTS public.uso_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conta_id UUID NOT NULL REFERENCES public.contas(id),
  conversa_id UUID REFERENCES public.conversas(id),
  provider TEXT NOT NULL,
  modelo TEXT NOT NULL,
  prompt_tokens INT DEFAULT 0,
  completion_tokens INT DEFAULT 0,
  total_tokens INT DEFAULT 0,
  custo_estimado NUMERIC,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ==========================================
-- ÍNDICES
-- ==========================================
CREATE INDEX IF NOT EXISTS idx_usuarios_conta_id ON public.usuarios(conta_id);
CREATE INDEX IF NOT EXISTS idx_usuarios_user_id ON public.usuarios(user_id);
CREATE INDEX IF NOT EXISTS idx_contatos_conta_id ON public.contatos(conta_id);
CREATE INDEX IF NOT EXISTS idx_contatos_telefone ON public.contatos(telefone);
CREATE INDEX IF NOT EXISTS idx_conexoes_conta_id ON public.conexoes_whatsapp(conta_id);
CREATE INDEX IF NOT EXISTS idx_conversas_conta_id ON public.conversas(conta_id);
CREATE INDEX IF NOT EXISTS idx_conversas_contato_id ON public.conversas(contato_id);
CREATE INDEX IF NOT EXISTS idx_conversas_conexao_id ON public.conversas(conexao_id);
CREATE INDEX IF NOT EXISTS idx_mensagens_conversa_id ON public.mensagens(conversa_id);
CREATE INDEX IF NOT EXISTS idx_mensagens_created_at ON public.mensagens(created_at);
CREATE INDEX IF NOT EXISTS idx_negociacoes_conta_id ON public.negociacoes(conta_id);
CREATE INDEX IF NOT EXISTS idx_negociacoes_contato_id ON public.negociacoes(contato_id);
CREATE INDEX IF NOT EXISTS idx_negociacoes_estagio_id ON public.negociacoes(estagio_id);
CREATE INDEX IF NOT EXISTS idx_agendamentos_conta_id ON public.agendamentos(conta_id);
CREATE INDEX IF NOT EXISTS idx_agendamentos_data ON public.agendamentos(data_inicio);
CREATE INDEX IF NOT EXISTS idx_mensagens_processadas_msg ON public.mensagens_processadas(evolution_msg_id);
CREATE INDEX IF NOT EXISTS idx_respostas_pendentes_em ON public.respostas_pendentes(responder_em);

-- ==========================================
-- TRIGGERS PARA updated_at
-- ==========================================
DROP TRIGGER IF EXISTS update_planos_updated_at ON public.planos;
CREATE TRIGGER update_planos_updated_at BEFORE UPDATE ON public.planos FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_contas_updated_at ON public.contas;
CREATE TRIGGER update_contas_updated_at BEFORE UPDATE ON public.contas FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_usuarios_updated_at ON public.usuarios;
CREATE TRIGGER update_usuarios_updated_at BEFORE UPDATE ON public.usuarios FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_contatos_updated_at ON public.contatos;
CREATE TRIGGER update_contatos_updated_at BEFORE UPDATE ON public.contatos FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_conexoes_updated_at ON public.conexoes_whatsapp;
CREATE TRIGGER update_conexoes_updated_at BEFORE UPDATE ON public.conexoes_whatsapp FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_conversas_updated_at ON public.conversas;
CREATE TRIGGER update_conversas_updated_at BEFORE UPDATE ON public.conversas FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_negociacoes_updated_at ON public.negociacoes;
CREATE TRIGGER update_negociacoes_updated_at BEFORE UPDATE ON public.negociacoes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_agendamentos_updated_at ON public.agendamentos;
CREATE TRIGGER update_agendamentos_updated_at BEFORE UPDATE ON public.agendamentos FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_funis_updated_at ON public.funis;
CREATE TRIGGER update_funis_updated_at BEFORE UPDATE ON public.funis FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_estagios_updated_at ON public.estagios;
CREATE TRIGGER update_estagios_updated_at BEFORE UPDATE ON public.estagios FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_agent_ia_updated_at ON public.agent_ia;
CREATE TRIGGER update_agent_ia_updated_at BEFORE UPDATE ON public.agent_ia FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_sync_log_updated_at ON public.sync_log;
CREATE TRIGGER update_sync_log_updated_at BEFORE UPDATE ON public.sync_log FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ==========================================
-- HABILITAR REALTIME PARA TABELAS PRINCIPAIS
-- ==========================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.mensagens;
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversas;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notificacoes;

SELECT 'Schema criado com sucesso!' as resultado;
`;

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🚀 Iniciando setup do banco de dados externo...');

    // Obter credenciais do Supabase externo
    const externalUrl = Deno.env.get('EXTERNAL_STORAGE_URL');
    const externalServiceKey = Deno.env.get('EXTERNAL_STORAGE_KEY');

    if (!externalUrl || !externalServiceKey) {
      throw new Error('Credenciais do Supabase externo não configuradas. Configure EXTERNAL_STORAGE_URL e EXTERNAL_STORAGE_KEY');
    }

    console.log('📡 Conectando ao Supabase externo:', externalUrl);

    // Criar cliente do Supabase externo
    const externalSupabase = createClient(externalUrl, externalServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Executar o SQL usando a função rpc
    // Como não podemos executar SQL diretamente, vamos criar as tabelas uma por uma
    // usando a API REST do Supabase

    // Primeiro, vamos verificar se já existe alguma tabela
    const { data: existingTables, error: checkError } = await externalSupabase
      .from('planos')
      .select('id')
      .limit(1);

    let schemasExists = false;
    if (!checkError) {
      schemasExists = true;
      console.log('✅ Tabelas já existem no banco externo');
    }

    // Se as tabelas não existem, precisamos executar o SQL
    // Como não temos acesso direto ao SQL, vamos usar uma abordagem diferente
    // Vamos retornar o SQL para o usuário executar manualmente

    if (!schemasExists) {
      console.log('⚠️ Tabelas não encontradas. O SQL precisa ser executado manualmente.');
      
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Tabelas não encontradas no banco externo. Por favor, execute o SQL manualmente no Supabase Dashboard.',
          sql: SCHEMA_SQL,
          instructions: [
            '1. Acesse o Supabase Dashboard do seu projeto externo',
            '2. Vá em SQL Editor',
            '3. Cole e execute o SQL fornecido',
            '4. Execute esta função novamente para verificar'
          ]
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      );
    }

    // Se chegou aqui, as tabelas existem
    // Vamos verificar quantas tabelas temos
    const tablesToCheck = [
      'planos', 'contas', 'usuarios', 'contatos', 'conexoes_whatsapp',
      'conversas', 'mensagens', 'funis', 'estagios', 'negociacoes',
      'agendamentos', 'agent_ia', 'tags', 'notificacoes'
    ];

    const tableStatus: Record<string, boolean> = {};
    
    for (const table of tablesToCheck) {
      const { error } = await externalSupabase
        .from(table)
        .select('id')
        .limit(1);
      
      tableStatus[table] = !error;
    }

    const existingCount = Object.values(tableStatus).filter(Boolean).length;

    console.log(`✅ Schema verificado: ${existingCount}/${tablesToCheck.length} tabelas encontradas`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Schema verificado com sucesso! ${existingCount} tabelas encontradas.`,
        tables: tableStatus,
        externalUrl
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    console.error('❌ Erro no setup:', errorMessage);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
        sql: SCHEMA_SQL
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});
