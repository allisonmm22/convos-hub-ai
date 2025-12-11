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
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface DashboardStats {
  totalNegociacoes: number;
  valorTotal: number;
  totalContatos: number;
  totalMensagens: number;
  conexaoStatus: 'conectado' | 'desconectado' | 'aguardando';
}

export default function Dashboard() {
  const { usuario } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({
    totalNegociacoes: 0,
    valorTotal: 0,
    totalContatos: 0,
    totalMensagens: 0,
    conexaoStatus: 'desconectado',
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (usuario?.conta_id) {
      fetchStats();
    }
  }, [usuario]);

  const fetchStats = async () => {
    try {
      const [negociacoes, contatos, mensagens, conexao] = await Promise.all([
        supabase.from('negociacoes').select('valor').eq('conta_id', usuario!.conta_id),
        supabase.from('contatos').select('id', { count: 'exact' }).eq('conta_id', usuario!.conta_id),
        supabase.from('mensagens').select('id', { count: 'exact' }),
        supabase.from('conexoes_whatsapp').select('status').eq('conta_id', usuario!.conta_id).maybeSingle(),
      ]);

      setStats({
        totalNegociacoes: negociacoes.data?.length || 0,
        valorTotal: negociacoes.data?.reduce((acc, n) => acc + Number(n.valor || 0), 0) || 0,
        totalContatos: contatos.count || 0,
        totalMensagens: mensagens.count || 0,
        conexaoStatus: (conexao.data?.status as any) || 'desconectado',
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

  return (
    <MainLayout>
      <div className="space-y-8 animate-fade-in">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Bem-vindo de volta, {usuario?.nome}! Aqui está um resumo das suas atividades.
          </p>
        </div>

        {/* Status da Conexão */}
        <div className="flex items-center gap-4 p-4 rounded-xl bg-card border border-border">
          <div
            className={`flex h-12 w-12 items-center justify-center rounded-xl ${
              stats.conexaoStatus === 'conectado' ? 'bg-success/20' : 'bg-muted'
            }`}
          >
            {stats.conexaoStatus === 'conectado' ? (
              <PlugZap className="h-6 w-6 text-success" />
            ) : (
              <Plug className="h-6 w-6 text-muted-foreground" />
            )}
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Status da Conexão WhatsApp</p>
            <p
              className={`font-semibold ${
                stats.conexaoStatus === 'conectado' ? 'text-success' : 'text-muted-foreground'
              }`}
            >
              {stats.conexaoStatus === 'conectado'
                ? 'Conectado'
                : stats.conexaoStatus === 'aguardando'
                ? 'Aguardando QR Code'
                : 'Desconectado'}
            </p>
          </div>
          {stats.conexaoStatus !== 'conectado' && (
            <a
              href="/conexao"
              className="ml-auto px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              Configurar
            </a>
          )}
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {cards.map((card, index) => (
            <div
              key={index}
              className="p-6 rounded-xl bg-card border border-border hover:border-primary/50 transition-all duration-300 card-hover"
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <div className="flex items-start justify-between">
                <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${card.bgColor}`}>
                  <card.icon className={`h-6 w-6 ${card.color}`} />
                </div>
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
              </div>
              <div className="mt-4">
                <p className="text-2xl font-bold text-foreground">{card.value}</p>
                <p className="text-sm text-muted-foreground mt-1">{card.title}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Últimas Conversas */}
          <div className="p-6 rounded-xl bg-card border border-border">
            <h3 className="text-lg font-semibold text-foreground mb-4">Últimas Conversas</h3>
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="flex items-center gap-4 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors cursor-pointer"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/20 text-primary font-semibold">
                    C{i}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground truncate">Contato {i}</p>
                    <p className="text-sm text-muted-foreground truncate">
                      Última mensagem do contato...
                    </p>
                  </div>
                  <div className="text-xs text-muted-foreground">10:3{i}</div>
                </div>
              ))}
              <a
                href="/conversas"
                className="block text-center text-sm text-primary hover:underline"
              >
                Ver todas as conversas
              </a>
            </div>
          </div>

          {/* Negociações Recentes */}
          <div className="p-6 rounded-xl bg-card border border-border">
            <h3 className="text-lg font-semibold text-foreground mb-4">Negociações Recentes</h3>
            <div className="space-y-4">
              {[
                { nome: 'Proposta ABC Corp', valor: 15000, estagio: 'Negociação' },
                { nome: 'Contrato XYZ Ltda', valor: 8500, estagio: 'Proposta Enviada' },
                { nome: 'Lead Novo', valor: 3200, estagio: 'Novo Lead' },
              ].map((deal, i) => (
                <div
                  key={i}
                  className="flex items-center gap-4 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors cursor-pointer"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-success/20 text-success">
                    <DollarSign className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground truncate">{deal.nome}</p>
                    <p className="text-sm text-muted-foreground">{deal.estagio}</p>
                  </div>
                  <div className="text-sm font-semibold text-success">
                    {formatCurrency(deal.valor)}
                  </div>
                </div>
              ))}
              <a href="/crm" className="block text-center text-sm text-primary hover:underline">
                Ver todas as negociações
              </a>
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
