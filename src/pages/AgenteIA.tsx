import { useState, useEffect } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Bot, Search, Plus, Loader2, Pencil, Clock, Users, Key, Save, Eye, EyeOff } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { NovoAgenteModal } from '@/components/NovoAgenteModal';
interface Agent {
  id: string;
  nome: string;
  tipo: 'principal' | 'secundario';
  ativo: boolean;
  gatilho: string | null;
  descricao: string | null;
}

type SubPage = 'agentes' | 'followup' | 'sessoes' | 'configuracao';

export default function AgenteIA() {
  const { usuario } = useAuth();
  const navigate = useNavigate();
  const [agentes, setAgentes] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');
  const [subPage, setSubPage] = useState<SubPage>('agentes');
  const [showNovoAgenteModal, setShowNovoAgenteModal] = useState(false);

  useEffect(() => {
    if (usuario?.conta_id) {
      fetchAgentes();
    }
  }, [usuario]);

  const fetchAgentes = async () => {
    try {
      const { data, error } = await supabase
        .from('agent_ia')
        .select('id, nome, tipo, ativo, gatilho, descricao')
        .eq('conta_id', usuario!.conta_id)
        .order('tipo', { ascending: true })
        .order('nome', { ascending: true });

      if (error) throw error;
      setAgentes((data || []).map(d => ({
        ...d,
        tipo: (d.tipo === 'secundario' ? 'secundario' : 'principal') as 'principal' | 'secundario'
      })));
    } catch (error) {
      console.error('Erro ao buscar agentes:', error);
      toast.error('Erro ao carregar agentes');
    } finally {
      setLoading(false);
    }
  };

  const toggleAgente = async (id: string, ativo: boolean) => {
    try {
      const { error } = await supabase
        .from('agent_ia')
        .update({ ativo: !ativo })
        .eq('id', id);

      if (error) throw error;

      setAgentes(agentes.map(a => 
        a.id === id ? { ...a, ativo: !ativo } : a
      ));
      
      toast.success(ativo ? 'Agente desativado' : 'Agente ativado');
    } catch (error) {
      console.error('Erro ao atualizar agente:', error);
      toast.error('Erro ao atualizar agente');
    }
  };

  const criarNovoAgente = async (nome: string, tipo: 'principal' | 'secundario') => {
    try {
      const { data, error } = await supabase
        .from('agent_ia')
        .insert({
          conta_id: usuario!.conta_id,
          nome,
          tipo,
          ativo: false,
          prompt_sistema: 'Você é um assistente virtual amigável e profissional.',
        })
        .select('id')
        .single();

      if (error) throw error;

      toast.success('Agente criado! Configure-o agora.');
      navigate(`/agente-ia/${data.id}`);
    } catch (error) {
      console.error('Erro ao criar agente:', error);
      toast.error('Erro ao criar agente');
    }
  };

  const agentesFiltrados = agentes.filter(a =>
    a.nome.toLowerCase().includes(busca.toLowerCase()) ||
    (a.gatilho && a.gatilho.toLowerCase().includes(busca.toLowerCase()))
  );

  const agentesPrincipais = agentesFiltrados.filter(a => a.tipo === 'principal');
  const agentesSecundarios = agentesFiltrados.filter(a => a.tipo === 'secundario');

  const subNavItems = [
    { id: 'agentes' as SubPage, label: 'Agentes', icon: Bot },
    { id: 'followup' as SubPage, label: 'Follow-up', icon: Clock },
    { id: 'sessoes' as SubPage, label: 'Sessões', icon: Users },
    { id: 'configuracao' as SubPage, label: 'Configuração', icon: Key },
  ];

  return (
    <MainLayout>
      <div className="flex h-full animate-fade-in">
        {/* Sub-Sidebar */}
        <div className="w-56 border-r border-border bg-card/50 flex flex-col">
          <div className="p-4 border-b border-border">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/20">
                <Bot className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h2 className="font-semibold text-foreground">Agentes</h2>
                <p className="text-xs text-muted-foreground">Gerenciamento de agentes</p>
              </div>
            </div>
          </div>

          <nav className="flex-1 p-2 space-y-1">
            {subNavItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setSubPage(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  subPage === item.id
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                }`}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Conteúdo Principal */}
        <div className="flex-1 overflow-auto">
          {subPage === 'agentes' && (
            <div className="p-6 space-y-6">
              {/* Header */}
              <div className="flex items-center justify-between">
                <div className="relative flex-1 max-w-md">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    type="text"
                    value={busca}
                    onChange={(e) => setBusca(e.target.value)}
                    placeholder="Buscar por nome ou gatilho..."
                    className="w-full h-10 pl-10 pr-4 rounded-lg bg-input border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <button
                  onClick={() => setShowNovoAgenteModal(true)}
                  className="flex items-center gap-2 h-10 px-4 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors"
                >
                  <Plus className="h-4 w-4" />
                  Novo Agente
                </button>
              </div>

              <NovoAgenteModal
                open={showNovoAgenteModal}
                onOpenChange={setShowNovoAgenteModal}
                onConfirm={criarNovoAgente}
              />

              {loading ? (
                <div className="flex items-center justify-center h-64">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Agentes Principais */}
                  <div className="space-y-3">
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Agentes Principais ({agentesPrincipais.length})
                    </h3>
                    {agentesPrincipais.length === 0 ? (
                      <div className="p-4 rounded-lg bg-card border border-border text-center text-muted-foreground text-sm">
                        Nenhum agente principal configurado
                      </div>
                    ) : (
                      <div className="grid gap-3 md:grid-cols-2">
                        {agentesPrincipais.map((agente) => (
                          <AgentCard
                            key={agente.id}
                            agente={agente}
                            onToggle={() => toggleAgente(agente.id, agente.ativo)}
                            onEdit={() => navigate(`/agente-ia/${agente.id}`)}
                          />
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Agentes Secundários */}
                  <div className="space-y-3">
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Agentes Secundários ({agentesSecundarios.length})
                    </h3>
                    {agentesSecundarios.length === 0 ? (
                      <div className="p-4 rounded-lg bg-card border border-border text-center text-muted-foreground text-sm">
                        Nenhum agente secundário configurado
                      </div>
                    ) : (
                      <div className="grid gap-3 md:grid-cols-2">
                        {agentesSecundarios.map((agente) => (
                          <AgentCard
                            key={agente.id}
                            agente={agente}
                            onToggle={() => toggleAgente(agente.id, agente.ativo)}
                            onEdit={() => navigate(`/agente-ia/${agente.id}`)}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {subPage === 'followup' && (
            <FollowUpPage />
          )}

          {subPage === 'sessoes' && (
            <SessoesPage />
          )}

          {subPage === 'configuracao' && (
            <ConfiguracaoPage />
          )}
        </div>
      </div>
    </MainLayout>
  );
}

// Componente AgentCard
function AgentCard({ 
  agente, 
  onToggle, 
  onEdit 
}: { 
  agente: Agent; 
  onToggle: () => void; 
  onEdit: () => void;
}) {
  return (
    <div className="group flex items-center justify-between p-4 rounded-lg bg-card border border-border hover:border-primary/30 transition-colors">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
          <Bot className="h-5 w-5 text-muted-foreground" />
        </div>
        <div className="flex items-center gap-2">
          <span className="font-medium text-foreground">{agente.nome}</span>
          <button
            onClick={onEdit}
            className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-muted transition-all"
          >
            <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        </div>
      </div>
      <button
        onClick={onToggle}
        className={`relative h-6 w-11 rounded-full transition-colors ${
          agente.ativo ? 'bg-primary' : 'bg-muted'
        }`}
      >
        <div
          className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
            agente.ativo ? 'translate-x-5' : ''
          }`}
        />
      </button>
    </div>
  );
}

// Página de Follow-up (placeholder)
function FollowUpPage() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Follow-up Automático</h1>
        <p className="text-muted-foreground mt-1">
          Configure mensagens de acompanhamento para manter seus leads engajados
        </p>
      </div>

      <div className="p-6 rounded-xl bg-card border border-border space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/20">
            <Clock className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="font-semibold text-foreground">Follow-up Automático</h2>
            <p className="text-sm text-muted-foreground">Configure mensagens automáticas para reativar leads</p>
          </div>
        </div>

        <button className="flex items-center gap-2 h-10 px-4 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors">
          <Plus className="h-4 w-4" />
          Criar Novo Follow-up
        </button>

        <div className="p-4 rounded-lg bg-muted/30 border border-dashed border-border">
          <p className="text-sm text-muted-foreground mb-2">
            Selecione os estados de IA que receberão follow-up automático
          </p>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" className="rounded border-border" />
              <span>IA Ativa</span>
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" className="rounded border-border" />
              <span>IA Pausada</span>
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" className="rounded border-border" />
              <span>IA Desativada</span>
            </label>
          </div>
        </div>
      </div>

      <div className="flex flex-col items-center justify-center p-12 rounded-xl bg-card border border-border">
        <Clock className="h-12 w-12 text-muted-foreground/50 mb-4" />
        <h3 className="font-medium text-foreground mb-1">Nenhum follow-up configurado</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Crie mensagens automáticas para reengajar seus leads
        </p>
        <button className="flex items-center gap-2 h-10 px-4 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors">
          <Plus className="h-4 w-4" />
          Criar Primeiro Follow-up
        </button>
      </div>
    </div>
  );
}

// Página de Sessões (placeholder)
function SessoesPage() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Sessões</h1>
        <p className="text-muted-foreground mt-1">
          Visualize e gerencie as sessões de atendimento dos agentes
        </p>
      </div>

      <div className="flex flex-col items-center justify-center p-12 rounded-xl bg-card border border-border">
        <Users className="h-12 w-12 text-muted-foreground/50 mb-4" />
        <h3 className="font-medium text-foreground mb-1">Nenhuma sessão ativa</h3>
        <p className="text-sm text-muted-foreground">
          As sessões de atendimento aparecerão aqui
        </p>
      </div>
    </div>
  );
}

// Página de Configuração (API Key)
function ConfiguracaoPage() {
  const { usuario } = useAuth();
  const [apiKey, setApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (usuario?.conta_id) {
      fetchApiKey();
    }
  }, [usuario?.conta_id]);

  const fetchApiKey = async () => {
    try {
      const { data, error } = await supabase
        .from('contas')
        .select('openai_api_key')
        .eq('id', usuario!.conta_id)
        .single();

      if (error) throw error;
      
      if (data?.openai_api_key) {
        setApiKey(data.openai_api_key);
      }
    } catch (error) {
      console.error('Erro ao buscar API key:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveApiKey = async () => {
    if (!usuario?.conta_id) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('contas')
        .update({ openai_api_key: apiKey })
        .eq('id', usuario.conta_id);

      if (error) throw error;
      toast.success('API Key salva com sucesso!');
    } catch (error) {
      console.error('Erro ao salvar API key:', error);
      toast.error('Erro ao salvar API Key');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Configuração</h1>
        <p className="text-muted-foreground mt-1">
          Configure sua chave de API para habilitar os agentes de IA
        </p>
      </div>

      <div className="max-w-2xl rounded-xl bg-card border border-border p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <Key className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-foreground">API Key da OpenAI</h2>
            <p className="text-sm text-muted-foreground">
              Esta chave será usada por todos os agentes da sua conta
            </p>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                OpenAI API Key
              </label>
              <div className="relative">
                <input
                  type={showApiKey ? 'text' : 'password'}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="sk-..."
                  className="w-full h-11 px-4 pr-12 rounded-lg bg-input border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary font-mono text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showApiKey ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Obtenha sua chave em{' '}
                <a 
                  href="https://platform.openai.com/api-keys" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  platform.openai.com/api-keys
                </a>
              </p>
            </div>

            <button
              onClick={saveApiKey}
              disabled={saving || !apiKey}
              className="flex items-center gap-2 h-10 px-6 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Salvar API Key
            </button>
          </div>
        )}
      </div>

      {/* Status Info */}
      <div className={`max-w-2xl rounded-xl border p-4 ${apiKey ? 'bg-primary/5 border-primary/20' : 'bg-destructive/5 border-destructive/20'}`}>
        <div className="flex items-center gap-3">
          <div className={`h-3 w-3 rounded-full ${apiKey ? 'bg-primary animate-pulse' : 'bg-destructive'}`} />
          <span className={`text-sm font-medium ${apiKey ? 'text-primary' : 'text-destructive'}`}>
            {apiKey ? 'API Key configurada - Agentes prontos para uso' : 'API Key não configurada - Configure para habilitar os agentes'}
          </span>
        </div>
      </div>
    </div>
  );
}
