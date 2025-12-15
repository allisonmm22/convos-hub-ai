import { useState, useEffect } from 'react';
import { 
  X, Tag, UserRound, Bot, Globe, Layers, Bell, Package, StopCircle,
  Check, AlertCircle, Loader2, UserPen
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface DecisaoInteligenteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInsert: (action: string) => void;
}

interface Funil {
  id: string;
  nome: string;
}

interface Estagio {
  id: string;
  nome: string;
  funil_id: string;
  cor: string;
}

interface Usuario {
  id: string;
  nome: string;
}

interface DecisaoTipo {
  id: string;
  label: string;
  description: string;
  icon: React.ElementType;
  color: string;
  bgColor: string;
}

const tiposDecisao: DecisaoTipo[] = [
  {
    id: 'tag',
    label: 'Adicionar Tag',
    description: 'Adiciona uma tag ao contato',
    icon: Tag,
    color: 'hsl(var(--chart-4))',
    bgColor: 'hsl(var(--chart-4) / 0.1)',
  },
  {
    id: 'transferir-agente',
    label: 'Transferir para Agente',
    description: 'Transfere para outro agente IA',
    icon: Bot,
    color: 'hsl(var(--primary))',
    bgColor: 'hsl(var(--primary) / 0.1)',
  },
  {
    id: 'transferir-usuario',
    label: 'Transferir para Usuário',
    description: 'Transfere para um atendente humano',
    icon: UserRound,
    color: 'hsl(var(--chart-2))',
    bgColor: 'hsl(var(--chart-2) / 0.1)',
  },
  {
    id: 'fonte',
    label: 'Atribuir Fonte',
    description: 'Define a origem do lead',
    icon: Globe,
    color: 'hsl(var(--chart-3))',
    bgColor: 'hsl(var(--chart-3) / 0.1)',
  },
  {
    id: 'etapa',
    label: 'Transferir para Estágio',
    description: 'Move o lead no CRM',
    icon: Layers,
    color: 'hsl(var(--chart-1))',
    bgColor: 'hsl(var(--chart-1) / 0.1)',
  },
  {
    id: 'notificar',
    label: 'Fazer Notificação',
    description: 'Envia alerta para a equipe',
    icon: Bell,
    color: 'hsl(var(--destructive))',
    bgColor: 'hsl(var(--destructive) / 0.1)',
  },
  {
    id: 'produto',
    label: 'Atribuir Produto',
    description: 'Associa um produto ao lead',
    icon: Package,
    color: 'hsl(var(--chart-5))',
    bgColor: 'hsl(var(--chart-5) / 0.1)',
  },
  {
    id: 'finalizar',
    label: 'Interromper Agente',
    description: 'Encerra a conversa',
    icon: StopCircle,
    color: 'hsl(var(--destructive))',
    bgColor: 'hsl(var(--destructive) / 0.1)',
  },
  {
    id: 'nome',
    label: 'Alterar Nome',
    description: 'Altera o nome do contato',
    icon: UserPen,
    color: 'hsl(var(--chart-3))',
    bgColor: 'hsl(var(--chart-3) / 0.1)',
  },
];

export function DecisaoInteligenteModal({ isOpen, onClose, onInsert }: DecisaoInteligenteModalProps) {
  const { usuario } = useAuth();
  const [tipoSelecionado, setTipoSelecionado] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  
  // Estados para os dados
  const [funis, setFunis] = useState<Funil[]>([]);
  const [estagios, setEstagios] = useState<Estagio[]>([]);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [agentes, setAgentes] = useState<{ id: string; nome: string }[]>([]);
  
  // Estados para seleção
  const [tagValue, setTagValue] = useState('');
  const [funilSelecionado, setFunilSelecionado] = useState('');
  const [estagioSelecionado, setEstagioSelecionado] = useState('');
  const [usuarioSelecionado, setUsuarioSelecionado] = useState('');
  const [agenteSelecionado, setAgenteSelecionado] = useState('');
  const [fonteValue, setFonteValue] = useState('');
  const [notificacaoValue, setNotificacaoValue] = useState('');
  const [produtoValue, setProdutoValue] = useState('');

  // Reset ao fechar
  useEffect(() => {
    if (!isOpen) {
      setTipoSelecionado(null);
      setTagValue('');
      setFunilSelecionado('');
      setEstagioSelecionado('');
      setUsuarioSelecionado('');
      setAgenteSelecionado('');
      setFonteValue('');
      setNotificacaoValue('');
      setProdutoValue('');
    }
  }, [isOpen]);

  // Carregar dados quando abrir
  useEffect(() => {
    if (isOpen && usuario?.conta_id) {
      fetchData();
    }
  }, [isOpen, usuario?.conta_id]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Buscar funis e estágios
      const [funisRes, usuariosRes, agentesRes] = await Promise.all([
        supabase
          .from('funis')
          .select('id, nome')
          .eq('conta_id', usuario!.conta_id)
          .order('ordem'),
        supabase
          .from('usuarios')
          .select('id, nome')
          .eq('conta_id', usuario!.conta_id),
        supabase
          .from('agent_ia')
          .select('id, nome')
          .eq('conta_id', usuario!.conta_id)
          .eq('tipo', 'secundario'),
      ]);

      if (funisRes.data) setFunis(funisRes.data);
      if (usuariosRes.data) setUsuarios(usuariosRes.data);
      if (agentesRes.data) setAgentes(agentesRes.data);

      // Buscar estágios se houver funis
      if (funisRes.data && funisRes.data.length > 0) {
        const { data: estagiosData } = await supabase
          .from('estagios')
          .select('id, nome, funil_id, cor')
          .in('funil_id', funisRes.data.map(f => f.id))
          .order('ordem');
        
        if (estagiosData) setEstagios(estagiosData);
      }
    } catch (error) {
      console.error('Erro ao buscar dados:', error);
    } finally {
      setLoading(false);
    }
  };

  // Verificar se está pronto para inserir
  const isProntoParaInserir = (): boolean => {
    if (!tipoSelecionado) return false;

    switch (tipoSelecionado) {
      case 'tag':
        return tagValue.trim().length > 0;
      case 'etapa':
        return estagioSelecionado !== '';
      case 'transferir-usuario':
        return usuarioSelecionado !== '';
      case 'transferir-agente':
        return agenteSelecionado !== '';
      case 'fonte':
        return fonteValue.trim().length > 0;
      case 'notificar':
        return notificacaoValue.trim().length > 0;
      case 'produto':
        return produtoValue.trim().length > 0;
      case 'finalizar':
      case 'nome':
        return true;
      default:
        return false;
    }
  };

  // Gerar ação
  const gerarAcao = (): string => {
    switch (tipoSelecionado) {
      case 'tag':
        return `@tag:${tagValue.toLowerCase().replace(/\s+/g, '-')}`;
      case 'etapa': {
        const estagio = estagios.find(e => e.id === estagioSelecionado);
        return `@etapa:${estagio?.nome.toLowerCase().replace(/\s+/g, '-') || estagioSelecionado}`;
      }
      case 'transferir-usuario':
        if (usuarioSelecionado === 'humano') return '@transferir:humano';
        const user = usuarios.find(u => u.id === usuarioSelecionado);
        return `@transferir:usuario:${user?.nome.toLowerCase().replace(/\s+/g, '-') || usuarioSelecionado}`;
      case 'transferir-agente':
        if (agenteSelecionado === 'ia') return '@transferir:ia';
        const agente = agentes.find(a => a.id === agenteSelecionado);
        return `@transferir:agente:${agente?.nome.toLowerCase().replace(/\s+/g, '-') || agenteSelecionado}`;
      case 'fonte':
        return `@fonte:${fonteValue.toLowerCase().replace(/\s+/g, '-')}`;
      case 'notificar':
        return `@notificar:${notificacaoValue}`;
      case 'produto':
        return `@produto:${produtoValue.toLowerCase().replace(/\s+/g, '-')}`;
      case 'finalizar':
        return '@finalizar';
      case 'nome':
        return '@nome';
      default:
        return '';
    }
  };

  const handleInserir = () => {
    const acao = gerarAcao();
    if (acao) {
      onInsert(acao);
      onClose();
    }
  };

  const estagiosFiltrados = funilSelecionado 
    ? estagios.filter(e => e.funil_id === funilSelecionado)
    : estagios;

  const tipoAtual = tiposDecisao.find(t => t.id === tipoSelecionado);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-6 py-4 border-b border-border">
          <DialogTitle className="text-lg font-semibold">
            Adicionar Decisão Inteligente
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            Configure ações automáticas baseadas em condições
          </p>
        </DialogHeader>

        <div className="flex min-h-[400px]">
          {/* Coluna Esquerda - Tipos de Decisão */}
          <div className="w-1/2 border-r border-border p-4 overflow-auto">
            <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
              Tipo de Decisão
            </h3>
            <div className="space-y-1">
              {tiposDecisao.map((tipo) => (
                <button
                  key={tipo.id}
                  onClick={() => setTipoSelecionado(tipo.id)}
                  className={`w-full flex items-center gap-3 p-3 rounded-lg text-left transition-all ${
                    tipoSelecionado === tipo.id
                      ? 'bg-primary/10 ring-2 ring-primary/30'
                      : 'hover:bg-muted'
                  }`}
                >
                  <div 
                    className="flex items-center justify-center h-9 w-9 rounded-lg"
                    style={{ 
                      backgroundColor: tipo.bgColor,
                    }}
                  >
                    <tipo.icon 
                      className="h-4 w-4" 
                      style={{ color: tipo.color }}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-foreground text-sm">
                      {tipo.label}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      {tipo.description}
                    </div>
                  </div>
                  {tipoSelecionado === tipo.id && (
                    <Check className="h-4 w-4 text-primary flex-shrink-0" />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Coluna Direita - Configuração */}
          <div className="w-1/2 p-4 overflow-auto bg-muted/30">
            <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
              Configuração
            </h3>

            {loading ? (
              <div className="flex items-center justify-center h-48">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : !tipoSelecionado ? (
              <div className="flex flex-col items-center justify-center h-48 text-center">
                <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-3">
                  <Layers className="h-6 w-6 text-muted-foreground" />
                </div>
                <p className="text-sm text-muted-foreground">
                  Selecione um tipo de decisão para configurar
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Adicionar Tag */}
                {tipoSelecionado === 'tag' && (
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Nome da Tag
                    </label>
                    <input
                      type="text"
                      value={tagValue}
                      onChange={(e) => setTagValue(e.target.value)}
                      placeholder="Ex: cliente-vip, interessado, etc."
                      className="w-full h-10 px-3 rounded-lg bg-input border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                    <p className="text-xs text-muted-foreground mt-2">
                      💡 A tag será adicionada automaticamente ao contato quando a condição for atendida
                    </p>
                  </div>
                )}

                {/* Transferir para Estágio */}
                {tipoSelecionado === 'etapa' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">
                        Selecione o Funil
                      </label>
                      <select
                        value={funilSelecionado}
                        onChange={(e) => {
                          setFunilSelecionado(e.target.value);
                          setEstagioSelecionado('');
                        }}
                        className="w-full h-10 px-3 rounded-lg bg-input border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                      >
                        <option value="">Todos os funis</option>
                        {funis.map(f => (
                          <option key={f.id} value={f.id}>{f.nome}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">
                        Selecione o Estágio
                      </label>
                      <select
                        value={estagioSelecionado}
                        onChange={(e) => setEstagioSelecionado(e.target.value)}
                        className="w-full h-10 px-3 rounded-lg bg-input border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                      >
                        <option value="">Selecione uma opção...</option>
                        {estagiosFiltrados.map(e => (
                          <option key={e.id} value={e.id}>{e.nome}</option>
                        ))}
                      </select>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      💡 O lead será movido para este estágio no CRM automaticamente
                    </p>
                  </>
                )}

                {/* Transferir para Usuário */}
                {tipoSelecionado === 'transferir-usuario' && (
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Selecione o Atendente
                    </label>
                    <select
                      value={usuarioSelecionado}
                      onChange={(e) => setUsuarioSelecionado(e.target.value)}
                      className="w-full h-10 px-3 rounded-lg bg-input border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      <option value="">Selecione uma opção...</option>
                      <option value="humano">Próximo atendente disponível</option>
                      {usuarios.map(u => (
                        <option key={u.id} value={u.id}>{u.nome}</option>
                      ))}
                    </select>
                    <p className="text-xs text-muted-foreground mt-2">
                      💡 A conversa será transferida para este atendente humano
                    </p>
                  </div>
                )}

                {/* Transferir para Agente */}
                {tipoSelecionado === 'transferir-agente' && (
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Selecione o Agente IA
                    </label>
                    <select
                      value={agenteSelecionado}
                      onChange={(e) => setAgenteSelecionado(e.target.value)}
                      className="w-full h-10 px-3 rounded-lg bg-input border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      <option value="">Selecione uma opção...</option>
                      <option value="ia">Agente IA principal</option>
                      {agentes.map(a => (
                        <option key={a.id} value={a.id}>{a.nome}</option>
                      ))}
                    </select>
                    <p className="text-xs text-muted-foreground mt-2">
                      💡 A conversa será transferida para outro agente de IA
                    </p>
                  </div>
                )}

                {/* Atribuir Fonte */}
                {tipoSelecionado === 'fonte' && (
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Nome da Fonte
                    </label>
                    <input
                      type="text"
                      value={fonteValue}
                      onChange={(e) => setFonteValue(e.target.value)}
                      placeholder="Ex: facebook, instagram, site, etc."
                      className="w-full h-10 px-3 rounded-lg bg-input border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                    <p className="text-xs text-muted-foreground mt-2">
                      💡 A fonte será atribuída ao contato para rastreamento
                    </p>
                  </div>
                )}

                {/* Fazer Notificação */}
                {tipoSelecionado === 'notificar' && (
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Mensagem da Notificação
                    </label>
                    <textarea
                      value={notificacaoValue}
                      onChange={(e) => setNotificacaoValue(e.target.value)}
                      placeholder="Ex: Lead qualificado, precisa de atenção urgente!"
                      rows={3}
                      className="w-full px-3 py-2 rounded-lg bg-input border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                    />
                    <p className="text-xs text-muted-foreground mt-2">
                      💡 Uma notificação será enviada para a equipe
                    </p>
                  </div>
                )}

                {/* Atribuir Produto */}
                {tipoSelecionado === 'produto' && (
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Nome do Produto
                    </label>
                    <input
                      type="text"
                      value={produtoValue}
                      onChange={(e) => setProdutoValue(e.target.value)}
                      placeholder="Ex: plano-premium, curso-online, etc."
                      className="w-full h-10 px-3 rounded-lg bg-input border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                    <p className="text-xs text-muted-foreground mt-2">
                      💡 O produto será associado ao lead
                    </p>
                  </div>
                )}

                {/* Interromper Agente */}
                {tipoSelecionado === 'finalizar' && (
                  <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20">
                    <div className="flex items-center gap-3 mb-2">
                      <StopCircle className="h-6 w-6 text-destructive" />
                      <span className="font-medium text-foreground">Encerrar Conversa</span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      O agente irá encerrar a conversa automaticamente quando esta condição for atendida.
                      O status da conversa será alterado para "Encerrado".
                    </p>
                  </div>
                )}

                {/* Alterar Nome */}
                {tipoSelecionado === 'nome' && (
                  <div className="p-4 rounded-lg bg-muted/50 border border-border">
                    <p className="text-sm text-foreground mb-2">
                      📝 <strong>Captura Automática</strong>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      O agente IA irá extrair automaticamente o nome do lead quando ele 
                      se identificar durante a conversa e salvará no cadastro do contato.
                    </p>
                  </div>
                )}

                {/* Preview da ação */}
                {isProntoParaInserir() && (
                  <div className="mt-4 p-3 rounded-lg bg-primary/5 border border-primary/20">
                    <div className="text-xs text-muted-foreground mb-1">Ação gerada:</div>
                    <code className="text-sm font-mono text-primary">{gerarAcao()}</code>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-border bg-muted/30">
          <div className="flex items-center gap-2">
            {isProntoParaInserir() ? (
              <>
                <Check className="h-4 w-4 text-primary" />
                <span className="text-sm text-primary font-medium">Pronto para inserir</span>
              </>
            ) : (
              <>
                <AlertCircle className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  {tipoSelecionado ? 'Configure as opções necessárias' : 'Selecione um tipo de decisão'}
                </span>
              </>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="h-10 px-4 rounded-lg border border-border text-foreground hover:bg-muted transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleInserir}
              disabled={!isProntoParaInserir()}
              className="h-10 px-6 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Inserir Decisão
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
