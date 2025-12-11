import { useState, useEffect, useRef } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import {
  Search,
  Send,
  Bot,
  User,
  MoreVertical,
  Phone,
  Paperclip,
  Smile,
  Check,
  CheckCheck,
  MessageSquare as MessageSquareIcon,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface Contato {
  id: string;
  nome: string;
  telefone: string;
  avatar_url: string | null;
}

interface Conversa {
  id: string;
  contato_id: string;
  agente_ia_ativo: boolean;
  ultima_mensagem: string | null;
  ultima_mensagem_at: string | null;
  nao_lidas: number;
  contatos: Contato;
}

interface Mensagem {
  id: string;
  conversa_id: string;
  conteudo: string;
  direcao: 'entrada' | 'saida';
  created_at: string;
  enviada_por_ia: boolean;
  lida: boolean;
}

export default function Conversas() {
  const { usuario } = useAuth();
  const [conversas, setConversas] = useState<Conversa[]>([]);
  const [conversaSelecionada, setConversaSelecionada] = useState<Conversa | null>(null);
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [novaMensagem, setNovaMensagem] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (usuario?.conta_id) {
      fetchConversas();
      setupRealtimeSubscription();
    }
  }, [usuario]);

  useEffect(() => {
    if (conversaSelecionada) {
      fetchMensagens(conversaSelecionada.id);
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
      .channel('mensagens-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'mensagens' },
        (payload) => {
          const novaMensagem = payload.new as Mensagem;
          if (conversaSelecionada && novaMensagem.conversa_id === conversaSelecionada.id) {
            setMensagens((prev) => [...prev, novaMensagem]);
          }
          fetchConversas();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const fetchConversas = async () => {
    try {
      const { data, error } = await supabase
        .from('conversas')
        .select(`*, contatos(*)`)
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

  const fetchMensagens = async (conversaId: string) => {
    try {
      const { data, error } = await supabase
        .from('mensagens')
        .select('*')
        .eq('conversa_id', conversaId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setMensagens(data || []);
    } catch (error) {
      console.error('Erro ao buscar mensagens:', error);
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
    if (!novaMensagem.trim() || !conversaSelecionada) return;

    try {
      const { error } = await supabase.from('mensagens').insert({
        conversa_id: conversaSelecionada.id,
        usuario_id: usuario!.id,
        conteudo: novaMensagem,
        direcao: 'saida',
        enviada_por_ia: false,
      });

      if (error) throw error;

      await supabase
        .from('conversas')
        .update({
          ultima_mensagem: novaMensagem,
          ultima_mensagem_at: new Date().toISOString(),
        })
        .eq('id', conversaSelecionada.id);

      setNovaMensagem('');
      fetchMensagens(conversaSelecionada.id);
      fetchConversas();
    } catch (error) {
      toast.error('Erro ao enviar mensagem');
    }
  };

  const formatTime = (date: string) => {
    return new Date(date).toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const filteredConversas = conversas.filter((c) =>
    c.contatos.nome.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <MainLayout>
      <div className="h-[calc(100vh-7rem)] flex rounded-xl overflow-hidden bg-card border border-border animate-fade-in">
        {/* Lista de Conversas */}
        <div className="w-96 border-r border-border flex flex-col">
          {/* Header */}
          <div className="p-4 border-b border-border">
            <h2 className="text-xl font-semibold text-foreground mb-4">Conversas</h2>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Buscar conversa..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full h-10 pl-10 pr-4 rounded-lg bg-input border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
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
                <p>Nenhuma conversa ainda</p>
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
                    {conversa.agente_ia_ativo && (
                      <div className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full bg-primary flex items-center justify-center">
                        <Bot className="h-3 w-3 text-primary-foreground" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="font-medium text-foreground truncate">
                        {conversa.contatos.nome}
                      </p>
                      {conversa.ultima_mensagem_at && (
                        <span className="text-xs text-muted-foreground">
                          {formatTime(conversa.ultima_mensagem_at)}
                        </span>
                      )}
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
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/20 text-primary font-semibold">
                  {conversaSelecionada.contatos.nome.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="font-medium text-foreground">{conversaSelecionada.contatos.nome}</p>
                  <p className="text-sm text-muted-foreground">
                    {conversaSelecionada.contatos.telefone}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {/* Toggle Agente IA */}
                <button
                  onClick={toggleAgenteIA}
                  className={cn(
                    'flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                    conversaSelecionada.agente_ia_ativo
                      ? 'bg-primary/20 text-primary'
                      : 'bg-muted text-muted-foreground'
                  )}
                >
                  <Bot className="h-4 w-4" />
                  IA {conversaSelecionada.agente_ia_ativo ? 'ON' : 'OFF'}
                </button>
                <button className="p-2 rounded-lg hover:bg-muted transition-colors">
                  <MoreVertical className="h-5 w-5 text-muted-foreground" />
                </button>
              </div>
            </div>

            {/* Mensagens */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {mensagens.map((msg) => (
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
                    {msg.enviada_por_ia && msg.direcao === 'saida' && (
                      <div className="flex items-center gap-1 text-xs opacity-70 mb-1">
                        <Bot className="h-3 w-3" />
                        <span>Agente IA</span>
                      </div>
                    )}
                    <p className="text-sm">{msg.conteudo}</p>
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
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="p-4 border-t border-border">
              <div className="flex items-center gap-3">
                <button className="p-2 rounded-lg hover:bg-muted transition-colors">
                  <Paperclip className="h-5 w-5 text-muted-foreground" />
                </button>
                <button className="p-2 rounded-lg hover:bg-muted transition-colors">
                  <Smile className="h-5 w-5 text-muted-foreground" />
                </button>
                <input
                  type="text"
                  placeholder="Digite uma mensagem..."
                  value={novaMensagem}
                  onChange={(e) => setNovaMensagem(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && enviarMensagem()}
                  className="flex-1 h-10 px-4 rounded-lg bg-input border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <button
                  onClick={enviarMensagem}
                  disabled={!novaMensagem.trim()}
                  className="h-10 w-10 rounded-lg bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  <Send className="h-5 w-5" />
                </button>
              </div>
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
      </div>
    </MainLayout>
  );
}
