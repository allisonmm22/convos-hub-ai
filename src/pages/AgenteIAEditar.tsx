import { useState, useEffect } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { 
  Bot, Save, Clock, Loader2, Sparkles, ArrowLeft, Pencil, Check, X,
  FileText, MessageCircle, HelpCircle, Layers, Calendar, Zap, Bell, 
  Volume2, Settings, ChevronDown, ChevronUp, Plus, GripVertical, Trash2,
  Key, Eye, EyeOff
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { DecisaoInteligenteModal } from '@/components/DecisaoInteligenteModal';
import { DescricaoEditor } from '@/components/DescricaoEditor';
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
  atender_24h: boolean;
}

type Tab = 'regras' | 'etapas' | 'perguntas' | 'horario' | 'configuracao';

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
  { value: 'gpt-4o-mini', label: 'GPT-4o Mini (Rápido e Econômico)' },
  { value: 'gpt-4o', label: 'GPT-4o (Equilibrado)' },
  { value: 'gpt-4.1-2025-04-14', label: 'GPT-4.1 (Flagship)' },
  { value: 'gpt-4.1-mini-2025-04-14', label: 'GPT-4.1 Mini' },
  { value: 'gpt-5-2025-08-07', label: 'GPT-5 (Mais Poderoso)' },
  { value: 'gpt-5-mini-2025-08-07', label: 'GPT-5 Mini' },
  { value: 'gpt-5-nano-2025-08-07', label: 'GPT-5 Nano (Ultra Rápido)' },
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
          atender_24h: data.atender_24h ?? false,
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
          atender_24h: config.atender_24h,
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
    { id: 'horario' as Tab, label: 'Horário de Funcionamento', icon: Clock },
    { id: 'configuracao' as Tab, label: 'Configuração API', icon: Key },
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

            {activeTab === 'etapas' && config && (
              <EtapasAtendimentoTab agentId={config.id} />
            )}

            {activeTab === 'perguntas' && config && (
              <PerguntasFrequentesTab agentId={config.id} />
            )}

            {activeTab === 'horario' && config && (
              <HorarioFuncionamentoTab 
                config={config}
                setConfig={setConfig}
                onSave={handleSave}
                saving={saving}
                toggleDia={toggleDia}
              />
            )}

            {activeTab === 'configuracao' && config && (
              <ConfiguracaoAPITab 
                config={config}
                setConfig={setConfig}
                onSave={handleSave}
                saving={saving}
              />
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
  tipo: 'INICIO' | 'FINAL' | null;
  nome: string;
  descricao: string;
  expandido: boolean;
}

interface ConfirmDeleteEtapa {
  show: boolean;
  id: string;
  nome: string;
}

interface ModalDecisaoState {
  isOpen: boolean;
  etapaId: string;
}

function EtapasAtendimentoTab({ agentId }: { agentId: string }) {
  const [etapas, setEtapas] = useState<Etapa[]>([]);
  const [confirmDelete, setConfirmDelete] = useState<ConfirmDeleteEtapa | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modalDecisao, setModalDecisao] = useState<ModalDecisaoState>({
    isOpen: false,
    etapaId: '',
  });

  useEffect(() => {
    fetchEtapas();
  }, [agentId]);

  const fetchEtapas = async () => {
    try {
      const { data, error } = await supabase
        .from('agent_ia_etapas')
        .select('*')
        .eq('agent_ia_id', agentId)
        .order('numero', { ascending: true });

      if (error) throw error;

      setEtapas((data || []).map(e => ({
        id: e.id,
        numero: e.numero,
        tipo: e.tipo as 'INICIO' | 'FINAL' | null,
        nome: e.nome,
        descricao: e.descricao || '',
        expandido: false,
      })));
    } catch (error) {
      console.error('Erro ao buscar etapas:', error);
    } finally {
      setLoading(false);
    }
  };

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

  const handleDeleteClick = (etapa: Etapa) => {
    setConfirmDelete({ show: true, id: etapa.id, nome: etapa.nome });
  };

  const confirmDeleteEtapa = async () => {
    if (confirmDelete) {
      try {
        await supabase
          .from('agent_ia_etapas')
          .delete()
          .eq('id', confirmDelete.id);

        const novasEtapas = etapas
          .filter(e => e.id !== confirmDelete.id)
          .map((e, index) => ({ ...e, numero: index + 1 }));
        setEtapas(novasEtapas);
        toast.success('Etapa excluída com sucesso');
      } catch (error) {
        console.error('Erro ao excluir:', error);
      }
      setConfirmDelete(null);
    }
  };

  const updateEtapa = (id: string, field: keyof Etapa, value: string) => {
    setEtapas(etapas.map(e => 
      e.id === id ? { ...e, [field]: value } : e
    ));
  };

  // Handler para inserir ação do modal no texto
  const handleDecisaoInsert = (action: string) => {
    const etapa = etapas.find(e => e.id === modalDecisao.etapaId);
    if (!etapa) return;

    // Adicionar ação ao final do texto ou na posição adequada
    const novaDescricao = etapa.descricao 
      ? etapa.descricao + ' ' + action
      : action;
    updateEtapa(modalDecisao.etapaId, 'descricao', novaDescricao);
  };

  // Abrir modal de decisão
  const abrirModalDecisao = (etapaId: string) => {
    setModalDecisao({ isOpen: true, etapaId });
  };

  const saveEtapa = async (id: string) => {
    const etapa = etapas.find(e => e.id === id);
    if (!etapa) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('agent_ia_etapas')
        .upsert({
          id: etapa.id,
          agent_ia_id: agentId,
          numero: etapa.numero,
          tipo: etapa.tipo === 'INICIO' ? 'INICIO' : etapa.tipo === 'FINAL' ? 'FINAL' : null,
          nome: etapa.nome,
          descricao: etapa.descricao,
        });

      if (error) throw error;

      toast.success(`Etapa "${etapa.nome}" salva com sucesso`);
      toggleEtapa(id);
    } catch (error) {
      console.error('Erro ao salvar etapa:', error);
      toast.error('Erro ao salvar etapa');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Modal de Decisão Inteligente */}
      <DecisaoInteligenteModal
        isOpen={modalDecisao.isOpen}
        onClose={() => setModalDecisao(prev => ({ ...prev, isOpen: false }))}
        onInsert={handleDecisaoInsert}
      />

      {/* Modal de Confirmação de Exclusão */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-card rounded-xl p-6 w-full max-w-md border border-border shadow-2xl animate-fade-in">
            <h3 className="text-lg font-semibold text-foreground mb-2">
              Confirmar Exclusão
            </h3>
            <p className="text-muted-foreground mb-6">
              Tem certeza que deseja excluir a etapa "{confirmDelete.nome}"? 
              Esta ação não pode ser desfeita.
            </p>
            <div className="flex justify-end gap-3">
              <button 
                onClick={() => setConfirmDelete(null)}
                className="px-4 py-2 rounded-lg border border-border text-foreground hover:bg-muted transition-colors"
              >
                Cancelar
              </button>
              <button 
                onClick={confirmDeleteEtapa}
                className="px-4 py-2 rounded-lg bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors"
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}

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
                onClick={() => handleDeleteClick(etapa)}
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

                  <div className="relative">
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
                      <button 
                        className="flex items-center gap-1 px-2 py-1 rounded text-xs bg-primary/10 text-primary hover:bg-primary/20"
                        onClick={() => abrirModalDecisao(etapa.id)}
                      >
                        @ Decisão
                      </button>
                    </div>
                    
                    {/* Editor rico com chips inline */}
                    <DescricaoEditor
                      value={etapa.descricao}
                      onChange={(value) => updateEtapa(etapa.id, 'descricao', value)}
                      placeholder="Descreva o comportamento desta etapa..."
                      onDecisaoClick={() => abrirModalDecisao(etapa.id)}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      💡 Clique em <span className="text-primary font-medium">@ Decisão</span> ou digite <span className="text-primary font-medium">@</span> para inserir ações como mover para estágio do CRM, adicionar tag, transferir, etc.
                    </p>
                  </div>

                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 text-sm text-muted-foreground">
                      <input type="checkbox" className="rounded border-border" />
                      Atribuir automaticamente usuário ao lead
                    </label>
                    <button 
                      onClick={() => saveEtapa(etapa.id)}
                      className="flex items-center gap-2 h-9 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
                    >
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
  ordem: number;
}

interface ConfirmDeletePergunta {
  show: boolean;
  id: string;
  pergunta: string;
}

function PerguntasFrequentesTab({ agentId }: { agentId: string }) {
  const [perguntas, setPerguntas] = useState<Pergunta[]>([]);
  const [confirmDelete, setConfirmDelete] = useState<ConfirmDeletePergunta | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchPerguntas();
  }, [agentId]);

  const fetchPerguntas = async () => {
    try {
      const { data, error } = await supabase
        .from('agent_ia_perguntas')
        .select('*')
        .eq('agent_ia_id', agentId)
        .order('ordem', { ascending: true });

      if (error) throw error;

      setPerguntas((data || []).map((p, index) => ({
        id: p.id,
        pergunta: p.pergunta,
        resposta: p.resposta,
        ordem: p.ordem || index,
        expandido: false,
      })));
    } catch (error) {
      console.error('Erro ao buscar perguntas:', error);
    } finally {
      setLoading(false);
    }
  };

  const addPergunta = () => {
    const novaPergunta: Pergunta = {
      id: crypto.randomUUID(),
      pergunta: '',
      resposta: '',
      ordem: perguntas.length,
      expandido: true,
    };
    setPerguntas([...perguntas, novaPergunta]);
  };

  const handleDeleteClick = (item: Pergunta) => {
    setConfirmDelete({ show: true, id: item.id, pergunta: item.pergunta || 'Nova Pergunta' });
  };

  const confirmDeletePergunta = async () => {
    if (confirmDelete) {
      try {
        await supabase
          .from('agent_ia_perguntas')
          .delete()
          .eq('id', confirmDelete.id);

        setPerguntas(perguntas.filter(p => p.id !== confirmDelete.id));
        toast.success('Pergunta excluída com sucesso');
      } catch (error) {
        console.error('Erro ao excluir:', error);
      }
      setConfirmDelete(null);
    }
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

  const savePergunta = async (id: string) => {
    const item = perguntas.find(p => p.id === id);
    if (!item) return;

    if (!item.pergunta.trim() || !item.resposta.trim()) {
      toast.error('Preencha a pergunta e a resposta');
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('agent_ia_perguntas')
        .upsert({
          id: item.id,
          agent_ia_id: agentId,
          pergunta: item.pergunta,
          resposta: item.resposta,
          ordem: item.ordem,
        });

      if (error) throw error;

      toast.success('Pergunta salva com sucesso');
      togglePergunta(id);
    } catch (error) {
      console.error('Erro ao salvar pergunta:', error);
      toast.error('Erro ao salvar pergunta');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Modal de Confirmação de Exclusão */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-card rounded-xl p-6 w-full max-w-md border border-border shadow-2xl animate-fade-in">
            <h3 className="text-lg font-semibold text-foreground mb-2">
              Confirmar Exclusão
            </h3>
            <p className="text-muted-foreground mb-6">
              Tem certeza que deseja excluir a pergunta "{confirmDelete.pergunta}"? 
              Esta ação não pode ser desfeita.
            </p>
            <div className="flex justify-end gap-3">
              <button 
                onClick={() => setConfirmDelete(null)}
                className="px-4 py-2 rounded-lg border border-border text-foreground hover:bg-muted transition-colors"
              >
                Cancelar
              </button>
              <button 
                onClick={confirmDeletePergunta}
                className="px-4 py-2 rounded-lg bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors"
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}

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
                    onClick={() => handleDeleteClick(item)}
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
                        <button 
                          onClick={() => savePergunta(item.id)}
                          className="flex items-center gap-2 h-9 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
                        >
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

// Tab: Horário de Funcionamento
function HorarioFuncionamentoTab({ 
  config, 
  setConfig, 
  onSave, 
  saving,
  toggleDia
}: { 
  config: AgentConfig;
  setConfig: (c: AgentConfig) => void;
  onSave: () => void;
  saving: boolean;
  toggleDia: (dia: number) => void;
}) {
  return (
    <div className="space-y-6 max-w-2xl">
      {/* Toggle 24h */}
      <div className="rounded-xl bg-card border border-border p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Clock className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">Atendimento 24 horas</h2>
              <p className="text-sm text-muted-foreground">
                Quando ativado, o agente responde a qualquer hora e dia
              </p>
            </div>
          </div>
          <button
            onClick={() => setConfig({ ...config, atender_24h: !config.atender_24h })}
            className={`relative h-7 w-14 rounded-full transition-colors ${
              config.atender_24h ? 'bg-primary' : 'bg-muted'
            }`}
          >
            <div
              className={`absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform ${
                config.atender_24h ? 'translate-x-7' : ''
              }`}
            />
          </button>
        </div>
      </div>

      {/* Configuração de Horário (desabilitada se 24h) */}
      <div className={`rounded-xl bg-card border border-border p-6 transition-opacity ${config.atender_24h ? 'opacity-50 pointer-events-none' : ''}`}>
        <div className="flex items-center gap-3 mb-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <Calendar className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-foreground">Dias de Atendimento</h2>
            <p className="text-sm text-muted-foreground">
              Selecione os dias em que o agente estará ativo
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mb-6">
          {diasSemana.map((dia) => (
            <button
              key={dia.value}
              onClick={() => toggleDia(dia.value)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                config.dias_ativos.includes(dia.value)
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              {dia.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Horário de Início
            </label>
            <input
              type="time"
              value={config.horario_inicio}
              onChange={(e) => setConfig({ ...config, horario_inicio: e.target.value })}
              className="w-full h-11 px-4 rounded-lg bg-input border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Horário de Fim
            </label>
            <input
              type="time"
              value={config.horario_fim}
              onChange={(e) => setConfig({ ...config, horario_fim: e.target.value })}
              className="w-full h-11 px-4 rounded-lg bg-input border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </div>
      </div>

      {/* Mensagem Fora do Horário */}
      <div className={`rounded-xl bg-card border border-border p-6 transition-opacity ${config.atender_24h ? 'opacity-50 pointer-events-none' : ''}`}>
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <MessageCircle className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-foreground">Mensagem Fora do Horário</h2>
            <p className="text-sm text-muted-foreground">
              Mensagem automática enviada quando o agente está fora do horário
            </p>
          </div>
        </div>

        <textarea
          value={config.mensagem_fora_horario}
          onChange={(e) => setConfig({ ...config, mensagem_fora_horario: e.target.value })}
          rows={4}
          className="w-full px-4 py-3 rounded-lg bg-input border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-none"
          placeholder="Ex: Obrigado pelo contato! Nosso horário de atendimento é de segunda a sexta, das 8h às 18h."
        />
      </div>

      {/* Status atual */}
      <div className={`rounded-xl border p-4 ${config.atender_24h ? 'bg-primary/5 border-primary/20' : 'bg-muted/50 border-border'}`}>
        <div className="flex items-center gap-3">
          <div className={`h-3 w-3 rounded-full ${config.atender_24h ? 'bg-primary animate-pulse' : 'bg-muted-foreground'}`} />
          <span className={`text-sm font-medium ${config.atender_24h ? 'text-primary' : 'text-foreground'}`}>
            {config.atender_24h 
              ? 'Atendimento 24/7 - O agente responde a qualquer momento'
              : `Atendimento: ${config.dias_ativos.map(d => diasSemana.find(ds => ds.value === d)?.label).join(', ')} das ${config.horario_inicio} às ${config.horario_fim}`
            }
          </span>
        </div>
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
        Salvar Configurações de Horário
      </button>
    </div>
  );
}

// Tab: Configuração API
function ConfiguracaoAPITab({ 
  config, 
  setConfig, 
  onSave, 
  saving 
}: { 
  config: AgentConfig;
  setConfig: (c: AgentConfig) => void;
  onSave: () => void;
  saving: boolean;
}) {
  const { usuario } = useAuth();
  const [apiKey, setApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [loadingApiKey, setLoadingApiKey] = useState(true);
  const [savingApiKey, setSavingApiKey] = useState(false);

  useEffect(() => {
    fetchApiKey();
  }, [usuario?.conta_id]);

  const fetchApiKey = async () => {
    if (!usuario?.conta_id) return;
    
    try {
      const { data, error } = await supabase
        .from('contas')
        .select('openai_api_key')
        .eq('id', usuario.conta_id)
        .single();

      if (error) throw error;
      
      if (data?.openai_api_key) {
        setApiKey(data.openai_api_key);
      }
    } catch (error) {
      console.error('Erro ao buscar API key:', error);
    } finally {
      setLoadingApiKey(false);
    }
  };

  const saveApiKey = async () => {
    if (!usuario?.conta_id) return;

    setSavingApiKey(true);
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
      setSavingApiKey(false);
    }
  };

  const maskedApiKey = apiKey ? `sk-...${apiKey.slice(-8)}` : '';

  return (
    <div className="space-y-8 max-w-2xl">
      {/* API Key Section */}
      <div className="rounded-xl bg-card border border-border p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <Key className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-foreground">API Key da OpenAI</h2>
            <p className="text-sm text-muted-foreground">
              Configure sua chave de API para habilitar o agente de IA
            </p>
          </div>
        </div>

        {loadingApiKey ? (
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
              disabled={savingApiKey || !apiKey}
              className="flex items-center gap-2 h-10 px-6 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {savingApiKey ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Salvar API Key
            </button>
          </div>
        )}
      </div>

      {/* Model Selection */}
      <div className="rounded-xl bg-card border border-border p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <Bot className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-foreground">Modelo de IA</h2>
            <p className="text-sm text-muted-foreground">
              Escolha o modelo que será usado para gerar as respostas
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Modelo
            </label>
            <select
              value={config.modelo}
              onChange={(e) => setConfig({ ...config, modelo: e.target.value })}
              className="w-full h-11 px-4 rounded-lg bg-input border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {modelos.map((modelo) => (
                <option key={modelo.value} value={modelo.value}>
                  {modelo.label}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Temperatura ({config.temperatura})
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={config.temperatura}
                onChange={(e) => setConfig({ ...config, temperatura: parseFloat(e.target.value) })}
                className="w-full accent-primary"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Menor = mais preciso, Maior = mais criativo
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Max Tokens
              </label>
              <input
                type="number"
                value={config.max_tokens}
                onChange={(e) => setConfig({ ...config, max_tokens: parseInt(e.target.value) || 1000 })}
                min={100}
                max={4000}
                className="w-full h-11 px-4 rounded-lg bg-input border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Limite de tokens na resposta (100-4000)
              </p>
            </div>
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
            Salvar Configurações
          </button>
        </div>
      </div>

      {/* Status Info */}
      <div className={`rounded-xl border p-4 ${apiKey ? 'bg-primary/5 border-primary/20' : 'bg-destructive/5 border-destructive/20'}`}>
        <div className="flex items-center gap-3">
          <div className={`h-3 w-3 rounded-full ${apiKey ? 'bg-primary animate-pulse' : 'bg-destructive'}`} />
          <span className={`text-sm font-medium ${apiKey ? 'text-primary' : 'text-destructive'}`}>
            {apiKey ? 'API Key configurada - Agente pronto para uso' : 'API Key não configurada - Configure para habilitar o agente'}
          </span>
        </div>
      </div>
    </div>
  );
}
