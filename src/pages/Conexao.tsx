import { useState, useEffect, useCallback } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Plug, PlugZap, RefreshCw, Check, Loader2, QrCode, Power, Plus, Smartphone, Trash2, Globe, Zap, Info, ExternalLink, Copy, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { validarEExibirErro } from '@/hooks/useValidarLimitePlano';
import { useIsMobile } from '@/hooks/use-mobile';

type TipoProvedor = 'evolution' | 'meta';

interface Conexao {
  id: string;
  nome: string;
  instance_name: string;
  token: string;
  webhook_url: string | null;
  status: 'conectado' | 'desconectado' | 'aguardando';
  qrcode: string | null;
  numero: string | null;
  tipo_provedor: TipoProvedor;
  meta_phone_number_id: string | null;
  meta_business_account_id: string | null;
  meta_access_token: string | null;
  meta_webhook_verify_token: string | null;
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
  
  // Novos estados para Meta API
  const [tipoProvedor, setTipoProvedor] = useState<TipoProvedor>('evolution');
  const [metaPhoneNumberId, setMetaPhoneNumberId] = useState('');
  const [metaBusinessAccountId, setMetaBusinessAccountId] = useState('');
  const [metaAccessToken, setMetaAccessToken] = useState('');
  const [metaWebhookVerifyToken, setMetaWebhookVerifyToken] = useState('');
  const [savingMeta, setSavingMeta] = useState(false);
  const [copiedWebhook, setCopiedWebhook] = useState(false);

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
        setConexao(data as Conexao);
        // Só mostra QR code se NÃO estiver conectado e for Evolution
        if (data.qrcode && data.status !== 'conectado' && data.tipo_provedor !== 'meta') {
          setQrCode(data.qrcode);
        } else {
          setQrCode(null);
        }
        // Se existir conexão Meta, preencher campos
        if (data.tipo_provedor === 'meta') {
          setMetaPhoneNumberId(data.meta_phone_number_id || '');
          setMetaBusinessAccountId(data.meta_business_account_id || '');
          setMetaAccessToken(data.meta_access_token || '');
          setMetaWebhookVerifyToken(data.meta_webhook_verify_token || '');
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

  // Auto-refresh status when aguardando (apenas para Evolution)
  useEffect(() => {
    if (conexao?.status === 'aguardando' && conexao?.tipo_provedor !== 'meta') {
      const interval = setInterval(() => {
        handleCheckStatus(true);
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [conexao?.status, conexao?.tipo_provedor]);

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

  // Criar conexão Meta API
  const handleCreateMetaConnection = async () => {
    if (!instanceName.trim()) {
      toast.error('Digite o nome da conexão');
      return;
    }

    if (!metaPhoneNumberId.trim() || !metaAccessToken.trim()) {
      toast.error('Preencha Phone Number ID e Access Token');
      return;
    }

    setCreating(true);
    try {
      const permitido = await validarEExibirErro(usuario!.conta_id, 'conexoes');
      if (!permitido) {
        setCreating(false);
        return;
      }

      // Gerar instance_name único para Meta
      const instanceKey = `meta_${usuario!.conta_id.slice(0, 8)}_${Date.now().toString(36)}`;
      const verifyToken = `verify_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;

      const { error } = await supabase
        .from('conexoes_whatsapp')
        .insert({
          nome: instanceName.trim(),
          instance_name: instanceKey,
          token: 'meta-api',
          conta_id: usuario!.conta_id,
          tipo_provedor: 'meta',
          status: 'conectado', // Meta API não usa QR Code
          meta_phone_number_id: metaPhoneNumberId.trim(),
          meta_business_account_id: metaBusinessAccountId.trim() || null,
          meta_access_token: metaAccessToken.trim(),
          meta_webhook_verify_token: verifyToken,
        });

      if (error) throw error;

      toast.success('Conexão Meta API criada com sucesso!');
      setInstanceName('');
      setMetaPhoneNumberId('');
      setMetaBusinessAccountId('');
      setMetaAccessToken('');
      await fetchConexao();
    } catch (error) {
      console.error('Erro ao criar conexão Meta:', error);
      toast.error('Erro ao criar conexão Meta API');
    } finally {
      setCreating(false);
    }
  };

  // Salvar/Atualizar credenciais Meta
  const handleSaveMetaCredentials = async () => {
    if (!conexao) return;

    if (!metaPhoneNumberId.trim() || !metaAccessToken.trim()) {
      toast.error('Preencha Phone Number ID e Access Token');
      return;
    }

    setSavingMeta(true);
    try {
      const { error } = await supabase
        .from('conexoes_whatsapp')
        .update({
          meta_phone_number_id: metaPhoneNumberId.trim(),
          meta_business_account_id: metaBusinessAccountId.trim() || null,
          meta_access_token: metaAccessToken.trim(),
          status: 'conectado',
        })
        .eq('id', conexao.id);

      if (error) throw error;

      toast.success('Credenciais atualizadas com sucesso!');
      await fetchConexao();
    } catch (error) {
      console.error('Erro ao salvar credenciais:', error);
      toast.error('Erro ao salvar credenciais');
    } finally {
      setSavingMeta(false);
    }
  };

  const [copiedVerifyToken, setCopiedVerifyToken] = useState(false);

  const getMetaWebhookUrl = () => {
    return `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/meta-verify-webhook`;
  };

  const copyWebhookUrl = () => {
    const webhookUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-webhook`;
    navigator.clipboard.writeText(webhookUrl);
    setCopiedWebhook(true);
    toast.success('URL copiada!');
    setTimeout(() => setCopiedWebhook(false), 2000);
  };

  const copyMetaWebhookUrl = () => {
    navigator.clipboard.writeText(getMetaWebhookUrl());
    setCopiedWebhook(true);
    toast.success('URL do Webhook copiada!');
    setTimeout(() => setCopiedWebhook(false), 2000);
  };

  const copyVerifyToken = () => {
    if (conexao?.meta_webhook_verify_token) {
      navigator.clipboard.writeText(conexao.meta_webhook_verify_token);
      setCopiedVerifyToken(true);
      toast.success('Token de verificação copiado!');
      setTimeout(() => setCopiedVerifyToken(false), 2000);
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
      if (conexao.tipo_provedor === 'meta') {
        // Para Meta API, só deletar do banco
        const { error } = await supabase
          .from('conexoes_whatsapp')
          .delete()
          .eq('id', conexao.id);

        if (error) throw error;
      } else {
        // Para Evolution, chamar Edge Function
        const { data, error } = await supabase.functions.invoke('evolution-delete-instance', {
          body: { conexao_id: conexao.id }
        });

        if (error) throw error;
        if (data?.error) throw new Error(data.error);
      }

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
                <div className="flex items-center gap-2">
                  <p className="text-sm text-muted-foreground truncate">{conexao.nome}</p>
                  {conexao.tipo_provedor === 'meta' && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400">Meta API</span>
                  )}
                  {conexao.tipo_provedor === 'evolution' && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400">Evolution</span>
                  )}
                </div>
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
          <div className="p-4 md:p-6 rounded-xl bg-card border border-border space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Criar Nova Conexão</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Escolha o tipo de conexão e configure sua integração com WhatsApp.
              </p>
            </div>

            {/* Seletor de Tipo de Provedor */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <button
                onClick={() => setTipoProvedor('evolution')}
                className={`p-4 rounded-xl border-2 text-left transition-all ${
                  tipoProvedor === 'evolution'
                    ? 'border-emerald-500 bg-emerald-500/10'
                    : 'border-border hover:border-muted-foreground/50'
                }`}
              >
                <div className="flex items-center gap-3 mb-2">
                  <div className="h-10 w-10 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                    <Zap className="h-5 w-5 text-emerald-500" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">Evolution API</h3>
                    <p className="text-xs text-muted-foreground">Via QR Code</p>
                  </div>
                </div>
                <ul className="text-xs text-muted-foreground space-y-1 ml-13">
                  <li className="flex items-center gap-1"><Check className="h-3 w-3 text-emerald-500" /> Gratuito</li>
                  <li className="flex items-center gap-1"><Check className="h-3 w-3 text-emerald-500" /> Conexão rápida</li>
                  <li className="flex items-center gap-1"><Info className="h-3 w-3 text-amber-500" /> Não-oficial</li>
                </ul>
              </button>

              <button
                onClick={() => setTipoProvedor('meta')}
                className={`p-4 rounded-xl border-2 text-left transition-all ${
                  tipoProvedor === 'meta'
                    ? 'border-blue-500 bg-blue-500/10'
                    : 'border-border hover:border-muted-foreground/50'
                }`}
              >
                <div className="flex items-center gap-3 mb-2">
                  <div className="h-10 w-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                    <Globe className="h-5 w-5 text-blue-500" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">Meta Business API</h3>
                    <p className="text-xs text-muted-foreground">Oficial</p>
                  </div>
                </div>
                <ul className="text-xs text-muted-foreground space-y-1 ml-13">
                  <li className="flex items-center gap-1"><Check className="h-3 w-3 text-blue-500" /> API Oficial</li>
                  <li className="flex items-center gap-1"><Check className="h-3 w-3 text-blue-500" /> Zero risco de ban</li>
                  <li className="flex items-center gap-1"><Info className="h-3 w-3 text-amber-500" /> Pago por mensagem</li>
                </ul>
              </button>
            </div>

            {/* Nome da Conexão (comum para ambos) */}
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
            </div>

            {/* Campos específicos para Meta API */}
            {tipoProvedor === 'meta' && (
              <div className="space-y-4 pt-2 border-t border-border">
                <div className="flex items-center gap-2 text-sm text-blue-400">
                  <Info className="h-4 w-4" />
                  <span>Configure as credenciais do Meta Business</span>
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Phone Number ID *
                  </label>
                  <input
                    type="text"
                    value={metaPhoneNumberId}
                    onChange={(e) => setMetaPhoneNumberId(e.target.value)}
                    placeholder="Ex: 123456789012345"
                    className="w-full h-11 px-4 rounded-lg bg-input border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Encontre no Facebook Developer {'>'} WhatsApp {'>'} API Setup
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Business Account ID
                  </label>
                  <input
                    type="text"
                    value={metaBusinessAccountId}
                    onChange={(e) => setMetaBusinessAccountId(e.target.value)}
                    placeholder="Ex: 123456789012345"
                    className="w-full h-11 px-4 rounded-lg bg-input border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Opcional - necessário para buscar templates
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Access Token *
                  </label>
                  <input
                    type="password"
                    value={metaAccessToken}
                    onChange={(e) => setMetaAccessToken(e.target.value)}
                    placeholder="Token de acesso permanente"
                    className="w-full h-11 px-4 rounded-lg bg-input border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Gere um token permanente no Facebook Developer
                  </p>
                </div>

                <a 
                  href="https://developers.facebook.com/docs/whatsapp/cloud-api/get-started"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300"
                >
                  <ExternalLink className="h-4 w-4" />
                  Guia de configuração Meta API
                </a>
              </div>
            )}

            {/* Botão de Criar */}
            {tipoProvedor === 'evolution' ? (
              <button
                onClick={handleCreateInstance}
                disabled={creating || !instanceName.trim()}
                className="w-full h-11 rounded-lg bg-emerald-600 text-white font-medium flex items-center justify-center gap-2 hover:bg-emerald-700 transition-colors disabled:opacity-50"
              >
                {creating ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <>
                    <Zap className="h-5 w-5" />
                    Criar Instância Evolution
                  </>
                )}
              </button>
            ) : (
              <button
                onClick={handleCreateMetaConnection}
                disabled={creating || !instanceName.trim() || !metaPhoneNumberId.trim() || !metaAccessToken.trim()}
                className="w-full h-11 rounded-lg bg-blue-600 text-white font-medium flex items-center justify-center gap-2 hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {creating ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <>
                    <Globe className="h-5 w-5" />
                    Criar Conexão Meta API
                  </>
                )}
              </button>
            )}
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
              {conexao.status !== 'conectado' && conexao.tipo_provedor === 'evolution' && (
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

              {conexao.status !== 'conectado' && conexao.tipo_provedor === 'evolution' && (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  disabled={deleting}
                  className="w-full md:w-auto h-11 px-6 rounded-lg bg-destructive text-destructive-foreground font-medium flex items-center justify-center gap-2 hover:bg-destructive/90 transition-colors disabled:opacity-50"
                >
                  <Trash2 className="h-5 w-5" />
                  Deletar
                </button>
              )}

              {conexao.status === 'conectado' && conexao.tipo_provedor === 'evolution' && (
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

              {/* Deletar para Meta API */}
              {conexao.tipo_provedor === 'meta' && (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  disabled={deleting}
                  className="w-full md:w-auto h-11 px-6 rounded-lg bg-destructive text-destructive-foreground font-medium flex items-center justify-center gap-2 hover:bg-destructive/90 transition-colors disabled:opacity-50"
                >
                  <Trash2 className="h-5 w-5" />
                  Deletar Conexão
                </button>
              )}
            </div>
          </div>
        )}

        {/* Configuração do Webhook Meta API */}
        {conexao && conexao.tipo_provedor === 'meta' && (
          <div className="p-4 md:p-6 rounded-xl bg-card border border-blue-500/30 space-y-4">
            <div className="flex items-center gap-2">
              <Globe className="h-5 w-5 text-blue-500" />
              <h2 className="text-lg font-semibold text-foreground">Configurar Webhook Meta</h2>
            </div>
            
            <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
              <p className="text-sm text-blue-400 mb-3">
                Configure o webhook no Facebook Developer para receber mensagens.
              </p>
              
              {/* URL do Webhook */}
              <div className="space-y-2 mb-4">
                <label className="block text-sm font-medium text-foreground">URL do Webhook</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={getMetaWebhookUrl()}
                    readOnly
                    className="flex-1 h-10 px-3 rounded-lg bg-input border border-border text-foreground text-sm"
                  />
                  <button
                    onClick={copyMetaWebhookUrl}
                    className="h-10 px-4 rounded-lg bg-blue-600 text-white flex items-center gap-2 hover:bg-blue-700 transition-colors"
                  >
                    {copiedWebhook ? <CheckCircle2 className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Token de Verificação */}
              <div className="space-y-2 mb-4">
                <label className="block text-sm font-medium text-foreground">Token de Verificação</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={conexao.meta_webhook_verify_token || ''}
                    readOnly
                    className="flex-1 h-10 px-3 rounded-lg bg-input border border-border text-foreground text-sm font-mono"
                  />
                  <button
                    onClick={copyVerifyToken}
                    className="h-10 px-4 rounded-lg bg-blue-600 text-white flex items-center gap-2 hover:bg-blue-700 transition-colors"
                  >
                    {copiedVerifyToken ? <CheckCircle2 className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Instruções */}
              <div className="border-t border-blue-500/20 pt-4 mt-4">
                <h3 className="text-sm font-semibold text-foreground mb-3">Passo a passo:</h3>
                <ol className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-500/20 text-blue-400 text-xs font-semibold flex-shrink-0">1</span>
                    <span>Acesse <a href="https://developers.facebook.com/apps" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">Facebook Developer</a> e selecione seu app</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-500/20 text-blue-400 text-xs font-semibold flex-shrink-0">2</span>
                    <span>Vá em WhatsApp {'>'} Configuration {'>'} Webhook</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-500/20 text-blue-400 text-xs font-semibold flex-shrink-0">3</span>
                    <span>Clique em "Edit" e cole a <strong>URL do Webhook</strong> acima</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-500/20 text-blue-400 text-xs font-semibold flex-shrink-0">4</span>
                    <span>Cole o <strong>Token de Verificação</strong> no campo "Verify token"</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-500/20 text-blue-400 text-xs font-semibold flex-shrink-0">5</span>
                    <span>Clique em "Verify and save"</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-500/20 text-blue-400 text-xs font-semibold flex-shrink-0">6</span>
                    <span>Em "Webhook fields", ative <strong>messages</strong></span>
                  </li>
                </ol>
              </div>
            </div>

            <a 
              href="https://developers.facebook.com/docs/whatsapp/cloud-api/guides/set-up-webhooks"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300"
            >
              <ExternalLink className="h-4 w-4" />
              Documentação oficial do webhook
            </a>
          </div>
        )}

        {/* Editar credenciais Meta */}
        {conexao && conexao.tipo_provedor === 'meta' && (
          <div className="p-4 md:p-6 rounded-xl bg-card border border-border space-y-4">
            <h2 className="text-lg font-semibold text-foreground">Credenciais Meta API</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Phone Number ID</label>
                <input
                  type="text"
                  value={metaPhoneNumberId}
                  onChange={(e) => setMetaPhoneNumberId(e.target.value)}
                  placeholder="Ex: 123456789012345"
                  className="w-full h-11 px-4 rounded-lg bg-input border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Business Account ID</label>
                <input
                  type="text"
                  value={metaBusinessAccountId}
                  onChange={(e) => setMetaBusinessAccountId(e.target.value)}
                  placeholder="Ex: 123456789012345"
                  className="w-full h-11 px-4 rounded-lg bg-input border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Access Token</label>
                <input
                  type="password"
                  value={metaAccessToken}
                  onChange={(e) => setMetaAccessToken(e.target.value)}
                  placeholder="Token de acesso permanente"
                  className="w-full h-11 px-4 rounded-lg bg-input border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <button
                onClick={handleSaveMetaCredentials}
                disabled={savingMeta || !metaPhoneNumberId.trim() || !metaAccessToken.trim()}
                className="w-full h-11 rounded-lg bg-blue-600 text-white font-medium flex items-center justify-center gap-2 hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {savingMeta ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <>
                    <Check className="h-5 w-5" />
                    Salvar Credenciais
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Instruções - Apenas para Evolution */}
        {(!conexao || conexao.tipo_provedor === 'evolution') && (
          <div className="p-6 rounded-xl bg-card border border-border">
            <h2 className="text-lg font-semibold text-foreground mb-4">Como conectar (Evolution API)</h2>
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
        )}

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
