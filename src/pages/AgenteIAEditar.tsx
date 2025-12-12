import { useState, useEffect } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { 
  Bot, Save, Clock, Loader2, Sparkles, ArrowLeft, Pencil, Check, X,
  FileText, MessageCircle, HelpCircle, Layers, Calendar, Zap, Bell, 
  Volume2, Settings, ChevronDown, ChevronUp, Plus, GripVertical, Trash2
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { useNavigate, useParams } from 'react-router-dom';

interface AgentConfig {
  id: string;
  nome: string;
  tipo: 'principal' | 'secundario';
  prompt_sistema: string;
  modelo: string;
  temperatura: number;
  max_tokens: number;
  ativo: boolean;
  horario_inicio: string;
  horario_fim: string;
  dias_ativos: number[];
  mensagem_fora_horario: string;
  gatilho: string | null;
  descricao: string | null;
}

type Tab = 'regras' | 'etapas' | 'perguntas';

const MAX_CARACTERES = 15000;

const diasSemana = [
  { value: 0, label: 'Dom' },
  { value: 1, label: 'Seg' },
  { value: 2, label: 'Ter' },
  { value: 3, label: 'Qua' },
  { value: 4, label: 'Qui' },
  { value: 5, label: 'Sex' },
  { value: 6, label: 'Sáb' },
];

const modelos = [
  { value: 'google/gemini-2.5-flash', label: 'Gemini 2.5 Flash (Recomendado)' },
  { value: 'google/gemini-2.5-pro', label: 'Gemini 2.5 Pro (Mais Poderoso)' },
  { value: 'openai/gpt-5-mini', label: 'GPT-5 Mini' },
];

export default function AgenteIAEditar() {
  const { usuario } = useAuth();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  
  const [config, setConfig] = useState<AgentConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('regras');
  const [editingName, setEditingName] = useState(false);
  const [tempName, setTempName] = useState('');

  useEffect(() => {
    if (usuario?.conta_id && id) {
      fetchConfig();
    }
  }, [usuario, id]);

  const fetchConfig = async () => {
    try {
      const { data, error } = await supabase
        .from('agent_ia')
        .select('*')
        .eq('id', id)
        .eq('conta_id', usuario!.conta_id)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setConfig({
          ...data,
          temperatura: Number(data.temperatura),
          tipo: (data.tipo === 'secundario' ? 'secundario' : 'principal') as 'principal' | 'secundario',
        });
        setTempName(data.nome || '');
      } else {
        toast.error('Agente não encontrado');
        navigate('/agente-ia');
      }
    } catch (error) {
      console.error('Erro ao buscar config:', error);
      toast.error('Erro ao carregar agente');
      navigate('/agente-ia');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!config) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('agent_ia')
        .update({
          nome: config.nome,
          tipo: config.tipo,
          prompt_sistema: config.prompt_sistema,
          modelo: config.modelo,
          temperatura: config.temperatura,
          max_tokens: config.max_tokens,
          ativo: config.ativo,
          horario_inicio: config.horario_inicio,
          horario_fim: config.horario_fim,
          dias_ativos: config.dias_ativos,
          mensagem_fora_horario: config.mensagem_fora_horario,
          gatilho: config.gatilho,
          descricao: config.descricao,
        })
        .eq('id', config.id);

      if (error) throw error;
      toast.success('Configurações salvas!');
    } catch (error) {
      console.error('Erro ao salvar:', error);
      toast.error('Erro ao salvar configurações');
    } finally {
      setSaving(false);
    }
  };

  const handleNameSave = () => {
    if (config && tempName.trim()) {
      setConfig({ ...config, nome: tempName.trim() });
      setEditingName(false);
    }
  };

  const toggleDia = (dia: number) => {
    if (!config) return;

    const novosDias = config.dias_ativos.includes(dia)
      ? config.dias_ativos.filter((d) => d !== dia)
      : [...config.dias_ativos, dia].sort();

    setConfig({ ...config, dias_ativos: novosDias });
  };

  const caracteresUsados = config?.prompt_sistema?.length || 0;
  const porcentagemUsada = (caracteresUsados / MAX_CARACTERES) * 100;

  const tabs = [
    { id: 'regras' as Tab, label: 'Regras Gerais', icon: FileText },
    { id: 'etapas' as Tab, label: 'Etapas de Atendimento', icon: MessageCircle },
    { id: 'perguntas' as Tab, label: 'Perguntas Frequentes', icon: HelpCircle },
  ];

  const sidebarItems = [
    { icon: Layers, label: 'Modelos' },
    { icon: Calendar, label: 'Agendamento' },
    { icon: Zap, label: 'Funções Externas' },
    { icon: Bell, label: 'Notificações' },
    { icon: Volume2, label: 'Áudio e Voz' },
    { icon: Clock, label: 'Horário de Funcionamento' },
    { icon: Settings, label: 'Parâmetros Avançados' },
  ];

  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </MainLayout>
    );
  }

  if (!config) {
    return (
      <MainLayout>
        <div className="text-center text-muted-foreground py-12">
          <Bot className="h-16 w-16 mx-auto mb-4 opacity-50" />
          <p>Agente não encontrado</p>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="flex flex-col h-full animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border bg-card/50">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/agente-ia')}
              className="flex items-center justify-center h-9 w-9 rounded-lg hover:bg-muted transition-colors"
            >
              <ArrowLeft className="h-5 w-5 text-muted-foreground" />
            </button>
            
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
              <Bot className="h-5 w-5 text-muted-foreground" />
            </div>

            <div className="flex items-center gap-2">
              {editingName ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={tempName}
                    onChange={(e) => setTempName(e.target.value)}
                    className="h-8 px-2 rounded border border-border bg-input text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleNameSave();
                      if (e.key === 'Escape') setEditingName(false);
                    }}
                  />
                  <button onClick={handleNameSave} className="p-1 rounded hover:bg-muted">
                    <Check className="h-4 w-4 text-primary" />
                  </button>
                  <button onClick={() => setEditingName(false)} className="p-1 rounded hover:bg-muted">
                    <X className="h-4 w-4 text-muted-foreground" />
                  </button>
                </div>
              ) : (
                <>
                  <span className="font-semibold text-foreground">{config.nome}</span>
                  <button
                    onClick={() => {
                      setTempName(config.nome);
                      setEditingName(true);
                    }}
                    className="p-1 rounded hover:bg-muted"
                  >
                    <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                </>
              )}
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                config.tipo === 'principal' 
                  ? 'bg-primary/20 text-primary' 
                  : 'bg-muted text-muted-foreground'
              }`}>
                {config.tipo === 'principal' ? 'Principal' : 'Secundário'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className={`text-sm ${config.ativo ? 'text-primary' : 'text-muted-foreground'}`}>
                {config.ativo ? '● Ativo' : '○ Inativo'}
              </span>
              <button
                onClick={() => setConfig({ ...config, ativo: !config.ativo })}
                className={`relative h-6 w-11 rounded-full transition-colors ${
                  config.ativo ? 'bg-primary' : 'bg-muted'
                }`}
              >
                <div
                  className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                    config.ativo ? 'translate-x-5' : ''
                  }`}
                />
              </button>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-6 px-6 border-b border-border bg-background">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 py-4 border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <tab.icon className="h-4 w-4" />
              <span className="text-sm font-medium">{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex flex-1 overflow-hidden">
          {/* Main Content */}
          <div className="flex-1 overflow-auto p-6">
            {activeTab === 'regras' && (
              <RegrasGeraisTab 
                config={config} 
                setConfig={setConfig}
                onSave={handleSave}
                saving={saving}
                caracteresUsados={caracteresUsados}
                porcentagemUsada={porcentagemUsada}
                maxCaracteres={MAX_CARACTERES}
              />
            )}

            {activeTab === 'etapas' && (
              <EtapasAtendimentoTab />
            )}

            {activeTab === 'perguntas' && (
              <PerguntasFrequentesTab />
            )}
          </div>

          {/* Sidebar Direita */}
          <div className="w-64 border-l border-border bg-card/30 overflow-auto">
            <div className="p-4 border-b border-border">
              <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
                Total de caracteres
              </div>
              <div className="text-lg font-semibold text-foreground">
                {caracteresUsados.toLocaleString()} / {MAX_CARACTERES.toLocaleString()}
              </div>
              <div className="h-1.5 bg-muted rounded-full mt-2 overflow-hidden">
                <div 
                  className={`h-full rounded-full transition-all ${
                    porcentagemUsada > 80 ? 'bg-destructive' : 'bg-primary'
                  }`}
                  style={{ width: `${Math.min(porcentagemUsada, 100)}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {Math.round(porcentagemUsada)}% do limite recomendado
              </p>
            </div>

            <div className="p-2 space-y-1">
              {sidebarItems.map((item, index) => (
                <button
                  key={index}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors"
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </button>
              ))}
            </div>

            {/* Gatilho Info */}
            <div className="mx-3 mt-4 p-3 rounded-lg bg-primary/10 border border-primary/20">
              <div className="flex items-center gap-2 text-primary mb-1">
                <Zap className="h-4 w-4" />
                <span className="text-sm font-medium">Sem gatilho ativo</span>
              </div>
              <p className="text-xs text-muted-foreground">
                O agente responde na primeira mensagem recebida.
              </p>
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}

// Tab: Regras Gerais
function RegrasGeraisTab({ 
  config, 
  setConfig, 
  onSave, 
  saving,
  caracteresUsados,
  porcentagemUsada,
  maxCaracteres
}: { 
  config: AgentConfig;
  setConfig: (c: AgentConfig) => void;
  onSave: () => void;
  saving: boolean;
  caracteresUsados: number;
  porcentagemUsada: number;
  maxCaracteres: number;
}) {
  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <label className="block text-sm font-medium text-foreground mb-2">
          Regras do Agente
        </label>
        <textarea
          value={config.prompt_sistema}
          onChange={(e) => setConfig({ ...config, prompt_sistema: e.target.value })}
          rows={16}
          className="w-full px-4 py-3 rounded-lg bg-input border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-none font-mono text-sm"
          placeholder="Defina as regras e comportamento do agente..."
        />
      </div>

      <button
        onClick={onSave}
        disabled={saving}
        className="flex items-center gap-2 h-10 px-6 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
      >
        {saving ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Save className="h-4 w-4" />
        )}
        Salvar Regras
      </button>
    </div>
  );
}

// Tab: Etapas de Atendimento
interface Etapa {
  id: string;
  numero: number;
  tipo: 'INÍCIO' | 'FINAL' | null;
  nome: string;
  descricao: string;
  expandido: boolean;
}

function EtapasAtendimentoTab() {
  const [etapas, setEtapas] = useState<Etapa[]>([
    { id: '1', numero: 1, tipo: 'INÍCIO', nome: 'Boas-vindas', descricao: '', expandido: false },
    { id: '2', numero: 2, tipo: null, nome: 'Qualificação', descricao: '', expandido: false },
    { id: '3', numero: 3, tipo: null, nome: 'Pré-agendamento', descricao: '', expandido: false },
    { id: '4', numero: 4, tipo: 'FINAL', nome: 'Reunião Agendada', descricao: '', expandido: false },
  ]);

  const toggleEtapa = (id: string) => {
    setEtapas(etapas.map(e => 
      e.id === id ? { ...e, expandido: !e.expandido } : e
    ));
  };

  const addEtapa = () => {
    const novaEtapa: Etapa = {
      id: crypto.randomUUID(),
      numero: etapas.length + 1,
      tipo: null,
      nome: `Nova Etapa ${etapas.length + 1}`,
      descricao: '',
      expandido: true,
    };
    setEtapas([...etapas, novaEtapa]);
  };

  const deleteEtapa = (id: string) => {
    const novasEtapas = etapas
      .filter(e => e.id !== id)
      .map((e, index) => ({ ...e, numero: index + 1 }));
    setEtapas(novasEtapas);
  };

  const updateEtapa = (id: string, field: keyof Etapa, value: string) => {
    setEtapas(etapas.map(e => 
      e.id === id ? { ...e, [field]: value } : e
    ));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Etapas de Atendimento</h2>
          <p className="text-sm text-muted-foreground">Configure o fluxo de conversação</p>
        </div>
        <button 
          onClick={addEtapa}
          className="flex items-center gap-2 h-10 px-4 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Adicionar Etapa
        </button>
      </div>

      <div className="space-y-3">
        {etapas.map((etapa) => (
          <div 
            key={etapa.id}
            className="rounded-lg bg-card border border-border overflow-hidden"
          >
            <div className="flex items-center gap-3 p-4">
              <button className="cursor-grab">
                <GripVertical className="h-5 w-5 text-muted-foreground" />
              </button>
              
              <div className="flex items-center justify-center h-8 w-8 rounded-full bg-primary text-primary-foreground text-sm font-semibold">
                {etapa.numero}
              </div>

              <div className="flex-1">
                <div className="flex items-center gap-2">
                  {etapa.tipo && (
                    <span className="text-xs text-muted-foreground">
                      ETAPA {etapa.numero} - {etapa.tipo}
                    </span>
                  )}
                  {!etapa.tipo && (
                    <span className="text-xs text-muted-foreground">
                      ETAPA {etapa.numero}
                    </span>
                  )}
                </div>
                <h3 className="font-medium text-foreground">{etapa.nome}</h3>
              </div>

              <button
                onClick={() => toggleEtapa(etapa.id)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border text-sm text-muted-foreground hover:bg-muted transition-colors"
              >
                {etapa.expandido ? (
                  <>
                    <ChevronUp className="h-4 w-4" />
                    Reduzir
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-4 w-4" />
                    Expandir
                  </>
                )}
              </button>

              <button 
                onClick={() => deleteEtapa(etapa.id)}
                className="p-2 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>

            {etapa.expandido && (
              <div className="p-4 pt-0 border-t border-border mt-2">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Nome da Etapa
                    </label>
                    <input
                      type="text"
                      value={etapa.nome}
                      onChange={(e) => updateEtapa(etapa.id, 'nome', e.target.value)}
                      className="w-full h-10 px-4 rounded-lg bg-input border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Descrição da Etapa
                    </label>
                    <div className="flex items-center gap-2 mb-2 p-2 rounded-lg bg-muted/50 border border-border">
                      <button className="flex items-center gap-1 px-2 py-1 rounded text-xs text-muted-foreground hover:bg-muted">
                        <MessageCircle className="h-3 w-3" />
                        Situação/Mensagem
                      </button>
                      <button className="flex items-center gap-1 px-2 py-1 rounded text-xs text-muted-foreground hover:bg-muted">
                        📎 Mídia
                      </button>
                      <button className="flex items-center gap-1 px-2 py-1 rounded text-xs text-muted-foreground hover:bg-muted">
                        ⚡ Ação
                      </button>
                      <button className="flex items-center gap-1 px-2 py-1 rounded text-xs text-muted-foreground hover:bg-muted">
                        @ ou #
                      </button>
                    </div>
                    <textarea
                      rows={6}
                      value={etapa.descricao}
                      onChange={(e) => updateEtapa(etapa.id, 'descricao', e.target.value)}
                      className="w-full px-4 py-3 rounded-lg bg-input border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-none text-sm"
                      placeholder="Descreva o comportamento desta etapa..."
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 text-sm text-muted-foreground">
                      <input type="checkbox" className="rounded border-border" />
                      Atribuir automaticamente usuário ao lead
                    </label>
                    <button className="flex items-center gap-2 h-9 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors">
                      <Save className="h-4 w-4" />
                      Salvar
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {etapas.length === 0 && (
        <div className="flex flex-col items-center justify-center p-12 rounded-xl bg-card border border-border">
          <Layers className="h-12 w-12 text-muted-foreground/50 mb-4" />
          <h3 className="font-medium text-foreground mb-1">Nenhuma etapa configurada</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Adicione etapas para definir o fluxo de atendimento
          </p>
          <button 
            onClick={addEtapa}
            className="flex items-center gap-2 h-10 px-4 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Adicionar Primeira Etapa
          </button>
        </div>
      )}

      {etapas.length > 0 && (
        <button 
          onClick={addEtapa}
          className="w-full flex items-center justify-center gap-2 h-12 rounded-lg border-2 border-dashed border-border text-muted-foreground hover:border-primary hover:text-primary transition-colors"
        >
          <Plus className="h-5 w-5" />
          Adicionar Etapa
        </button>
      )}
    </div>
  );
}

// Tab: Perguntas Frequentes
interface Pergunta {
  id: string;
  pergunta: string;
  resposta: string;
  expandido: boolean;
}

function PerguntasFrequentesTab() {
  const [perguntas, setPerguntas] = useState<Pergunta[]>([]);

  const addPergunta = () => {
    const novaPergunta: Pergunta = {
      id: crypto.randomUUID(),
      pergunta: '',
      resposta: '',
      expandido: true,
    };
    setPerguntas([...perguntas, novaPergunta]);
  };

  const deletePergunta = (id: string) => {
    setPerguntas(perguntas.filter(p => p.id !== id));
  };

  const updatePergunta = (id: string, field: keyof Pergunta, value: string) => {
    setPerguntas(perguntas.map(p => 
      p.id === id ? { ...p, [field]: value } : p
    ));
  };

  const togglePergunta = (id: string) => {
    setPerguntas(perguntas.map(p => 
      p.id === id ? { ...p, expandido: !p.expandido } : p
    ));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Perguntas Frequentes</h2>
          <p className="text-sm text-muted-foreground">Configure respostas automáticas para perguntas comuns</p>
        </div>
        <button 
          onClick={addPergunta}
          className="flex items-center gap-2 h-10 px-4 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Adicionar Pergunta
        </button>
      </div>

      {perguntas.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 rounded-xl bg-card border border-border">
          <HelpCircle className="h-12 w-12 text-muted-foreground/50 mb-4" />
          <h3 className="font-medium text-foreground mb-1">Nenhuma pergunta configurada</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Adicione perguntas frequentes para respostas mais rápidas
          </p>
          <button 
            onClick={addPergunta}
            className="flex items-center gap-2 h-10 px-4 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Adicionar Primeira Pergunta
          </button>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {perguntas.map((item, index) => (
              <div 
                key={item.id}
                className="rounded-lg bg-card border border-border overflow-hidden"
              >
                <div className="flex items-center gap-3 p-4">
                  <div className="flex items-center justify-center h-8 w-8 rounded-full bg-primary/20 text-primary text-sm font-semibold">
                    {index + 1}
                  </div>

                  <div className="flex-1">
                    <h3 className="font-medium text-foreground">
                      {item.pergunta || 'Nova Pergunta'}
                    </h3>
                    {item.resposta && (
                      <p className="text-sm text-muted-foreground line-clamp-1">
                        {item.resposta}
                      </p>
                    )}
                  </div>

                  <button
                    onClick={() => togglePergunta(item.id)}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border text-sm text-muted-foreground hover:bg-muted transition-colors"
                  >
                    {item.expandido ? (
                      <>
                        <ChevronUp className="h-4 w-4" />
                        Reduzir
                      </>
                    ) : (
                      <>
                        <ChevronDown className="h-4 w-4" />
                        Expandir
                      </>
                    )}
                  </button>

                  <button 
                    onClick={() => deletePergunta(item.id)}
                    className="p-2 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                {item.expandido && (
                  <div className="p-4 pt-0 border-t border-border mt-2">
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-foreground mb-2">
                          Pergunta
                        </label>
                        <input
                          type="text"
                          value={item.pergunta}
                          onChange={(e) => updatePergunta(item.id, 'pergunta', e.target.value)}
                          placeholder="Ex: Qual o horário de funcionamento?"
                          className="w-full h-10 px-4 rounded-lg bg-input border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-foreground mb-2">
                          Resposta
                        </label>
                        <textarea
                          rows={4}
                          value={item.resposta}
                          onChange={(e) => updatePergunta(item.id, 'resposta', e.target.value)}
                          placeholder="Digite a resposta para esta pergunta..."
                          className="w-full px-4 py-3 rounded-lg bg-input border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-none text-sm"
                        />
                      </div>

                      <div className="flex justify-end">
                        <button className="flex items-center gap-2 h-9 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors">
                          <Save className="h-4 w-4" />
                          Salvar
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          <button 
            onClick={addPergunta}
            className="w-full flex items-center justify-center gap-2 h-12 rounded-lg border-2 border-dashed border-border text-muted-foreground hover:border-primary hover:text-primary transition-colors"
          >
            <Plus className="h-5 w-5" />
            Adicionar Pergunta
          </button>
        </>
      )}
    </div>
  );
}
