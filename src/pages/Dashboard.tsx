import { useEffect, useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import {
  TrendingUp,
  Users,
  MessageSquare,
  DollarSign,
  Plug,
  PlugZap,
  ArrowUpRight,
  ArrowDownRight,
  Sparkles,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useIsMobile } from '@/hooks/use-mobile';
import { useOnboarding } from '@/contexts/OnboardingContext';
import { OnboardingProgress } from '@/components/onboarding/OnboardingProgress';
import { EscolhaConexaoModal } from '@/components/onboarding/EscolhaConexaoModal';
import { Button } from '@/components/ui/button';

interface DashboardStats {
  totalNegociacoes: number;
  valorTotal: number;
  totalContatos: number;
  totalMensagens: number;
  conexaoStatus: 'conectado' | 'desconectado' | 'aguardando';
  openaiConfigurado: boolean;
  agenteConfigurado: boolean;
}

export default function Dashboard() {
  const { usuario } = useAuth();
  const isMobile = useIsMobile();
  const { isOnboardingActive, currentStep, startOnboarding } = useOnboarding();
  const [showEscolhaConexao, setShowEscolhaConexao] = useState(false);
  const [stats, setStats] = useState<DashboardStats>({
    totalNegociacoes: 0,
    valorTotal: 0,
    totalContatos: 0,
    totalMensagens: 0,
    conexaoStatus: 'desconectado',
    openaiConfigurado: false,
    agenteConfigurado: false,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (usuario?.conta_id) {
      fetchStats();
    }
  }, [usuario]);

  // Abrir modal de escolha quando onboarding inicia
  useEffect(() => {
    if (isOnboardingActive && currentStep === 'escolha_conexao') {
      setShowEscolhaConexao(true);
    }
  }, [isOnboardingActive, currentStep]);

  const fetchStats = async () => {
    try {
      const [negociacoes, contatos, mensagens, conexao, conta, agentes] = await Promise.all([
        supabase.from('negociacoes').select('valor').eq('conta_id', usuario!.conta_id),
        supabase.from('contatos').select('id', { count: 'exact' }).eq('conta_id', usuario!.conta_id),
        supabase.from('mensagens').select('id', { count: 'exact' }),
        supabase.from('conexoes_whatsapp').select('status').eq('conta_id', usuario!.conta_id).maybeSingle(),
        supabase.from('contas').select('openai_api_key').eq('id', usuario!.conta_id).single(),
        supabase.from('agent_ia').select('id, prompt_sistema').eq('conta_id', usuario!.conta_id),
      ]);

      const temAgente = agentes.data && agentes.data.length > 0 && 
        agentes.data.some(a => a.prompt_sistema && a.prompt_sistema.length > 50);

      setStats({
        totalNegociacoes: negociacoes.data?.length || 0,
        valorTotal: negociacoes.data?.reduce((acc, n) => acc + Number(n.valor || 0), 0) || 0,
        totalContatos: contatos.count || 0,
        totalMensagens: mensagens.count || 0,
        conexaoStatus: (conexao.data?.status as any) || 'desconectado',
        openaiConfigurado: !!conta.data?.openai_api_key,
        agenteConfigurado: temAgente,
      });
    } catch (error) {
      console.error('Erro ao buscar stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const handleStartTutorial = () => {
    startOnboarding();
    setShowEscolhaConexao(true);
  };

  const cards = [
    {
      title: 'Negociações Ativas',
      value: stats.totalNegociacoes,
      change: '+12%',
      trend: 'up',
      icon: TrendingUp,
      color: 'text-primary',
      bgColor: 'bg-primary/10',
    },
    {
      title: 'Valor em Pipeline',
      value: formatCurrency(stats.valorTotal),
      change: '+8.5%',
      trend: 'up',
      icon: DollarSign,
      color: 'text-success',
      bgColor: 'bg-success/10',
    },
    {
      title: 'Total de Contatos',
      value: stats.totalContatos,
      change: '+24%',
      trend: 'up',
      icon: Users,
      color: 'text-info',
      bgColor: 'bg-info/10',
    },
    {
      title: 'Mensagens Hoje',
      value: stats.totalMensagens,
      change: '-3%',
      trend: 'down',
      icon: MessageSquare,
      color: 'text-warning',
      bgColor: 'bg-warning/10',
    },
  ];

  // Verificar se é um novo usuário (nenhuma config feita)
  const isNewUser = stats.conexaoStatus === 'desconectado' && 
    !stats.openaiConfigurado && 
    !stats.agenteConfigurado;

  return (
    <MainLayout>
      <div className="space-y-6 md:space-y-8 animate-fade-in px-4 md:px-0">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground">Dashboard</h1>
            <p className="text-sm md:text-base text-muted-foreground mt-1">
              Bem-vindo, {usuario?.nome?.split(' ')[0]}!
            </p>
          </div>
          {!isOnboardingActive && isNewUser && (
            <Button onClick={handleStartTutorial} className="gap-2">
              <Sparkles className="h-4 w-4" />
              <span className="hidden sm:inline">Iniciar Tutorial</span>
            </Button>
          )}
        </div>

        {/* Onboarding Progress Card */}
        {!loading && (stats.conexaoStatus !== 'conectado' || !stats.openaiConfigurado || !stats.agenteConfigurado) && (
          <OnboardingProgress 
            conexaoStatus={stats.conexaoStatus === 'conectado'}
            openaiStatus={stats.openaiConfigurado}
            agenteStatus={stats.agenteConfigurado}
          />
        )}

        {/* Status da Conexão */}
        <div className="flex items-center gap-3 md:gap-4 p-3 md:p-4 rounded-xl bg-card border border-border">
          <div
            className={`flex h-10 w-10 md:h-12 md:w-12 items-center justify-center rounded-xl flex-shrink-0 ${
              stats.conexaoStatus === 'conectado' ? 'bg-success/20' : 'bg-muted'
            }`}
          >
            {stats.conexaoStatus === 'conectado' ? (
              <PlugZap className="h-5 w-5 md:h-6 md:w-6 text-success" />
            ) : (
              <Plug className="h-5 w-5 md:h-6 md:w-6 text-muted-foreground" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs md:text-sm text-muted-foreground">Status WhatsApp</p>
            <p
              className={`font-semibold text-sm md:text-base truncate ${
                stats.conexaoStatus === 'conectado' ? 'text-success' : 'text-muted-foreground'
              }`}
            >
              {stats.conexaoStatus === 'conectado'
                ? 'Conectado'
                : stats.conexaoStatus === 'aguardando'
                ? 'Aguardando QR'
                : 'Desconectado'}
            </p>
          </div>
          {stats.conexaoStatus !== 'conectado' && (
            <a
              href="/conexao"
              className="px-3 md:px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs md:text-sm font-medium hover:bg-primary/90 transition-colors flex-shrink-0"
            >
              Configurar
            </a>
          )}
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6">
          {cards.map((card, index) => (
            <div
              key={index}
              className="p-4 md:p-6 rounded-xl bg-card border border-border hover:border-primary/50 transition-all duration-300 card-hover"
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <div className="flex items-start justify-between">
                <div className={`flex h-10 w-10 md:h-12 md:w-12 items-center justify-center rounded-xl ${card.bgColor}`}>
                  <card.icon className={`h-5 w-5 md:h-6 md:w-6 ${card.color}`} />
                </div>
                {!isMobile && (
                  <div
                    className={`flex items-center gap-1 text-sm ${
                      card.trend === 'up' ? 'text-success' : 'text-destructive'
                    }`}
                  >
                    {card.change}
                    {card.trend === 'up' ? (
                      <ArrowUpRight className="h-4 w-4" />
                    ) : (
                      <ArrowDownRight className="h-4 w-4" />
                    )}
                  </div>
                )}
              </div>
              <div className="mt-3 md:mt-4">
                <p className="text-lg md:text-2xl font-bold text-foreground truncate">{card.value}</p>
                <p className="text-xs md:text-sm text-muted-foreground mt-1">{card.title}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
          {/* Últimas Conversas */}
          <div className="p-4 md:p-6 rounded-xl bg-card border border-border">
            <h3 className="text-base md:text-lg font-semibold text-foreground mb-3 md:mb-4">Últimas Conversas</h3>
            <div className="space-y-3 md:space-y-4">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 md:gap-4 p-2.5 md:p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors cursor-pointer"
                >
                  <div className="flex h-9 w-9 md:h-10 md:w-10 items-center justify-center rounded-full bg-primary/20 text-primary font-semibold text-sm md:text-base flex-shrink-0">
                    C{i}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground truncate text-sm md:text-base">Contato {i}</p>
                    <p className="text-xs md:text-sm text-muted-foreground truncate">
                      Última mensagem do contato...
                    </p>
                  </div>
                  <div className="text-xs text-muted-foreground flex-shrink-0">10:3{i}</div>
                </div>
              ))}
              <a
                href="/conversas"
                className="block text-center text-sm text-primary hover:underline pt-1"
              >
                Ver todas
              </a>
            </div>
          </div>

          {/* Negociações Recentes */}
          <div className="p-4 md:p-6 rounded-xl bg-card border border-border">
            <h3 className="text-base md:text-lg font-semibold text-foreground mb-3 md:mb-4">Negociações Recentes</h3>
            <div className="space-y-3 md:space-y-4">
              {[
                { nome: 'Proposta ABC Corp', valor: 15000, estagio: 'Negociação' },
                { nome: 'Contrato XYZ Ltda', valor: 8500, estagio: 'Proposta Enviada' },
                { nome: 'Lead Novo', valor: 3200, estagio: 'Novo Lead' },
              ].map((deal, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 md:gap-4 p-2.5 md:p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors cursor-pointer"
                >
                  <div className="flex h-9 w-9 md:h-10 md:w-10 items-center justify-center rounded-full bg-success/20 text-success flex-shrink-0">
                    <DollarSign className="h-4 w-4 md:h-5 md:w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground truncate text-sm md:text-base">{deal.nome}</p>
                    <p className="text-xs md:text-sm text-muted-foreground">{deal.estagio}</p>
                  </div>
                  <div className="text-xs md:text-sm font-semibold text-success flex-shrink-0">
                    {formatCurrency(deal.valor)}
                  </div>
                </div>
              ))}
              <a href="/crm" className="block text-center text-sm text-primary hover:underline pt-1">
                Ver todas
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Modal de Escolha de Conexão */}
      <EscolhaConexaoModal 
        open={showEscolhaConexao} 
        onOpenChange={setShowEscolhaConexao} 
      />
    </MainLayout>
  );
}
