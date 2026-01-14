import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Copy, Check, Play, Database, ArrowRight, Loader2 } from "lucide-react";
import AdminLayout from "@/components/admin/AdminLayout";

const SCHEMA_SQL = `-- ==========================================
-- ZAPCRM - SCHEMA COMPLETO PARA SUPABASE EXTERNO
-- Execute este SQL no SQL Editor do seu Supabase
-- ==========================================

-- ENUMS
DO $$ BEGIN CREATE TYPE app_role AS ENUM ('admin', 'atendente', 'super_admin'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE direcao_mensagem AS ENUM ('entrada', 'saida'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE status_conexao AS ENUM ('conectado', 'desconectado', 'aguardando'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE status_conversa AS ENUM ('em_atendimento', 'aguardando_cliente', 'encerrado'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE status_negociacao AS ENUM ('aberto', 'ganho', 'perdido'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE tipo_mensagem AS ENUM ('texto', 'imagem', 'audio', 'video', 'documento', 'sticker', 'sistema'); EXCEPTION WHEN duplicate_object THEN null; END $$;

-- FUNÇÃO AUXILIAR
CREATE OR REPLACE FUNCTION public.update_updated_at_column() RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql;

-- NÍVEL 0: Tabelas sem dependências
CREATE TABLE IF NOT EXISTS public.sync_log (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), tabela TEXT UNIQUE NOT NULL, ultimo_sync TIMESTAMPTZ, registros_sync INT DEFAULT 0, created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE IF NOT EXISTS public.planos (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), nome TEXT NOT NULL, descricao TEXT, preco_mensal NUMERIC, limite_usuarios INT DEFAULT 1, limite_conexoes_whatsapp INT DEFAULT 1, limite_conexoes_evolution INT DEFAULT 1, limite_conexoes_meta INT DEFAULT 0, limite_agentes INT DEFAULT 1, limite_funis INT DEFAULT 1, limite_mensagens_mes INT DEFAULT 1000, permite_instagram BOOLEAN DEFAULT false, ativo BOOLEAN DEFAULT true, created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE IF NOT EXISTS public.configuracoes_plataforma (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), chave TEXT UNIQUE NOT NULL, valor TEXT, descricao TEXT, created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now());

-- NÍVEL 1
CREATE TABLE IF NOT EXISTS public.contas (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), nome TEXT NOT NULL, whatsapp TEXT, cpf TEXT, openai_api_key TEXT, ativo BOOLEAN DEFAULT true, plano_id UUID REFERENCES public.planos(id), permitir_multiplas_negociacoes BOOLEAN DEFAULT false, reabrir_com_ia BOOLEAN DEFAULT false, stripe_customer_id TEXT, stripe_subscription_id TEXT, stripe_subscription_status TEXT, stripe_current_period_start TIMESTAMPTZ, stripe_current_period_end TIMESTAMPTZ, stripe_cancel_at_period_end BOOLEAN DEFAULT false, created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now());

-- NÍVEL 2
CREATE TABLE IF NOT EXISTS public.usuarios (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID NOT NULL, conta_id UUID NOT NULL REFERENCES public.contas(id), nome TEXT NOT NULL, email TEXT NOT NULL, avatar_url TEXT, is_admin BOOLEAN DEFAULT false, assinatura_ativa BOOLEAN DEFAULT true, created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE IF NOT EXISTS public.contatos (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), conta_id UUID NOT NULL REFERENCES public.contas(id), nome TEXT NOT NULL, telefone TEXT NOT NULL, email TEXT, avatar_url TEXT, tags TEXT[], canal TEXT, is_grupo BOOLEAN DEFAULT false, grupo_jid TEXT, metadata JSONB, created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE IF NOT EXISTS public.conexoes_whatsapp (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), conta_id UUID NOT NULL REFERENCES public.contas(id), nome TEXT DEFAULT 'WhatsApp', instance_name TEXT NOT NULL, token TEXT NOT NULL, numero TEXT, qrcode TEXT, status status_conexao DEFAULT 'desconectado', webhook_url TEXT, tipo_provedor TEXT, tipo_canal TEXT, meta_access_token TEXT, meta_phone_number_id TEXT, meta_business_account_id TEXT, meta_webhook_verify_token TEXT, created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE IF NOT EXISTS public.funis (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), conta_id UUID NOT NULL REFERENCES public.contas(id), nome TEXT NOT NULL, descricao TEXT, cor TEXT, ordem INT, created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE IF NOT EXISTS public.agent_ia (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), conta_id UUID NOT NULL REFERENCES public.contas(id), nome TEXT, descricao TEXT, tipo TEXT, gatilho TEXT, prompt_sistema TEXT, modelo TEXT, temperatura NUMERIC, max_tokens INT, ativo BOOLEAN DEFAULT true, atender_24h BOOLEAN DEFAULT false, horario_inicio TIME, horario_fim TIME, dias_ativos INT[], mensagem_fora_horario TEXT, tempo_espera_segundos INT DEFAULT 30, simular_digitacao BOOLEAN DEFAULT true, fracionar_mensagens BOOLEAN DEFAULT false, tamanho_max_fracao INT, delay_entre_fracoes INT, quantidade_mensagens_contexto INT DEFAULT 10, created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE IF NOT EXISTS public.tags (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), conta_id UUID NOT NULL REFERENCES public.contas(id), nome TEXT NOT NULL, cor TEXT DEFAULT '#3B82F6', created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE IF NOT EXISTS public.calendarios_google (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), conta_id UUID NOT NULL REFERENCES public.contas(id), nome TEXT NOT NULL, email_google TEXT NOT NULL, calendar_id TEXT, access_token TEXT, refresh_token TEXT, token_expiry TIMESTAMPTZ, cor TEXT, ativo BOOLEAN DEFAULT true, created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE IF NOT EXISTS public.campos_personalizados_grupos (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), conta_id UUID NOT NULL REFERENCES public.contas(id), nome TEXT NOT NULL, ordem INT, created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE IF NOT EXISTS public.followup_regras (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), conta_id UUID NOT NULL REFERENCES public.contas(id), nome TEXT NOT NULL, tipo TEXT DEFAULT 'fixo', horas_sem_resposta INT DEFAULT 24, mensagem_fixa TEXT, prompt_followup TEXT, quantidade_mensagens_contexto INT, max_tentativas INT DEFAULT 3, intervalo_entre_tentativas INT DEFAULT 24, aplicar_ia_ativa BOOLEAN DEFAULT true, aplicar_ia_pausada BOOLEAN DEFAULT true, estagio_ids TEXT[], agent_ia_id UUID REFERENCES public.agent_ia(id), ativo BOOLEAN DEFAULT true, created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE IF NOT EXISTS public.lembrete_regras (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), conta_id UUID NOT NULL REFERENCES public.contas(id), nome TEXT NOT NULL, tipo TEXT DEFAULT 'fixo', minutos_antes INT DEFAULT 60, mensagem_fixa TEXT, prompt_lembrete TEXT, incluir_detalhes BOOLEAN DEFAULT true, incluir_link_meet BOOLEAN DEFAULT true, ativo BOOLEAN DEFAULT true, created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now());

-- NÍVEL 3
CREATE TABLE IF NOT EXISTS public.user_roles (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID NOT NULL, role app_role NOT NULL, created_at TIMESTAMPTZ DEFAULT now(), UNIQUE(user_id, role));
CREATE TABLE IF NOT EXISTS public.atendente_config (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), usuario_id UUID NOT NULL REFERENCES public.usuarios(id), ver_todas_conversas BOOLEAN DEFAULT false, created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now(), UNIQUE(usuario_id));
CREATE TABLE IF NOT EXISTS public.estagios (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), funil_id UUID NOT NULL REFERENCES public.funis(id), nome TEXT NOT NULL, ordem INT, cor TEXT, tipo TEXT, followup_ativo BOOLEAN DEFAULT false, created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE IF NOT EXISTS public.agent_ia_etapas (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), agent_ia_id UUID NOT NULL REFERENCES public.agent_ia(id), numero INT NOT NULL, nome TEXT NOT NULL, descricao TEXT, tipo TEXT, created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE IF NOT EXISTS public.agent_ia_perguntas (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), agent_ia_id UUID NOT NULL REFERENCES public.agent_ia(id), pergunta TEXT NOT NULL, resposta TEXT NOT NULL, ordem INT, created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE IF NOT EXISTS public.agent_ia_agendamento_config (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), agent_ia_id UUID NOT NULL REFERENCES public.agent_ia(id) ON DELETE CASCADE, google_calendar_id UUID REFERENCES public.calendarios_google(id), tipo_agenda TEXT DEFAULT 'interno', duracao_padrao INT DEFAULT 30, intervalo_entre_agendamentos INT DEFAULT 15, antecedencia_minima_horas INT DEFAULT 2, antecedencia_maxima_dias INT DEFAULT 30, horario_inicio_dia TIME DEFAULT '08:00', horario_fim_dia TIME DEFAULT '18:00', limite_por_horario INT DEFAULT 1, gerar_meet BOOLEAN DEFAULT false, nome_agendamento TEXT, descricao_agendamento TEXT, prompt_consulta_horarios TEXT, prompt_marcacao_horario TEXT, ativo BOOLEAN DEFAULT true, created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now(), UNIQUE(agent_ia_id));
CREATE TABLE IF NOT EXISTS public.campos_personalizados (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), conta_id UUID NOT NULL REFERENCES public.contas(id), grupo_id UUID REFERENCES public.campos_personalizados_grupos(id), nome TEXT NOT NULL, tipo TEXT DEFAULT 'texto', opcoes JSONB, obrigatorio BOOLEAN DEFAULT false, ordem INT, created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now());

-- NÍVEL 4
CREATE TABLE IF NOT EXISTS public.agent_ia_agendamento_horarios (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), config_id UUID NOT NULL REFERENCES public.agent_ia_agendamento_config(id) ON DELETE CASCADE, dia_semana INT NOT NULL, hora_inicio TIME NOT NULL, hora_fim TIME NOT NULL, ativo BOOLEAN DEFAULT true, created_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE IF NOT EXISTS public.conversas (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), conta_id UUID NOT NULL REFERENCES public.contas(id), contato_id UUID NOT NULL REFERENCES public.contatos(id), conexao_id UUID REFERENCES public.conexoes_whatsapp(id), atendente_id UUID REFERENCES public.usuarios(id), agente_ia_id UUID REFERENCES public.agent_ia(id), etapa_ia_atual UUID REFERENCES public.agent_ia_etapas(id), status status_conversa DEFAULT 'aguardando_cliente', canal TEXT, ultima_mensagem TEXT, ultima_mensagem_at TIMESTAMPTZ, nao_lidas INT DEFAULT 0, agente_ia_ativo BOOLEAN DEFAULT true, arquivada BOOLEAN DEFAULT false, memoria_limpa_em TIMESTAMPTZ, created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE IF NOT EXISTS public.negociacoes (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), conta_id UUID NOT NULL REFERENCES public.contas(id), contato_id UUID NOT NULL REFERENCES public.contatos(id), estagio_id UUID REFERENCES public.estagios(id), responsavel_id UUID REFERENCES public.usuarios(id), titulo TEXT NOT NULL, valor NUMERIC, probabilidade INT, notas TEXT, resumo_ia TEXT, resumo_gerado_em TIMESTAMPTZ, status status_negociacao DEFAULT 'aberto', data_fechamento TIMESTAMPTZ, created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE IF NOT EXISTS public.agendamentos (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), conta_id UUID NOT NULL REFERENCES public.contas(id), contato_id UUID REFERENCES public.contatos(id), usuario_id UUID REFERENCES public.usuarios(id), titulo TEXT NOT NULL, descricao TEXT, data_inicio TIMESTAMPTZ NOT NULL, data_fim TIMESTAMPTZ, google_event_id TEXT, google_meet_link TEXT, concluido BOOLEAN DEFAULT false, created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE IF NOT EXISTS public.contato_campos_valores (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), contato_id UUID NOT NULL REFERENCES public.contatos(id), campo_id UUID NOT NULL REFERENCES public.campos_personalizados(id), valor TEXT, created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now());

-- NÍVEL 5
CREATE TABLE IF NOT EXISTS public.mensagens (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), conversa_id UUID NOT NULL REFERENCES public.conversas(id), contato_id UUID REFERENCES public.contatos(id), usuario_id UUID REFERENCES public.usuarios(id), conteudo TEXT NOT NULL, tipo tipo_mensagem DEFAULT 'texto', direcao direcao_mensagem NOT NULL, media_url TEXT, metadata JSONB, lida BOOLEAN DEFAULT false, enviada_por_ia BOOLEAN DEFAULT false, enviada_por_dispositivo BOOLEAN DEFAULT false, deletada BOOLEAN DEFAULT false, deletada_em TIMESTAMPTZ, deletada_por UUID REFERENCES public.usuarios(id), created_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE IF NOT EXISTS public.mensagens_processadas (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), conta_id UUID NOT NULL REFERENCES public.contas(id), telefone TEXT NOT NULL, evolution_msg_id TEXT NOT NULL, created_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE IF NOT EXISTS public.respostas_pendentes (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), conversa_id UUID NOT NULL REFERENCES public.conversas(id) ON DELETE CASCADE, responder_em TIMESTAMPTZ NOT NULL, processando BOOLEAN DEFAULT false, created_at TIMESTAMPTZ DEFAULT now(), UNIQUE(conversa_id));
CREATE TABLE IF NOT EXISTS public.followup_enviados (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), conversa_id UUID NOT NULL REFERENCES public.conversas(id), regra_id UUID NOT NULL REFERENCES public.followup_regras(id), tentativa INT DEFAULT 1, mensagem_enviada TEXT, respondido BOOLEAN DEFAULT false, respondido_em TIMESTAMPTZ, enviado_em TIMESTAMPTZ DEFAULT now());
CREATE TABLE IF NOT EXISTS public.followups_agendados (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), conta_id UUID NOT NULL, conversa_id UUID NOT NULL, contato_id UUID NOT NULL, agente_ia_id UUID, data_agendada TIMESTAMPTZ NOT NULL, motivo TEXT, contexto TEXT, status TEXT DEFAULT 'pendente', mensagem_enviada TEXT, enviado_em TIMESTAMPTZ, criado_por TEXT, created_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE IF NOT EXISTS public.negociacao_historico (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), negociacao_id UUID NOT NULL REFERENCES public.negociacoes(id), usuario_id UUID REFERENCES public.usuarios(id), tipo TEXT DEFAULT 'movimentacao', estagio_anterior_id UUID REFERENCES public.estagios(id), estagio_novo_id UUID REFERENCES public.estagios(id), descricao TEXT, created_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE IF NOT EXISTS public.negociacao_notas (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), negociacao_id UUID NOT NULL REFERENCES public.negociacoes(id), usuario_id UUID REFERENCES public.usuarios(id), conteudo TEXT NOT NULL, created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE IF NOT EXISTS public.lembrete_enviados (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), regra_id UUID NOT NULL REFERENCES public.lembrete_regras(id), agendamento_id UUID NOT NULL REFERENCES public.agendamentos(id), contato_id UUID REFERENCES public.contatos(id), mensagem_enviada TEXT, enviado_em TIMESTAMPTZ DEFAULT now());
CREATE TABLE IF NOT EXISTS public.transferencias_atendimento (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), conversa_id UUID NOT NULL REFERENCES public.conversas(id), de_usuario_id UUID REFERENCES public.usuarios(id), para_usuario_id UUID REFERENCES public.usuarios(id), para_agente_ia BOOLEAN DEFAULT false, motivo TEXT, created_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE IF NOT EXISTS public.notificacoes (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), conta_id UUID NOT NULL REFERENCES public.contas(id), usuario_id UUID REFERENCES public.usuarios(id), tipo TEXT DEFAULT 'info', titulo TEXT NOT NULL, mensagem TEXT, link TEXT, metadata JSONB, lida BOOLEAN DEFAULT false, created_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE IF NOT EXISTS public.logs_atividade (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), conta_id UUID NOT NULL REFERENCES public.contas(id), usuario_id UUID REFERENCES public.usuarios(id), tipo TEXT NOT NULL, descricao TEXT, metadata JSONB, created_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE IF NOT EXISTS public.uso_tokens (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), conta_id UUID NOT NULL REFERENCES public.contas(id), conversa_id UUID REFERENCES public.conversas(id), provider TEXT NOT NULL, modelo TEXT NOT NULL, prompt_tokens INT DEFAULT 0, completion_tokens INT DEFAULT 0, total_tokens INT DEFAULT 0, custo_estimado NUMERIC, created_at TIMESTAMPTZ DEFAULT now());

-- ÍNDICES
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

-- TRIGGERS
DROP TRIGGER IF EXISTS update_planos_updated_at ON public.planos; CREATE TRIGGER update_planos_updated_at BEFORE UPDATE ON public.planos FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS update_contas_updated_at ON public.contas; CREATE TRIGGER update_contas_updated_at BEFORE UPDATE ON public.contas FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS update_usuarios_updated_at ON public.usuarios; CREATE TRIGGER update_usuarios_updated_at BEFORE UPDATE ON public.usuarios FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS update_contatos_updated_at ON public.contatos; CREATE TRIGGER update_contatos_updated_at BEFORE UPDATE ON public.contatos FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS update_conexoes_updated_at ON public.conexoes_whatsapp; CREATE TRIGGER update_conexoes_updated_at BEFORE UPDATE ON public.conexoes_whatsapp FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS update_conversas_updated_at ON public.conversas; CREATE TRIGGER update_conversas_updated_at BEFORE UPDATE ON public.conversas FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS update_negociacoes_updated_at ON public.negociacoes; CREATE TRIGGER update_negociacoes_updated_at BEFORE UPDATE ON public.negociacoes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS update_agendamentos_updated_at ON public.agendamentos; CREATE TRIGGER update_agendamentos_updated_at BEFORE UPDATE ON public.agendamentos FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS update_funis_updated_at ON public.funis; CREATE TRIGGER update_funis_updated_at BEFORE UPDATE ON public.funis FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS update_estagios_updated_at ON public.estagios; CREATE TRIGGER update_estagios_updated_at BEFORE UPDATE ON public.estagios FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS update_agent_ia_updated_at ON public.agent_ia; CREATE TRIGGER update_agent_ia_updated_at BEFORE UPDATE ON public.agent_ia FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS update_sync_log_updated_at ON public.sync_log; CREATE TRIGGER update_sync_log_updated_at BEFORE UPDATE ON public.sync_log FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- REALTIME
ALTER PUBLICATION supabase_realtime ADD TABLE public.mensagens;
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversas;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notificacoes;

SELECT 'Schema criado com sucesso!' as resultado;
`;

export default function MigracaoExterna() {
  const [copied, setCopied] = useState(false);
  const [step, setStep] = useState(1);
  const [migrating, setMigrating] = useState(false);
  const [migrationResult, setMigrationResult] = useState<any>(null);

  const copyToClipboard = async () => {
    await navigator.clipboard.writeText(SCHEMA_SQL);
    setCopied(true);
    toast.success("SQL copiado para a área de transferência!");
    setTimeout(() => setCopied(false), 3000);
  };

  const runMigration = async () => {
    setMigrating(true);
    try {
      const { data, error } = await supabase.functions.invoke('migrate-to-external', {
        body: {}
      });
      
      if (error) throw error;
      
      setMigrationResult(data);
      if (data.success) {
        toast.success(`Migração concluída! ${data.summary?.totalRecords || 0} registros migrados.`);
        setStep(3);
      } else {
        toast.error("Migração concluída com erros. Verifique os detalhes.");
      }
    } catch (error: any) {
      toast.error("Erro na migração: " + error.message);
      setMigrationResult({ success: false, error: error.message });
    } finally {
      setMigrating(false);
    }
  };

  return (
    <AdminLayout>
      <div className="p-6 max-w-4xl mx-auto space-y-6">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">Migração para Supabase Externo</h1>
          <p className="text-muted-foreground">
            Siga os passos abaixo para migrar todos os dados para seu Supabase externo
          </p>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center justify-center gap-4 mb-8">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                step >= s ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
              }`}>
                {step > s ? <Check className="w-5 h-5" /> : s}
              </div>
              {s < 3 && (
                <ArrowRight className={`w-6 h-6 mx-2 ${step > s ? 'text-primary' : 'text-muted-foreground'}`} />
              )}
            </div>
          ))}
        </div>

        {/* Step 1: Copy SQL */}
        <Card className={step === 1 ? 'ring-2 ring-primary' : ''}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="w-5 h-5" />
              Passo 1: Criar Tabelas no Supabase Externo
            </CardTitle>
            <CardDescription>
              Copie o SQL abaixo e execute no SQL Editor do seu Supabase externo
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative">
              <pre className="bg-muted p-4 rounded-lg text-sm max-h-64 overflow-y-auto font-mono">
                {SCHEMA_SQL.substring(0, 2000)}...
              </pre>
              <Button 
                onClick={copyToClipboard}
                className="absolute top-2 right-2"
                variant="secondary"
                size="sm"
              >
                {copied ? <Check className="w-4 h-4 mr-1" /> : <Copy className="w-4 h-4 mr-1" />}
                {copied ? 'Copiado!' : 'Copiar SQL'}
              </Button>
            </div>
            
            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4">
              <h4 className="font-semibold text-yellow-600 mb-2">⚠️ Instruções:</h4>
              <ol className="list-decimal list-inside space-y-1 text-sm">
                <li>Acesse o dashboard do seu Supabase externo</li>
                <li>Vá em <strong>SQL Editor</strong></li>
                <li>Cole o SQL copiado</li>
                <li>Clique em <strong>Run</strong></li>
                <li>Aguarde a mensagem "Schema criado com sucesso!"</li>
              </ol>
            </div>

            <Button 
              onClick={() => setStep(2)} 
              className="w-full"
              disabled={step !== 1}
            >
              Já executei o SQL, próximo passo
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </CardContent>
        </Card>

        {/* Step 2: Run Migration */}
        <Card className={step === 2 ? 'ring-2 ring-primary' : ''}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Play className="w-5 h-5" />
              Passo 2: Migrar Dados
            </CardTitle>
            <CardDescription>
              Migrar todos os dados do Lovable Cloud para seu Supabase externo
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
              <p className="text-sm">
                Este processo irá copiar <strong>todos os dados</strong> (planos, contas, usuários, 
                contatos, conversas, mensagens, etc.) para o seu banco de dados externo.
              </p>
            </div>

            <Button 
              onClick={runMigration}
              className="w-full"
              disabled={step !== 2 || migrating}
            >
              {migrating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Migrando dados...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 mr-2" />
                  Iniciar Migração
                </>
              )}
            </Button>

            {migrationResult && (
              <div className={`p-4 rounded-lg ${
                migrationResult.success 
                  ? 'bg-green-500/10 border border-green-500/20' 
                  : 'bg-red-500/10 border border-red-500/20'
              }`}>
                <h4 className="font-semibold mb-2">
                  {migrationResult.success ? '✅ Migração concluída!' : '❌ Erro na migração'}
                </h4>
                {migrationResult.summary && (
                  <div className="text-sm space-y-1">
                    <p>Tabelas com sucesso: {migrationResult.summary.tablesSuccess}</p>
                    <p>Tabelas com erro: {migrationResult.summary.tablesError}</p>
                    <p>Total de registros: {migrationResult.summary.totalRecords}</p>
                  </div>
                )}
                {migrationResult.error && (
                  <p className="text-sm text-red-600">{migrationResult.error}</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Step 3: Complete */}
        <Card className={step === 3 ? 'ring-2 ring-primary' : ''}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Check className="w-5 h-5" />
              Passo 3: Concluído!
            </CardTitle>
            <CardDescription>
              Seus dados foram migrados com sucesso
            </CardDescription>
          </CardHeader>
          <CardContent>
            {step === 3 ? (
              <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-6 text-center">
                <Check className="w-16 h-16 mx-auto text-green-600 mb-4" />
                <h3 className="text-xl font-bold text-green-600 mb-2">
                  Migração Concluída com Sucesso!
                </h3>
                <p className="text-muted-foreground">
                  Todos os dados foram migrados para seu Supabase externo.
                  As Edge Functions continuarão usando o banco externo automaticamente.
                </p>
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-8">
                Complete os passos anteriores para finalizar a migração.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
