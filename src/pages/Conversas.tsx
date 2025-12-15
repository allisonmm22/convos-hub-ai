import { useState, useEffect, useRef, useCallback } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import {
  Search,
  Send,
  Bot,
  MoreVertical,
  Phone,
  Paperclip,
  Smile,
  Check,
  CheckCheck,
  MessageSquare as MessageSquareIcon,
  X,
  Activity,
  Image,
  FileText,
  Mic,
  XCircle,
  ArrowRightLeft,
  UserCheck,
  Filter,
  Wifi,
  WifiOff,
  RefreshCw,
  User,
  ChevronDown,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { AudioRecorder } from '@/components/AudioRecorder';
import { AudioPlayer } from '@/components/AudioPlayer';
import { ContatoSidebar } from '@/components/ContatoSidebar';

interface Contato {
  id: string;
  nome: string;
  telefone: string;
  avatar_url: string | null;
}

interface Usuario {
  id: string;
  nome: string;
  email: string;
}

interface AgenteIA {
  id: string;
  nome: string | null;
  ativo: boolean | null;
  tipo: string | null;
}

interface Conversa {
  id: string;
  contato_id: string;
  conexao_id: string | null;
  agente_ia_ativo: boolean | null;
  agente_ia_id: string | null;
  atendente_id: string | null;
  ultima_mensagem: string | null;
  ultima_mensagem_at: string | null;
  nao_lidas: number | null;
  status?: string | null;
  contatos: Contato;
  agent_ia?: AgenteIA | null;
}

interface MensagemMetadata {
  interno?: boolean;
  acao_tipo?: string;
  acao_valor?: string;
  [key: string]: unknown;
}

interface Mensagem {
  id: string;
  conversa_id: string;
  conteudo: string;
  direcao: 'entrada' | 'saida';
  created_at: string;
  enviada_por_ia: boolean;
  enviada_por_dispositivo: boolean | null;
  lida: boolean;
  tipo: 'texto' | 'imagem' | 'audio' | 'video' | 'documento' | 'sticker' | 'sistema' | null;
  media_url: string | null;
  metadata?: MensagemMetadata | null;
}

interface Conexao {
  id: string;
  instance_name: string;
  status: 'conectado' | 'desconectado' | 'aguardando' | null;
  numero: string | null;
}

type StatusFilter = 'todos' | 'em_atendimento' | 'aguardando_cliente' | 'encerrado';

export default function Conversas() {
  const { usuario } = useAuth();
  const [conversas, setConversas] = useState<Conversa[]>([]);
  const [conversaSelecionada, setConversaSelecionada] = useState<Conversa | null>(null);
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [novaMensagem, setNovaMensagem] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('todos');
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [uploading, setUploading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileType, setFileType] = useState<'imagem' | 'documento' | 'audio'>('imagem');
  const [imagemExpandida, setImagemExpandida] = useState<string | null>(null);
  const [showContatoSidebar, setShowContatoSidebar] = useState(false);
  const [agentesDisponiveis, setAgentesDisponiveis] = useState<AgenteIA[]>([]);
  const [showAgenteDropdown, setShowAgenteDropdown] = useState(false);
  const agenteDropdownRef = useRef<HTMLDivElement>(null);
  
  // Ref para manter a conversa selecionada atualizada no realtime
  const conversaSelecionadaRef = useRef<Conversa | null>(null);
  
  // Estado da conexão WhatsApp
  const [conexao, setConexao] = useState<Conexao | null>(null);
  const [pollingActive, setPollingActive] = useState(false);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Buscar conexão WhatsApp
  const fetchConexao = useCallback(async () => {
    if (!usuario?.conta_id) return;
    
    try {
      const { data, error } = await supabase
        .from('conexoes_whatsapp')
        .select('id, instance_name, status, numero')
        .eq('conta_id', usuario.conta_id)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Erro ao buscar conexão:', error);
        return;
      }

      setConexao(data);
    } catch (error) {
      console.error('Erro ao buscar conexão:', error);
    }
  }, [usuario?.conta_id]);

  // Polling de mensagens
  const pollMessages = useCallback(async () => {
    if (!conexao?.id || conexao.status !== 'conectado') return;
    
    try {
      console.log('Polling mensagens...');
      const { data, error } = await supabase.functions.invoke('evolution-fetch-messages', {
        body: { conexao_id: conexao.id },
      });

      if (error) {
        console.error('Erro no polling:', error);
        return;
      }

      if (data?.processed > 0) {
        console.log('Mensagens processadas via polling:', data.processed);
        fetchConversas();
      }
    } catch (error) {
      console.error('Erro no polling:', error);
    }
  }, [conexao?.id, conexao?.status]);

  // Iniciar/parar polling
  useEffect(() => {
    if (conexao?.status === 'conectado' && !pollingActive) {
      setPollingActive(true);
      // Polling a cada 10 segundos
      pollingIntervalRef.current = setInterval(pollMessages, 10000);
      // Executar imediatamente
      pollMessages();
    } else if (conexao?.status !== 'conectado' && pollingActive) {
      setPollingActive(false);
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    }

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, [conexao?.status, pollingActive, pollMessages]);

  useEffect(() => {
    if (usuario?.conta_id) {
      fetchConversas();
      fetchUsuarios();
      fetchAgentes();
      fetchConexao();
      const cleanup = setupRealtimeSubscription();
      
      // Verificar status da conexão periodicamente
      const statusInterval = setInterval(fetchConexao, 30000);
      
      return () => {
        cleanup();
        clearInterval(statusInterval);
      };
    }
  }, [usuario, fetchConexao]);

  // Fechar dropdown ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (agenteDropdownRef.current && !agenteDropdownRef.current.contains(event.target as Node)) {
        setShowAgenteDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Manter a ref sincronizada com o estado
  useEffect(() => {
    conversaSelecionadaRef.current = conversaSelecionada;
  }, [conversaSelecionada]);

  useEffect(() => {
    if (conversaSelecionada) {
      fetchMensagens(conversaSelecionada.id);
      marcarComoLida(conversaSelecionada.id);
    }
  }, [conversaSelecionada]);

  useEffect(() => {
    scrollToBottom();
  }, [mensagens]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const setupRealtimeSubscription = () => {
    const channel = supabase
      .channel('conversas-mensagens-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'mensagens' },
        (payload) => {
          console.log('Nova mensagem recebida via realtime:', payload);
          const novaMensagem = payload.new as Mensagem;
          // Usar a ref para verificar a conversa selecionada atual
          if (conversaSelecionadaRef.current && novaMensagem.conversa_id === conversaSelecionadaRef.current.id) {
            setMensagens((prev) => [...prev, novaMensagem]);
          }
          fetchConversas();
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'conversas' },
        (payload) => {
          console.log('Nova conversa recebida via realtime:', payload);
          fetchConversas();
          // Notificação sonora para nova conversa
          try {
            const audio = new Audio('/notification.mp3');
            audio.volume = 0.3;
            audio.play().catch(() => {});
          } catch {}
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'conversas' },
        () => {
          fetchConversas();
        }
      )
      .subscribe((status) => {
        console.log('Status da subscription realtime:', status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const fetchConversas = async () => {
    try {
      const { data, error } = await supabase
        .from('conversas')
        .select(`*, contatos(*), agent_ia:agente_ia_id(id, nome, ativo, tipo)`)
        .eq('conta_id', usuario!.conta_id)
        .eq('arquivada', false)
        .order('ultima_mensagem_at', { ascending: false });

      if (error) throw error;
      setConversas(data || []);
    } catch (error) {
      console.error('Erro ao buscar conversas:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUsuarios = async () => {
    try {
      const { data, error } = await supabase
        .from('usuarios')
        .select('id, nome, email')
        .eq('conta_id', usuario!.conta_id);

      if (error) throw error;
      setUsuarios(data || []);
    } catch (error) {
      console.error('Erro ao buscar usuários:', error);
    }
  };

  const fetchAgentes = async () => {
    try {
      const { data, error } = await supabase
        .from('agent_ia')
        .select('id, nome, ativo, tipo')
        .eq('conta_id', usuario!.conta_id)
        .eq('ativo', true)
        .order('tipo', { ascending: false }); // principal primeiro

      if (error) throw error;
      setAgentesDisponiveis(data || []);
    } catch (error) {
      console.error('Erro ao buscar agentes:', error);
    }
  };

  const trocarAgente = async (agenteId: string) => {
    if (!conversaSelecionada) return;

    try {
      const agenteEscolhido = agentesDisponiveis.find(a => a.id === agenteId);
      
      await supabase
        .from('conversas')
        .update({ 
          agente_ia_id: agenteId,
          agente_ia_ativo: true 
        })
        .eq('id', conversaSelecionada.id);

      setConversaSelecionada({ 
        ...conversaSelecionada, 
        agente_ia_id: agenteId,
        agente_ia_ativo: true,
        agent_ia: agenteEscolhido || null
      });
      
      setShowAgenteDropdown(false);
      toast.success(`Agente alterado para ${agenteEscolhido?.nome || 'Agente IA'}`);
    } catch (error) {
      toast.error('Erro ao alterar agente');
    }
  };

  const fetchMensagens = async (conversaId: string) => {
    try {
      const { data, error } = await supabase
        .from('mensagens')
        .select('*')
        .eq('conversa_id', conversaId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setMensagens((data || []) as unknown as Mensagem[]);
    } catch (error) {
      console.error('Erro ao buscar mensagens:', error);
    }
  };

  const marcarComoLida = async (conversaId: string) => {
    try {
      await supabase
        .from('conversas')
        .update({ nao_lidas: 0 })
        .eq('id', conversaId);
    } catch (error) {
      console.error('Erro ao marcar como lida:', error);
    }
  };

  const toggleAgenteIA = async () => {
    if (!conversaSelecionada) return;

    const novoStatus = !conversaSelecionada.agente_ia_ativo;
    try {
      await supabase
        .from('conversas')
        .update({ agente_ia_ativo: novoStatus })
        .eq('id', conversaSelecionada.id);

      setConversaSelecionada({ ...conversaSelecionada, agente_ia_ativo: novoStatus });
      toast.success(`Agente IA ${novoStatus ? 'ativado' : 'desativado'}`);
    } catch (error) {
      toast.error('Erro ao alterar status do Agente IA');
    }
  };

  const enviarMensagem = async () => {
    if (!novaMensagem.trim() || !conversaSelecionada || enviando) return;

    setEnviando(true);
    try {
      // Salvar no banco
      const { error } = await supabase.from('mensagens').insert({
        conversa_id: conversaSelecionada.id,
        usuario_id: usuario!.id,
        conteudo: novaMensagem,
        direcao: 'saida',
        tipo: 'texto',
        enviada_por_ia: false,
      });

      if (error) throw error;

      // Atualizar conversa - desativar IA e atribuir atendente humano
      await supabase
        .from('conversas')
        .update({
          ultima_mensagem: novaMensagem,
          ultima_mensagem_at: new Date().toISOString(),
          status: 'aguardando_cliente',
          agente_ia_ativo: false,
          atendente_id: usuario!.id,
        })
        .eq('id', conversaSelecionada.id);

      // Atualizar estado local
      setConversaSelecionada(prev => prev ? {
        ...prev,
        agente_ia_ativo: false,
        atendente_id: usuario!.id
      } : null);

      // Usar conexao_id da conversa ou pegar a conexão ativa
      const conexaoIdToUse = conversaSelecionada.conexao_id || conexao?.id;
      
      if (conexaoIdToUse && conexao?.status === 'conectado') {
        const { error: envioError } = await supabase.functions.invoke('enviar-mensagem', {
          body: {
            conexao_id: conexaoIdToUse,
            telefone: conversaSelecionada.contatos.telefone,
            mensagem: novaMensagem,
          },
        });

        if (envioError) {
          console.error('Erro ao enviar via WhatsApp:', envioError);
          toast.error('Mensagem salva, mas erro ao enviar via WhatsApp');
        }
        
        // Atualizar conexao_id na conversa se estava vazio
        if (!conversaSelecionada.conexao_id && conexaoIdToUse) {
          await supabase
            .from('conversas')
            .update({ conexao_id: conexaoIdToUse })
            .eq('id', conversaSelecionada.id);
        }
      } else if (!conexaoIdToUse || conexao?.status !== 'conectado') {
        toast.warning('WhatsApp não conectado. Mensagem salva apenas no CRM.');
      }

      setNovaMensagem('');
      fetchMensagens(conversaSelecionada.id);
      fetchConversas();
    } catch (error) {
      toast.error('Erro ao enviar mensagem');
    } finally {
      setEnviando(false);
    }
  };

  const encerrarAtendimento = async () => {
    if (!conversaSelecionada) return;

    try {
      await supabase
        .from('conversas')
        .update({ 
          status: 'encerrado', 
          arquivada: false,
          agente_ia_ativo: false,
          memoria_limpa_em: new Date().toISOString()
        })
        .eq('id', conversaSelecionada.id);

      toast.success('Atendimento encerrado');
      setConversaSelecionada(prev => prev ? { ...prev, status: 'encerrado' } : null);
      fetchConversas();
    } catch (error) {
      toast.error('Erro ao encerrar atendimento');
    }
  };

  const reabrirAtendimento = async () => {
    if (!conversaSelecionada) return;

    try {
      await supabase
        .from('conversas')
        .update({ 
          status: 'em_atendimento', 
          arquivada: false 
        })
        .eq('id', conversaSelecionada.id);

      toast.success('Conversa reaberta');
      setConversaSelecionada(prev => prev ? { ...prev, status: 'em_atendimento' } : null);
      fetchConversas();
    } catch (error) {
      toast.error('Erro ao reabrir conversa');
    }
  };

  const conversaEncerrada = conversaSelecionada?.status === 'encerrado';

  const transferirAtendimento = async (paraUsuarioId: string | null, paraIA: boolean, paraAgenteIAId?: string) => {
    if (!conversaSelecionada) return;

    try {
      // Chamar edge function que faz rastreamento e resposta automática
      const { data, error } = await supabase.functions.invoke('transferir-atendimento', {
        body: {
          conversa_id: conversaSelecionada.id,
          de_usuario_id: usuario?.id,
          para_usuario_id: paraUsuarioId,
          para_agente_ia_id: paraAgenteIAId,
          para_ia: paraIA,
          conta_id: usuario?.conta_id,
        },
      });

      if (error) throw error;

      toast.success(data?.mensagem || (paraIA ? 'Transferido para Agente IA' : 'Atendimento transferido'));
      setShowTransferModal(false);
      setConversaSelecionada(null);
      fetchConversas();
    } catch (error) {
      console.error('Erro ao transferir:', error);
      toast.error('Erro ao transferir atendimento');
    }
  };

  const handleFileSelect = (type: 'imagem' | 'documento' | 'audio') => {
    setFileType(type);
    setShowAttachMenu(false);
    fileInputRef.current?.click();
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !conversaSelecionada) return;

    setUploading(true);
    try {
      // Converter arquivo para base64
      const reader = new FileReader();
      reader.readAsDataURL(file);
      
      reader.onloadend = async () => {
        const base64Full = reader.result as string;
        const base64Data = base64Full.split(',')[1];
        
        // Upload para o storage
        const fileName = `${Date.now()}-${file.name}`;
        const { error: uploadError } = await supabase.storage
          .from('whatsapp-media')
          .upload(fileName, file);

        if (uploadError) throw uploadError;

        // Obter URL pública
        const { data: urlData } = supabase.storage
          .from('whatsapp-media')
          .getPublicUrl(fileName);

        const mediaUrl = urlData.publicUrl;

        // Salvar mensagem no banco
        await supabase.from('mensagens').insert({
          conversa_id: conversaSelecionada.id,
          usuario_id: usuario!.id,
          conteudo: file.name,
          direcao: 'saida',
          tipo: fileType,
          media_url: mediaUrl,
          enviada_por_ia: false,
        });

        // Atualizar conversa - desativar IA e atribuir atendente humano
        await supabase
          .from('conversas')
          .update({
            ultima_mensagem: `📎 ${file.name}`,
            ultima_mensagem_at: new Date().toISOString(),
            agente_ia_ativo: false,
            atendente_id: usuario!.id,
          })
          .eq('id', conversaSelecionada.id);

        // Atualizar estado local
        setConversaSelecionada(prev => prev ? {
          ...prev,
          agente_ia_ativo: false,
          atendente_id: usuario!.id
        } : null);

        // Enviar via WhatsApp
        const conexaoIdToUse = conversaSelecionada.conexao_id || conexao?.id;
        if (conexaoIdToUse && conexao?.status === 'conectado') {
          const { error: envioError } = await supabase.functions.invoke('enviar-mensagem', {
            body: {
              conexao_id: conexaoIdToUse,
              telefone: conversaSelecionada.contatos.telefone,
              mensagem: '',
              tipo: fileType,
              media_url: mediaUrl,
            },
          });

          if (envioError) {
            console.error('Erro ao enviar via WhatsApp:', envioError);
            toast.warning('Arquivo salvo, mas erro ao enviar via WhatsApp');
          }
        }

        fetchMensagens(conversaSelecionada.id);
        fetchConversas();
        toast.success('Arquivo enviado');
        setUploading(false);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      };
    } catch (error) {
      console.error('Erro ao enviar arquivo:', error);
      toast.error('Erro ao enviar arquivo');
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleSendAudio = async (audioBase64: string, duration: number) => {
    if (!conversaSelecionada) return;

    try {
      // Converter base64 para blob para salvar no storage
      const binaryString = atob(audioBase64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: 'audio/webm' });
      
      // Upload para o storage
      const fileName = `${Date.now()}-audio.webm`;
      const { error: uploadError } = await supabase.storage
        .from('whatsapp-media')
        .upload(fileName, blob, { contentType: 'audio/webm' });

      if (uploadError) throw uploadError;

      // Obter URL pública
      const { data: urlData } = supabase.storage
        .from('whatsapp-media')
        .getPublicUrl(fileName);

      const mediaUrl = urlData.publicUrl;
      
      const durationFormatted = `${Math.floor(duration / 60)}:${(duration % 60).toString().padStart(2, '0')}`;

      // Salvar mensagem no banco
      await supabase.from('mensagens').insert({
        conversa_id: conversaSelecionada.id,
        usuario_id: usuario!.id,
        conteudo: `🎤 Áudio (${durationFormatted})`,
        direcao: 'saida',
        tipo: 'audio',
        media_url: mediaUrl,
        enviada_por_ia: false,
      });

      // Atualizar conversa - desativar IA e atribuir atendente humano
      await supabase
        .from('conversas')
        .update({
          ultima_mensagem: `🎤 Áudio (${durationFormatted})`,
          ultima_mensagem_at: new Date().toISOString(),
          agente_ia_ativo: false,
          atendente_id: usuario!.id,
        })
        .eq('id', conversaSelecionada.id);

      // Atualizar estado local
      setConversaSelecionada(prev => prev ? {
        ...prev,
        agente_ia_ativo: false,
        atendente_id: usuario!.id
      } : null);

      // Enviar via WhatsApp
      const conexaoIdToUse = conversaSelecionada.conexao_id || conexao?.id;
      if (conexaoIdToUse && conexao?.status === 'conectado') {
        const { error: envioError } = await supabase.functions.invoke('enviar-mensagem', {
          body: {
            conexao_id: conexaoIdToUse,
            telefone: conversaSelecionada.contatos.telefone,
            mensagem: '',
            tipo: 'audio',
            media_base64: audioBase64,
          },
        });

        if (envioError) {
          console.error('Erro ao enviar áudio via WhatsApp:', envioError);
          toast.warning('Áudio salvo, mas erro ao enviar via WhatsApp');
        }
      }

      fetchMensagens(conversaSelecionada.id);
      fetchConversas();
      toast.success('Áudio enviado');
    } catch (error) {
      console.error('Erro ao enviar áudio:', error);
      toast.error('Erro ao enviar áudio');
    }
  };

  const formatTime = (date: string) => {
    return new Date(date).toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusColor = (status: string | null) => {
    switch (status) {
      case 'em_atendimento':
        return 'bg-green-500';
      case 'aguardando_cliente':
        return 'bg-yellow-500';
      case 'encerrado':
        return 'bg-gray-500';
      default:
        return 'bg-blue-500';
    }
  };

  const getStatusLabel = (status: string | null) => {
    switch (status) {
      case 'em_atendimento':
        return 'Em Atendimento';
      case 'aguardando_cliente':
        return 'Aguardando';
      case 'encerrado':
        return 'Encerrado';
      default:
        return 'Novo';
    }
  };

  const filteredConversas = conversas.filter((c) => {
    const matchesSearch = c.contatos.nome.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'todos' || c.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const renderMensagem = (msg: Mensagem) => {
    // Mensagem de sistema (rastreamento interno)
    if (msg.tipo === 'sistema') {
      return (
        <div key={msg.id} className="flex justify-center my-3">
          <div className="bg-muted/60 border border-border/50 rounded-lg px-4 py-2 flex items-center gap-2 max-w-[80%]">
            <Activity className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
            <span className="text-xs text-muted-foreground">{msg.conteudo}</span>
            <span className="text-xs text-muted-foreground/60 flex-shrink-0">
              {formatTime(msg.created_at)}
            </span>
          </div>
        </div>
      );
    }

    const isMedia = msg.tipo && msg.tipo !== 'texto' && msg.media_url;

    return (
      <div
        key={msg.id}
        className={cn(
          'flex',
          msg.direcao === 'saida' ? 'justify-end' : 'justify-start'
        )}
      >
        <div
          className={cn(
            'max-w-[70%] rounded-2xl px-4 py-2',
            msg.direcao === 'saida'
              ? 'bg-primary text-primary-foreground rounded-br-sm'
              : 'bg-muted text-foreground rounded-bl-sm'
          )}
        >
          {msg.direcao === 'saida' && (msg.enviada_por_ia || msg.enviada_por_dispositivo) && (
            <div className="flex items-center gap-1 text-xs opacity-70 mb-1">
              {msg.enviada_por_ia ? (
                <>
                  <Bot className="h-3 w-3" />
                  <span>Agente IA</span>
                </>
              ) : msg.enviada_por_dispositivo ? (
                <>
                  <Phone className="h-3 w-3" />
                  <span>Enviado pelo dispositivo</span>
                </>
              ) : null}
            </div>
          )}
          
          {isMedia ? (
            <div className="space-y-2">
              {msg.tipo === 'imagem' && (
                <img 
                  src={msg.media_url!} 
                  alt="Imagem"
                  className="max-w-full rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                  onClick={() => setImagemExpandida(msg.media_url)}
                />
              )}
              {msg.tipo === 'audio' && (
                <AudioPlayer 
                  src={msg.media_url!} 
                  variant={msg.direcao === 'saida' ? 'sent' : 'received'}
                />
              )}
              {msg.tipo === 'documento' && (
                <a 
                  href={msg.media_url!} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 underline"
                >
                  <FileText className="h-4 w-4" />
                  {msg.conteudo}
                </a>
              )}
              {msg.tipo === 'video' && (
                <video controls className="max-w-full rounded-lg">
                  <source src={msg.media_url!} />
                </video>
              )}
            </div>
          ) : (
            <p className="text-sm whitespace-pre-wrap">{msg.conteudo}</p>
          )}
          
          <div
            className={cn(
              'flex items-center gap-1 mt-1',
              msg.direcao === 'saida' ? 'justify-end' : 'justify-start'
            )}
          >
            <span className="text-xs opacity-70">{formatTime(msg.created_at)}</span>
            {msg.direcao === 'saida' && (
              msg.lida ? (
                <CheckCheck className="h-3 w-3 text-blue-400" />
              ) : (
                <Check className="h-3 w-3 opacity-70" />
              )
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <MainLayout>
      <div className="h-[calc(100vh-7rem)] flex rounded-xl overflow-hidden bg-card border border-border animate-fade-in">
        {/* Lista de Conversas */}
        <div className="w-96 border-r border-border flex flex-col">
          {/* Header */}
          <div className="p-4 border-b border-border">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-foreground">Conversas</h2>
              
              {/* Status da Conexão */}
              <div className={cn(
                'flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium',
                conexao?.status === 'conectado' 
                  ? 'bg-green-500/20 text-green-500' 
                  : conexao?.status === 'aguardando'
                  ? 'bg-yellow-500/20 text-yellow-500'
                  : 'bg-destructive/20 text-destructive'
              )}>
                {conexao?.status === 'conectado' ? (
                  <>
                    <Wifi className="h-3 w-3" />
                    Online
                  </>
                ) : conexao?.status === 'aguardando' ? (
                  <>
                    <RefreshCw className="h-3 w-3 animate-spin" />
                    Conectando
                  </>
                ) : (
                  <>
                    <WifiOff className="h-3 w-3" />
                    Offline
                  </>
                )}
              </div>
            </div>
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Buscar conversa..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full h-10 pl-10 pr-4 rounded-lg bg-input border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            
            {/* Filtros de Status */}
            <div className="flex gap-2 flex-wrap">
              {(['todos', 'em_atendimento', 'aguardando_cliente', 'encerrado'] as StatusFilter[]).map((status) => (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className={cn(
                    'px-3 py-1 rounded-full text-xs font-medium transition-colors',
                    statusFilter === status
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  )}
                >
                  {status === 'todos' ? 'Todos' : getStatusLabel(status)}
                </button>
              ))}
            </div>
          </div>

          {/* Lista */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center h-32">
                <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : filteredConversas.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                <Phone className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Nenhuma conversa</p>
                <p className="text-sm mt-1">As conversas aparecerão quando você receber mensagens</p>
              </div>
            ) : (
              filteredConversas.map((conversa) => (
                <div
                  key={conversa.id}
                  onClick={() => setConversaSelecionada(conversa)}
                  className={cn(
                    'flex items-center gap-3 p-4 cursor-pointer transition-colors border-b border-border/50',
                    conversaSelecionada?.id === conversa.id
                      ? 'bg-primary/10'
                      : 'hover:bg-muted/50'
                  )}
                >
                  <div className="relative">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/20 text-primary font-semibold">
                      {conversa.contatos.nome.charAt(0).toUpperCase()}
                    </div>
                    {conversa.agente_ia_ativo ? (
                      <div className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full bg-primary flex items-center justify-center">
                        <Bot className="h-3 w-3 text-primary-foreground" />
                      </div>
                    ) : conversa.atendente_id ? (
                      <div className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full bg-orange-500 flex items-center justify-center">
                        <User className="h-3 w-3 text-white" />
                      </div>
                    ) : null}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="font-medium text-foreground truncate">
                        {conversa.contatos.nome}
                      </p>
                      <div className="flex items-center gap-2">
                        <span className={cn('h-2 w-2 rounded-full', getStatusColor(conversa.status))} />
                        {conversa.ultima_mensagem_at && (
                          <span className="text-xs text-muted-foreground">
                            {formatTime(conversa.ultima_mensagem_at)}
                          </span>
                        )}
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground truncate">
                      {conversa.ultima_mensagem || 'Sem mensagens'}
                    </p>
                  </div>
                  {conversa.nao_lidas > 0 && (
                    <div className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground">
                      {conversa.nao_lidas}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Área da Conversa */}
        {conversaSelecionada ? (
          <div className="flex-1 flex flex-col">
            {/* Header da Conversa */}
            <div className="flex items-center justify-between p-4 border-b border-border">
              <button
                onClick={() => setShowContatoSidebar(true)}
                className="flex items-center gap-3 hover:bg-muted/50 rounded-lg p-2 -m-2 transition-colors cursor-pointer text-left"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/20 text-primary font-semibold">
                  {conversaSelecionada.contatos.nome.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground">
                      {conversaSelecionada.contatos.nome}
                    </span>
                    <span className={cn(
                      'px-2 py-0.5 rounded-full text-xs font-medium text-white',
                      getStatusColor(conversaSelecionada.status)
                    )}>
                      {getStatusLabel(conversaSelecionada.status)}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {conversaSelecionada.contatos.telefone}
                  </p>
                </div>
              </button>
              {!conversaEncerrada ? (
                <div className="flex items-center gap-2">
                  {/* Dropdown Agente IA */}
                  <div className="relative" ref={agenteDropdownRef}>
                    <button
                      onClick={() => setShowAgenteDropdown(!showAgenteDropdown)}
                      className={cn(
                        'flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                        conversaSelecionada.agente_ia_ativo
                          ? 'bg-primary/20 text-primary'
                          : 'bg-orange-500/20 text-orange-500'
                      )}
                    >
                      {conversaSelecionada.agente_ia_ativo ? (
                        <>
                          <Bot className="h-4 w-4" />
                          <span className="max-w-[100px] truncate">
                            {conversaSelecionada.agent_ia?.nome || 'Agente IA'}
                          </span>
                        </>
                      ) : (
                        <>
                          <User className="h-4 w-4" />
                          Humano
                        </>
                      )}
                      <ChevronDown className="h-3 w-3" />
                    </button>
                    
                    {showAgenteDropdown && (
                      <div className="absolute top-full right-0 mt-1 w-48 bg-popover border border-border rounded-lg shadow-lg z-50">
                        <div className="py-1">
                          {/* Opção Humano */}
                          <button
                            onClick={() => {
                              toggleAgenteIA();
                              setShowAgenteDropdown(false);
                            }}
                            className={cn(
                              'w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted transition-colors',
                              !conversaSelecionada.agente_ia_ativo && 'bg-muted'
                            )}
                          >
                            <User className="h-4 w-4 text-orange-500" />
                            <span>Humano</span>
                            {!conversaSelecionada.agente_ia_ativo && (
                              <Check className="h-4 w-4 ml-auto text-primary" />
                            )}
                          </button>
                          
                          {/* Separador */}
                          <div className="border-t border-border my-1" />
                          
                          {/* Agentes disponíveis */}
                          {agentesDisponiveis.map((agente) => (
                            <button
                              key={agente.id}
                              onClick={() => trocarAgente(agente.id)}
                              className={cn(
                                'w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted transition-colors',
                                conversaSelecionada.agente_ia_ativo && 
                                conversaSelecionada.agente_ia_id === agente.id && 'bg-muted'
                              )}
                            >
                              <Bot className="h-4 w-4 text-primary" />
                              <span className="truncate">{agente.nome || 'Agente IA'}</span>
                              {conversaSelecionada.agente_ia_ativo && 
                               conversaSelecionada.agente_ia_id === agente.id && (
                                <Check className="h-4 w-4 ml-auto text-primary" />
                              )}
                            </button>
                          ))}
                          
                          {agentesDisponiveis.length === 0 && (
                            <div className="px-3 py-2 text-sm text-muted-foreground">
                              Nenhum agente configurado
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Transferir */}
                  <button
                    onClick={() => setShowTransferModal(true)}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium bg-muted text-muted-foreground hover:bg-muted/80 transition-colors"
                  >
                    <ArrowRightLeft className="h-4 w-4" />
                    Transferir
                  </button>

                  {/* Encerrar */}
                  <button
                    onClick={encerrarAtendimento}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors"
                  >
                    <XCircle className="h-4 w-4" />
                    Encerrar
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Conversa encerrada</span>
                  <button
                    onClick={reabrirAtendimento}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                  >
                    <RefreshCw className="h-4 w-4" />
                    Reabrir
                  </button>
                </div>
              )}
            </div>

            {/* Mensagens */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {mensagens.map(renderMensagem)}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="p-4 border-t border-border">
              {conversaEncerrada ? (
                <div className="flex items-center justify-between bg-muted/50 rounded-lg p-4">
                  <div className="flex items-center gap-3 text-muted-foreground">
                    <XCircle className="h-5 w-5" />
                    <span>Esta conversa foi encerrada</span>
                  </div>
                  <button
                    onClick={reabrirAtendimento}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors text-sm font-medium"
                  >
                    <RefreshCw className="h-4 w-4" />
                    Reabrir Conversa
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <button 
                      onClick={() => setShowAttachMenu(!showAttachMenu)}
                      className="p-2 rounded-lg hover:bg-muted transition-colors"
                      disabled={uploading}
                    >
                      <Paperclip className={cn("h-5 w-5 text-muted-foreground", uploading && "animate-pulse")} />
                    </button>
                    
                    {showAttachMenu && (
                      <div className="absolute bottom-12 left-0 bg-card border border-border rounded-lg shadow-lg p-2 min-w-[150px]">
                        <button
                          onClick={() => handleFileSelect('imagem')}
                          className="w-full flex items-center gap-2 px-3 py-2 hover:bg-muted rounded-lg transition-colors text-sm"
                        >
                          <Image className="h-4 w-4 text-blue-500" />
                          Imagem
                        </button>
                        <button
                          onClick={() => handleFileSelect('documento')}
                          className="w-full flex items-center gap-2 px-3 py-2 hover:bg-muted rounded-lg transition-colors text-sm"
                        >
                          <FileText className="h-4 w-4 text-orange-500" />
                          Documento
                        </button>
                        <button
                          onClick={() => handleFileSelect('audio')}
                          className="w-full flex items-center gap-2 px-3 py-2 hover:bg-muted rounded-lg transition-colors text-sm"
                        >
                          <Mic className="h-4 w-4 text-green-500" />
                          Áudio
                        </button>
                      </div>
                    )}
                  </div>
                  
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    className="hidden"
                    accept={fileType === 'imagem' ? 'image/*' : fileType === 'audio' ? 'audio/*' : '*/*'}
                  />
                  
                  <input
                    type="text"
                    placeholder="Digite uma mensagem..."
                    value={novaMensagem}
                    onChange={(e) => setNovaMensagem(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && enviarMensagem()}
                    className="flex-1 h-10 px-4 rounded-lg bg-input border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    disabled={enviando}
                  />
                  
                  {/* Gravador de Áudio */}
                  <AudioRecorder 
                    onSend={handleSendAudio}
                    disabled={enviando || uploading}
                  />
                  
                  <button
                    onClick={enviarMensagem}
                    disabled={!novaMensagem.trim() || enviando}
                    className="h-10 w-10 rounded-lg bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90 transition-colors disabled:opacity-50"
                  >
                    {enviando ? (
                      <div className="h-4 w-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Send className="h-5 w-5" />
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center text-muted-foreground">
              <MessageSquareIcon className="h-16 w-16 mx-auto mb-4 opacity-30" />
              <p className="text-lg">Selecione uma conversa</p>
              <p className="text-sm">Escolha uma conversa para começar a atender</p>
            </div>
          </div>
        )}

        {/* Modal de Transferência */}
        {showTransferModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-card border border-border rounded-xl p-6 w-full max-w-md">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-foreground">Transferir Atendimento</h3>
                <button onClick={() => setShowTransferModal(false)}>
                  <X className="h-5 w-5 text-muted-foreground" />
                </button>
              </div>

              <div className="space-y-2 mb-4 max-h-96 overflow-y-auto">
                {/* Agente IA Principal */}
                <button
                  onClick={() => transferirAtendimento(null, true)}
                  className="w-full flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted transition-colors"
                >
                  <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center">
                    <Bot className="h-5 w-5 text-primary" />
                  </div>
                  <div className="text-left">
                    <p className="font-medium text-foreground">Agente IA Principal</p>
                    <p className="text-sm text-muted-foreground">Transferir para atendimento automático</p>
                  </div>
                </button>

                {/* Outros Agentes IA */}
                {agentesDisponiveis
                  .filter((a) => a.ativo)
                  .map((agente) => (
                    <button
                      key={agente.id}
                      onClick={() => transferirAtendimento(null, true, agente.id)}
                      className="w-full flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted transition-colors"
                    >
                      <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center">
                        <Bot className="h-5 w-5 text-primary" />
                      </div>
                      <div className="text-left">
                        <p className="font-medium text-foreground">{agente.nome}</p>
                        <p className="text-sm text-muted-foreground">
                          Agente IA {agente.tipo === 'principal' ? '(Principal)' : '(Secundário)'}
                        </p>
                      </div>
                    </button>
                  ))}

                {/* Separador */}
                {usuarios.filter((u) => u.id !== usuario?.id).length > 0 && (
                  <div className="border-t border-border my-2 pt-2">
                    <p className="text-xs text-muted-foreground mb-2 px-1">Atendentes Humanos</p>
                  </div>
                )}

                {/* Usuários Humanos */}
                {usuarios
                  .filter((u) => u.id !== usuario?.id)
                  .map((u) => (
                    <button
                      key={u.id}
                      onClick={() => transferirAtendimento(u.id, false)}
                      className="w-full flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted transition-colors"
                    >
                      <div className="h-10 w-10 rounded-full bg-orange-500/20 flex items-center justify-center">
                        <UserCheck className="h-5 w-5 text-orange-500" />
                      </div>
                      <div className="text-left">
                        <p className="font-medium text-foreground">{u.nome}</p>
                        <p className="text-sm text-muted-foreground">{u.email}</p>
                      </div>
                    </button>
                  ))}
              </div>
            </div>
          </div>
        )}

        {/* Modal de Imagem Expandida */}
        {imagemExpandida && (
          <div 
            className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
            onClick={() => setImagemExpandida(null)}
          >
            <button 
              className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
              onClick={() => setImagemExpandida(null)}
            >
              <X className="h-6 w-6 text-white" />
            </button>
            <img 
              src={imagemExpandida} 
              alt="Imagem ampliada" 
              className="max-w-full max-h-full object-contain rounded-lg"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        )}

        {/* Sidebar do Contato */}
        {conversaSelecionada && (
          <ContatoSidebar
            contato={conversaSelecionada.contatos}
            isOpen={showContatoSidebar}
            onClose={() => setShowContatoSidebar(false)}
            onContatoUpdate={(contatoAtualizado) => {
              setConversaSelecionada({
                ...conversaSelecionada,
                contatos: contatoAtualizado
              });
              fetchConversas();
            }}
          />
        )}
      </div>
    </MainLayout>
  );
}
