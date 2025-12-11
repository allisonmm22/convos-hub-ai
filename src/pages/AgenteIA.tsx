import { useState, useEffect } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Bot, Save, Clock, Calendar, Loader2, Sparkles } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface AgentConfig {
  id: string;
  nome: string;
  prompt_sistema: string;
  modelo: string;
  temperatura: number;
  max_tokens: number;
  ativo: boolean;
  horario_inicio: string;
  horario_fim: string;
  dias_ativos: number[];
  mensagem_fora_horario: string;
}

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

export default function AgenteIA() {
  const { usuario } = useAuth();
  const [config, setConfig] = useState<AgentConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (usuario?.conta_id) {
      fetchConfig();
    }
  }, [usuario]);

  const fetchConfig = async () => {
    try {
      const { data, error } = await supabase
        .from('agent_ia')
        .select('*')
        .eq('conta_id', usuario!.conta_id)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setConfig({
          ...data,
          temperatura: Number(data.temperatura),
        });
      }
    } catch (error) {
      console.error('Erro ao buscar config:', error);
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
          prompt_sistema: config.prompt_sistema,
          modelo: config.modelo,
          temperatura: config.temperatura,
          max_tokens: config.max_tokens,
          ativo: config.ativo,
          horario_inicio: config.horario_inicio,
          horario_fim: config.horario_fim,
          dias_ativos: config.dias_ativos,
          mensagem_fora_horario: config.mensagem_fora_horario,
        })
        .eq('id', config.id);

      if (error) throw error;
      toast.success('Configurações salvas com sucesso!');
    } catch (error) {
      console.error('Erro ao salvar:', error);
      toast.error('Erro ao salvar configurações');
    } finally {
      setSaving(false);
    }
  };

  const toggleDia = (dia: number) => {
    if (!config) return;

    const novosDias = config.dias_ativos.includes(dia)
      ? config.dias_ativos.filter((d) => d !== dia)
      : [...config.dias_ativos, dia].sort();

    setConfig({ ...config, dias_ativos: novosDias });
  };

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
          <p>Configuração do Agente IA não encontrada</p>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="max-w-4xl space-y-8 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Agente IA</h1>
            <p className="text-muted-foreground mt-1">
              Configure o comportamento do seu assistente virtual inteligente.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">
              {config.ativo ? 'Ativo' : 'Desativado'}
            </span>
            <button
              onClick={() => setConfig({ ...config, ativo: !config.ativo })}
              className={`relative h-6 w-11 rounded-full transition-colors ${
                config.ativo ? 'bg-primary' : 'bg-muted'
              }`}
            >
              <div
                className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
                  config.ativo ? 'translate-x-5' : ''
                }`}
              />
            </button>
          </div>
        </div>

        {/* Personalidade */}
        <div className="p-6 rounded-xl bg-card border border-border space-y-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/20">
              <Sparkles className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">Personalidade do Agente</h2>
              <p className="text-sm text-muted-foreground">
                Defina como o agente deve se comportar nas conversas
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Nome do Agente
              </label>
              <input
                type="text"
                value={config.nome}
                onChange={(e) => setConfig({ ...config, nome: e.target.value })}
                className="w-full h-11 px-4 rounded-lg bg-input border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Prompt do Sistema
              </label>
              <textarea
                value={config.prompt_sistema}
                onChange={(e) => setConfig({ ...config, prompt_sistema: e.target.value })}
                rows={6}
                className="w-full px-4 py-3 rounded-lg bg-input border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                placeholder="Descreva a personalidade e comportamento do agente..."
              />
              <p className="text-xs text-muted-foreground mt-1">
                Use este campo para definir o tom, estilo e conhecimento do agente
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Modelo</label>
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

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Temperatura: {config.temperatura}
                </label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={config.temperatura}
                  onChange={(e) =>
                    setConfig({ ...config, temperatura: parseFloat(e.target.value) })
                  }
                  className="w-full h-11 accent-primary"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Preciso</span>
                  <span>Criativo</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Horário de Funcionamento */}
        <div className="p-6 rounded-xl bg-card border border-border space-y-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-warning/20">
              <Clock className="h-5 w-5 text-warning" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">Horário de Funcionamento</h2>
              <p className="text-sm text-muted-foreground">
                Defina quando o agente deve responder automaticamente
              </p>
            </div>
          </div>

          <div className="space-y-4">
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

            <div>
              <label className="block text-sm font-medium text-foreground mb-3">
                Dias de Funcionamento
              </label>
              <div className="flex gap-2">
                {diasSemana.map((dia) => (
                  <button
                    key={dia.value}
                    onClick={() => toggleDia(dia.value)}
                    className={`h-10 w-12 rounded-lg text-sm font-medium transition-colors ${
                      config.dias_ativos.includes(dia.value)
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground hover:bg-muted/80'
                    }`}
                  >
                    {dia.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Mensagem Fora do Horário
              </label>
              <textarea
                value={config.mensagem_fora_horario}
                onChange={(e) => setConfig({ ...config, mensagem_fora_horario: e.target.value })}
                rows={3}
                className="w-full px-4 py-3 rounded-lg bg-input border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                placeholder="Mensagem enviada quando o agente está fora do horário..."
              />
            </div>
          </div>
        </div>

        {/* Botão Salvar */}
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full h-12 rounded-xl bg-primary text-primary-foreground font-semibold flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors disabled:opacity-50 shadow-glow"
        >
          {saving ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <>
              <Save className="h-5 w-5" />
              Salvar Configurações
            </>
          )}
        </button>
      </div>
    </MainLayout>
  );
}
