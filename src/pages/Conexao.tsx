import { useState, useEffect, useCallback } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Plug, PlugZap, RefreshCw, Check, Loader2, QrCode, Power, Plus, Smartphone, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { validarEExibirErro } from '@/hooks/useValidarLimitePlano';
import { useIsMobile } from '@/hooks/use-mobile';

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
  const isMobile = useIsMobile();
  const [conexao, setConexao] = useState<Conexao | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [instanceName, setInstanceName] = useState('');
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [reconfiguringWebhook, setReconfiguringWebhook] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const fetchConexao = useCallback(async () => {
    if (!usuario?.conta_id) return;
    
    try {
      const { data, error } = await supabase
        .from('conexoes_whatsapp')
        .select('*')
        .eq('conta_id', usuario.conta_id)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setConexao(data);
        // Só mostra QR code se NÃO estiver conectado
        if (data.qrcode && data.status !== 'conectado') {
          setQrCode(data.qrcode);
        } else {
          setQrCode(null);
        }
      }
    } catch (error) {
      console.error('Erro ao buscar conexão:', error);
    } finally {
      setLoading(false);
    }
  }, [usuario?.conta_id]);

  useEffect(() => {
    fetchConexao();
  }, [fetchConexao]);

  // Auto-refresh status when aguardando
  useEffect(() => {
    if (conexao?.status === 'aguardando') {
      const interval = setInterval(() => {
        handleCheckStatus(true);
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [conexao?.status]);

  const handleCreateInstance = async () => {
    if (!instanceName.trim()) {
      toast.error('Digite o nome da conexão');
      return;
    }

    setCreating(true);
    try {
      // Validar limite do plano
      const permitido = await validarEExibirErro(usuario!.conta_id, 'conexoes');
      if (!permitido) {
        setCreating(false);
        return;
      }

      const { data, error } = await supabase.functions.invoke('evolution-create-instance', {
        body: {
          nome: instanceName.trim(),
          conta_id: usuario!.conta_id,
        },
      });

      if (error) throw error;

      if (data.error) {
        toast.error(data.error);
        return;
      }

      toast.success('Conexão criada com sucesso!');
      setInstanceName('');
      await fetchConexao();
    } catch (error) {
      console.error('Erro ao criar conexão:', error);
      toast.error('Erro ao criar conexão');
    } finally {
      setCreating(false);
    }
  };

  const handleConnect = async () => {
    if (!conexao) return;

    setConnecting(true);
    setQrCode(null);
    
    try {
      const { data, error } = await supabase.functions.invoke('evolution-connect', {
        body: { conexao_id: conexao.id },
      });

      if (error) throw error;

      if (data.error) {
        toast.error(data.error);
        return;
      }

      if (data.qrcode) {
        setQrCode(data.qrcode);
        toast.success('QR Code gerado! Escaneie com seu WhatsApp');
      }

      await fetchConexao();
    } catch (error) {
      console.error('Erro ao conectar:', error);
      toast.error('Erro ao gerar QR Code');
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!conexao) return;

    setDisconnecting(true);
    try {
      const { data, error } = await supabase.functions.invoke('evolution-disconnect', {
        body: { conexao_id: conexao.id },
      });

      if (error) throw error;

      if (data.error) {
        toast.error(data.error);
        return;
      }

      toast.success('Desconectado com sucesso');
      setQrCode(null);
      await fetchConexao();
    } catch (error) {
      console.error('Erro ao desconectar:', error);
      toast.error('Erro ao desconectar');
    } finally {
      setDisconnecting(false);
    }
  };

  const handleCheckStatus = async (silent = false) => {
    if (!conexao) return;

    setCheckingStatus(true);
    try {
      const { data, error } = await supabase.functions.invoke('evolution-connection-status', {
        body: { conexao_id: conexao.id },
      });

      if (error) throw error;

      if (data.status === 'conectado') {
        setQrCode(null);
        if (!silent) toast.success('WhatsApp conectado!');
      }

      await fetchConexao();
    } catch (error) {
      console.error('Erro ao verificar status:', error);
      if (!silent) toast.error('Erro ao verificar status');
    } finally {
      setCheckingStatus(false);
    }
  };

  const getStatusIcon = () => {
    if (!conexao) return <Plug className="h-8 w-8 text-muted-foreground" />;

    switch (conexao.status) {
      case 'conectado':
        return <PlugZap className="h-8 w-8 text-success" />;
      case 'aguardando':
        return <QrCode className="h-8 w-8 text-warning" />;
      default:
        return <Plug className="h-8 w-8 text-muted-foreground" />;
    }
  };

  const getStatusText = () => {
    if (!conexao) return 'Nenhuma instância configurada';

    switch (conexao.status) {
      case 'conectado':
        return 'Conectado';
      case 'aguardando':
        return 'Aguardando leitura do QR Code';
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

  const handleReconfigureWebhook = async () => {
    if (!conexao) return;

    setReconfiguringWebhook(true);
    try {
      const { data, error } = await supabase.functions.invoke('evolution-set-webhook', {
        body: { conexao_id: conexao.id },
      });

      if (error) throw error;

      if (data.error) {
        toast.error(data.error);
        return;
      }

      toast.success('Webhook reconfigurado com sucesso!');
    } catch (error) {
      console.error('Erro ao reconfigurar webhook:', error);
      toast.error('Erro ao reconfigurar webhook');
    } finally {
      setReconfiguringWebhook(false);
    }
  };

  const handleDeleteConnection = async () => {
    if (!conexao) return;

    setDeleting(true);
    try {
      // Chamar Edge Function que deleta da Evolution API e do banco
      const { data, error } = await supabase.functions.invoke('evolution-delete-instance', {
        body: { conexao_id: conexao.id }
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success('Conexão deletada com sucesso');
      setConexao(null);
      setQrCode(null);
      setShowDeleteConfirm(false);
    } catch (error) {
      console.error('Erro ao deletar conexão:', error);
      toast.error('Erro ao deletar conexão');
    } finally {
      setDeleting(false);
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
      <div className={`max-w-3xl space-y-6 md:space-y-8 animate-fade-in ${isMobile ? 'px-4 py-4' : ''}`}>
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Conexão WhatsApp</h1>
          <p className="text-muted-foreground mt-1 text-sm md:text-base">
            Conecte seu WhatsApp para receber e enviar mensagens.
          </p>
        </div>

        {/* Status Card */}
        <div className="p-4 md:p-6 rounded-xl bg-card border border-border">
          <div className="flex items-center gap-3 md:gap-4">
            <div
              className={`flex h-12 w-12 md:h-16 md:w-16 items-center justify-center rounded-xl flex-shrink-0 ${
                conexao?.status === 'conectado'
                  ? 'bg-success/20'
                  : conexao?.status === 'aguardando'
                  ? 'bg-warning/20'
                  : 'bg-muted'
              }`}
            >
              {getStatusIcon()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs md:text-sm text-muted-foreground">Status da Conexão</p>
              <p className={`text-lg md:text-xl font-semibold ${getStatusColor()}`}>{getStatusText()}</p>
              {conexao?.nome && (
                <p className="text-sm text-muted-foreground truncate">{conexao.nome}</p>
              )}
              {conexao?.numero && (
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <Smartphone className="h-3 w-3" />
                  {conexao.numero}
                </p>
              )}
            </div>
            {conexao?.status === 'conectado' && (
              <Check className="h-6 w-6 md:h-8 md:w-8 text-success flex-shrink-0" />
            )}
          </div>
        </div>

        {/* Criar Instância - Se não existe */}
        {!conexao && (
          <div className="p-4 md:p-6 rounded-xl bg-card border border-border space-y-4">
            <h2 className="text-lg font-semibold text-foreground">Criar Nova Instância</h2>
            <p className="text-sm text-muted-foreground">
              Crie uma instância do WhatsApp para começar a receber e enviar mensagens.
            </p>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Nome da Conexão
              </label>
              <input
                type="text"
                value={instanceName}
                onChange={(e) => setInstanceName(e.target.value)}
                placeholder="Ex: WhatsApp Vendas"
                className="w-full h-11 px-4 rounded-lg bg-input border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Nome para identificar esta conexão.
              </p>
            </div>

            <button
              onClick={handleCreateInstance}
              disabled={creating || !instanceName.trim()}
              className="w-full h-11 rounded-lg bg-primary text-primary-foreground font-medium flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {creating ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <>
                  <Plus className="h-5 w-5" />
                  Criar Instância
                </>
              )}
            </button>
          </div>
        )}

        {/* QR Code - Se aguardando */}
        {conexao && conexao.status === 'aguardando' && qrCode && (
          <div className="p-4 md:p-6 rounded-xl bg-card border border-border space-y-4">
            <h2 className="text-lg font-semibold text-foreground text-center">
              Escaneie o QR Code
            </h2>
            <p className="text-xs md:text-sm text-muted-foreground text-center">
              Abra o WhatsApp, vá em Configurações &gt; Dispositivos Conectados &gt; Conectar
            </p>
            
            <div className="flex justify-center">
              <div className="p-3 md:p-4 bg-background rounded-xl border border-border">
                <img
                  src={qrCode.startsWith('data:') ? qrCode : `data:image/png;base64,${qrCode}`}
                  alt="QR Code"
                  className="w-48 h-48 md:w-64 md:h-64"
                />
              </div>
            </div>

            <div className="flex items-center justify-center gap-2 text-xs md:text-sm text-muted-foreground">
              <RefreshCw className={`h-4 w-4 ${checkingStatus ? 'animate-spin' : ''}`} />
              <span>Verificando conexão...</span>
            </div>
          </div>
        )}

        {/* Ações - Se instância existe */}
        {conexao && (
          <div className="p-4 md:p-6 rounded-xl bg-card border border-border space-y-4">
            <h2 className="text-lg font-semibold text-foreground">Ações</h2>

            <div className={`flex gap-2 md:gap-3 ${isMobile ? 'flex-col' : 'flex-wrap'}`}>
              {conexao.status !== 'conectado' && (
                <button
                  onClick={handleConnect}
                  disabled={connecting}
                  className="w-full md:flex-1 md:min-w-[200px] h-11 rounded-lg bg-primary text-primary-foreground font-medium flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  {connecting ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <>
                      <QrCode className="h-5 w-5" />
                      {conexao.status === 'aguardando' ? 'Novo QR Code' : 'Conectar WhatsApp'}
                    </>
                  )}
                </button>
              )}

              <button
                onClick={() => handleCheckStatus(false)}
                disabled={checkingStatus}
                className="w-full md:w-auto h-11 px-6 rounded-lg bg-secondary text-secondary-foreground font-medium flex items-center justify-center gap-2 hover:bg-secondary/80 transition-colors disabled:opacity-50"
              >
                {checkingStatus ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <>
                    <RefreshCw className="h-5 w-5" />
                    Verificar Status
                  </>
                )}
              </button>

              {conexao.status !== 'conectado' && (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  disabled={deleting}
                  className="w-full md:w-auto h-11 px-6 rounded-lg bg-destructive text-destructive-foreground font-medium flex items-center justify-center gap-2 hover:bg-destructive/90 transition-colors disabled:opacity-50"
                >
                  <Trash2 className="h-5 w-5" />
                  Deletar
                </button>
              )}

              {conexao.status === 'conectado' && (
                <>
                  <button
                    onClick={handleReconfigureWebhook}
                    disabled={reconfiguringWebhook}
                    className="w-full md:w-auto h-11 px-6 rounded-lg bg-accent text-accent-foreground font-medium flex items-center justify-center gap-2 hover:bg-accent/80 transition-colors disabled:opacity-50"
                  >
                    {reconfiguringWebhook ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <>
                        <RefreshCw className="h-5 w-5" />
                        {isMobile ? 'Webhook' : 'Reconfigurar Webhook'}
                      </>
                    )}
                  </button>
                  <button
                    onClick={handleDisconnect}
                    disabled={disconnecting}
                    className="w-full md:w-auto h-11 px-6 rounded-lg bg-destructive text-destructive-foreground font-medium flex items-center justify-center gap-2 hover:bg-destructive/90 transition-colors disabled:opacity-50"
                  >
                    {disconnecting ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <>
                        <Power className="h-5 w-5" />
                        Desconectar
                      </>
                    )}
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {/* Instruções */}
        <div className="p-6 rounded-xl bg-card border border-border">
          <h2 className="text-lg font-semibold text-foreground mb-4">Como conectar</h2>
          <ol className="space-y-3 text-sm text-muted-foreground">
            <li className="flex gap-3">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/20 text-primary text-xs font-semibold flex-shrink-0">
                1
              </span>
              <span>Digite um nome para sua conexão e clique em "Criar Instância"</span>
            </li>
            <li className="flex gap-3">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/20 text-primary text-xs font-semibold flex-shrink-0">
                2
              </span>
              <span>Clique em "Conectar WhatsApp" para gerar o QR Code</span>
            </li>
            <li className="flex gap-3">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/20 text-primary text-xs font-semibold flex-shrink-0">
                3
              </span>
              <span>No seu celular, abra o WhatsApp e vá em Configurações &gt; Dispositivos Conectados</span>
            </li>
            <li className="flex gap-3">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/20 text-primary text-xs font-semibold flex-shrink-0">
                4
              </span>
              <span>Toque em "Conectar Dispositivo" e escaneie o QR Code exibido acima</span>
            </li>
            <li className="flex gap-3">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/20 text-primary text-xs font-semibold flex-shrink-0">
                5
              </span>
              <span>Aguarde a conexão ser estabelecida. O status será atualizado automaticamente</span>
            </li>
          </ol>
        </div>

        {/* Modal de Confirmação de Delete */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-card border border-border rounded-xl p-6 max-w-md w-full mx-4 space-y-4">
              <h3 className="text-lg font-semibold text-foreground">Confirmar Exclusão</h3>
              <p className="text-sm text-muted-foreground">
                Tem certeza que deseja deletar esta conexão? Esta ação não pode ser desfeita.
                Você precisará criar uma nova instância para conectar o WhatsApp novamente.
              </p>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={deleting}
                  className="h-10 px-4 rounded-lg bg-secondary text-secondary-foreground font-medium hover:bg-secondary/80 transition-colors disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleDeleteConnection}
                  disabled={deleting}
                  className="h-10 px-4 rounded-lg bg-destructive text-destructive-foreground font-medium flex items-center gap-2 hover:bg-destructive/90 transition-colors disabled:opacity-50"
                >
                  {deleting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                  Deletar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
