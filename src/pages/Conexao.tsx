import { useState, useEffect } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Plug, PlugZap, RefreshCw, Check, X, Loader2, Copy, ExternalLink } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface Conexao {
  id: string;
  nome: string;
  instance_name: string;
  token: string;
  webhook_url: string | null;
  status: 'conectado' | 'desconectado' | 'aguardando';
  qrcode: string | null;
  numero: string | null;
}

export default function Conexao() {
  const { usuario } = useAuth();
  const [conexao, setConexao] = useState<Conexao | null>(null);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    nome: 'Principal',
    instance_name: '',
    token: '',
    webhook_url: '',
  });

  useEffect(() => {
    if (usuario?.conta_id) {
      fetchConexao();
    }
  }, [usuario]);

  const fetchConexao = async () => {
    try {
      const { data, error } = await supabase
        .from('conexoes_whatsapp')
        .select('*')
        .eq('conta_id', usuario!.conta_id)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setConexao(data);
        setFormData({
          nome: data.nome,
          instance_name: data.instance_name,
          token: data.token,
          webhook_url: data.webhook_url || '',
        });
      }
    } catch (error) {
      console.error('Erro ao buscar conexão:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!formData.instance_name || !formData.token) {
      toast.error('Preencha o nome da instância e o token');
      return;
    }

    setSaving(true);
    try {
      const webhookUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-webhook`;

      if (conexao) {
        const { error } = await supabase
          .from('conexoes_whatsapp')
          .update({
            ...formData,
            webhook_url: webhookUrl,
          })
          .eq('id', conexao.id);

        if (error) throw error;
      } else {
        const { error } = await supabase.from('conexoes_whatsapp').insert({
          conta_id: usuario!.conta_id,
          ...formData,
          webhook_url: webhookUrl,
        });

        if (error) throw error;
      }

      toast.success('Conexão salva com sucesso!');
      fetchConexao();
    } catch (error) {
      console.error('Erro ao salvar:', error);
      toast.error('Erro ao salvar conexão');
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async () => {
    if (!conexao) {
      toast.error('Salve a conexão primeiro');
      return;
    }

    setTesting(true);
    try {
      const { data, error } = await supabase.functions.invoke('test-evolution-connection', {
        body: {
          instance_name: conexao.instance_name,
          token: conexao.token,
        },
      });

      if (error) throw error;

      if (data.connected) {
        await supabase
          .from('conexoes_whatsapp')
          .update({ status: 'conectado', numero: data.numero })
          .eq('id', conexao.id);

        toast.success('Conexão estabelecida com sucesso!');
        fetchConexao();
      } else {
        toast.error(data.message || 'Falha na conexão');
      }
    } catch (error) {
      console.error('Erro ao testar:', error);
      toast.error('Erro ao testar conexão');
    } finally {
      setTesting(false);
    }
  };

  const copyWebhookUrl = () => {
    const webhookUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-webhook`;
    navigator.clipboard.writeText(webhookUrl);
    toast.success('URL copiada!');
  };

  const getStatusIcon = () => {
    if (!conexao) return <Plug className="h-8 w-8 text-muted-foreground" />;

    switch (conexao.status) {
      case 'conectado':
        return <PlugZap className="h-8 w-8 text-success" />;
      case 'aguardando':
        return <RefreshCw className="h-8 w-8 text-warning animate-spin" />;
      default:
        return <Plug className="h-8 w-8 text-muted-foreground" />;
    }
  };

  const getStatusText = () => {
    if (!conexao) return 'Não configurado';

    switch (conexao.status) {
      case 'conectado':
        return 'Conectado';
      case 'aguardando':
        return 'Aguardando QR Code';
      default:
        return 'Desconectado';
    }
  };

  const getStatusColor = () => {
    if (!conexao) return 'text-muted-foreground';

    switch (conexao.status) {
      case 'conectado':
        return 'text-success';
      case 'aguardando':
        return 'text-warning';
      default:
        return 'text-muted-foreground';
    }
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

  return (
    <MainLayout>
      <div className="max-w-3xl space-y-8 animate-fade-in">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Conexão WhatsApp</h1>
          <p className="text-muted-foreground mt-1">
            Configure sua integração com a Evolution API para receber e enviar mensagens.
          </p>
        </div>

        {/* Status Card */}
        <div className="p-6 rounded-xl bg-card border border-border">
          <div className="flex items-center gap-4">
            <div
              className={`flex h-16 w-16 items-center justify-center rounded-xl ${
                conexao?.status === 'conectado' ? 'bg-success/20' : 'bg-muted'
              }`}
            >
              {getStatusIcon()}
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Status da Conexão</p>
              <p className={`text-xl font-semibold ${getStatusColor()}`}>{getStatusText()}</p>
              {conexao?.numero && (
                <p className="text-sm text-muted-foreground">Número: {conexao.numero}</p>
              )}
            </div>
            {conexao?.status === 'conectado' && (
              <Check className="ml-auto h-8 w-8 text-success" />
            )}
          </div>
        </div>

        {/* Formulário */}
        <div className="p-6 rounded-xl bg-card border border-border space-y-6">
          <h2 className="text-lg font-semibold text-foreground">Configurações da Evolution API</h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Nome da Instância
              </label>
              <input
                type="text"
                value={formData.instance_name}
                onChange={(e) => setFormData({ ...formData, instance_name: e.target.value })}
                placeholder="minha-instancia"
                className="w-full h-11 px-4 rounded-lg bg-input border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <p className="text-xs text-muted-foreground mt-1">
                O nome da instância configurada na Evolution API
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Token da API
              </label>
              <input
                type="password"
                value={formData.token}
                onChange={(e) => setFormData({ ...formData, token: e.target.value })}
                placeholder="••••••••••••••••"
                className="w-full h-11 px-4 rounded-lg bg-input border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <p className="text-xs text-muted-foreground mt-1">
                O token de autenticação da sua Evolution API
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Webhook URL
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-webhook`}
                  readOnly
                  className="flex-1 h-11 px-4 rounded-lg bg-muted border border-border text-muted-foreground"
                />
                <button
                  onClick={copyWebhookUrl}
                  className="h-11 px-4 rounded-lg bg-muted hover:bg-muted/80 transition-colors flex items-center gap-2"
                >
                  <Copy className="h-4 w-4" />
                </button>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Configure esta URL como webhook na sua Evolution API
              </p>
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 h-11 rounded-lg bg-primary text-primary-foreground font-medium flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {saving ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <>
                  <Check className="h-5 w-5" />
                  Salvar Configurações
                </>
              )}
            </button>

            <button
              onClick={handleTestConnection}
              disabled={testing || !conexao}
              className="h-11 px-6 rounded-lg bg-secondary text-secondary-foreground font-medium flex items-center gap-2 hover:bg-secondary/80 transition-colors disabled:opacity-50"
            >
              {testing ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <>
                  <RefreshCw className="h-5 w-5" />
                  Testar Conexão
                </>
              )}
            </button>
          </div>
        </div>

        {/* Instruções */}
        <div className="p-6 rounded-xl bg-card border border-border">
          <h2 className="text-lg font-semibold text-foreground mb-4">Como configurar</h2>
          <ol className="space-y-3 text-sm text-muted-foreground">
            <li className="flex gap-3">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/20 text-primary text-xs font-semibold flex-shrink-0">
                1
              </span>
              <span>Acesse seu painel da Evolution API e crie uma nova instância</span>
            </li>
            <li className="flex gap-3">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/20 text-primary text-xs font-semibold flex-shrink-0">
                2
              </span>
              <span>Copie o nome da instância e o token de API</span>
            </li>
            <li className="flex gap-3">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/20 text-primary text-xs font-semibold flex-shrink-0">
                3
              </span>
              <span>Cole as informações acima e clique em "Salvar Configurações"</span>
            </li>
            <li className="flex gap-3">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/20 text-primary text-xs font-semibold flex-shrink-0">
                4
              </span>
              <span>Configure o Webhook URL acima no painel da Evolution API</span>
            </li>
            <li className="flex gap-3">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/20 text-primary text-xs font-semibold flex-shrink-0">
                5
              </span>
              <span>Clique em "Testar Conexão" para verificar se tudo está funcionando</span>
            </li>
          </ol>
        </div>
      </div>
    </MainLayout>
  );
}
