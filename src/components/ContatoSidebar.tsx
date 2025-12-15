import { useState, useEffect } from 'react';
import { X, Phone, Edit2, Save, Briefcase, Mail, Tag, Plus, MoreVertical, History, ChevronDown, ChevronUp, Check } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { NegociacaoDetalheModal } from '@/components/NegociacaoDetalheModal';

interface Contato {
  id: string;
  nome: string;
  telefone: string;
  email?: string | null;
  avatar_url: string | null;
  tags?: string[] | null;
  is_grupo?: boolean | null;
  grupo_jid?: string | null;
}

interface Estagio {
  id: string;
  nome: string;
  cor: string | null;
  ordem: number | null;
}

interface Funil {
  id: string;
  nome: string;
  estagios: Estagio[];
}

interface Negociacao {
  id: string;
  titulo: string;
  valor: number | null;
  status: 'aberto' | 'ganho' | 'perdido' | null;
  created_at: string;
  estagio_id: string | null;
  funil_id: string | null;
  estagio?: {
    nome: string;
    cor: string | null;
  } | null;
}

interface HistoricoItem {
  id: string;
  tipo: string;
  descricao: string | null;
  created_at: string;
  estagio_anterior?: { nome: string; cor: string | null } | null;
  estagio_novo?: { nome: string; cor: string | null } | null;
  usuario?: { nome: string } | null;
}

interface TagItem {
  id: string;
  nome: string;
  cor: string;
}

interface ContatoSidebarProps {
  contato: Contato;
  conversaId?: string;
  isOpen: boolean;
  onClose: () => void;
  onContatoUpdate?: (contato: Contato) => void;
}

export function ContatoSidebar({ contato, conversaId, isOpen, onClose, onContatoUpdate }: ContatoSidebarProps) {
  const { usuario } = useAuth();
  const [editando, setEditando] = useState(false);
  const [telefoneEdit, setTelefoneEdit] = useState(contato.telefone);
  const [emailEdit, setEmailEdit] = useState(contato.email || '');
  const [salvando, setSalvando] = useState(false);
  const [negociacoes, setNegociacoes] = useState<Negociacao[]>([]);
  const [loadingNegociacoes, setLoadingNegociacoes] = useState(false);
  const [funis, setFunis] = useState<Funil[]>([]);
  const [criandoNegociacao, setCriandoNegociacao] = useState(false);
  const [novaNegociacao, setNovaNegociacao] = useState({
    titulo: '',
    valor: '',
    funil_id: '',
    estagio_id: '',
  });
  const [negociacaoSelecionada, setNegociacaoSelecionada] = useState<Negociacao | null>(null);
  const [modalDetalheAberto, setModalDetalheAberto] = useState(false);
  const [historicos, setHistoricos] = useState<Record<string, HistoricoItem[]>>({});
  const [historicoExpandido, setHistoricoExpandido] = useState<string | null>(null);
  const [tagsDisponiveis, setTagsDisponiveis] = useState<TagItem[]>([]);
  const [tagPopoverOpen, setTagPopoverOpen] = useState(false);
  const [salvandoTags, setSalvandoTags] = useState(false);

  useEffect(() => {
    setTelefoneEdit(contato.telefone);
    setEmailEdit(contato.email || '');
    setEditando(false);
    if (isOpen) {
      fetchNegociacoes();
      fetchFunis();
      fetchTagsDisponiveis();
    }
  }, [contato, isOpen]);

  const fetchFunis = async () => {
    try {
      const { data, error } = await supabase
        .from('funis')
        .select(`
          id,
          nome,
          estagios:estagios(id, nome, cor, ordem)
        `)
        .order('ordem');

      if (error) throw error;
      
      const funisOrdenados = (data || []).map((f: any) => ({
        ...f,
        estagios: (f.estagios || []).sort((a: Estagio, b: Estagio) => (a.ordem || 0) - (b.ordem || 0))
      }));
      
      setFunis(funisOrdenados);
    } catch (error) {
      console.error('Erro ao buscar funis:', error);
    }
  };

  const fetchTagsDisponiveis = async () => {
    try {
      const { data, error } = await supabase
        .from('tags')
        .select('id, nome, cor')
        .order('nome');
      
      if (error) throw error;
      setTagsDisponiveis(data || []);
    } catch (error) {
      console.error('Erro ao buscar tags:', error);
    }
  };

  const handleToggleTag = async (tagNome: string) => {
    setSalvandoTags(true);
    try {
      const currentTags = contato.tags || [];
      const hasTag = currentTags.includes(tagNome);
      const newTags = hasTag 
        ? currentTags.filter(t => t !== tagNome)
        : [...currentTags, tagNome];
      
      const { error } = await supabase
        .from('contatos')
        .update({ tags: newTags })
        .eq('id', contato.id);

      if (error) throw error;

      if (onContatoUpdate) {
        onContatoUpdate({
          ...contato,
          tags: newTags,
        });
      }
      
      toast.success(hasTag ? 'Tag removida' : 'Tag adicionada');
    } catch (error) {
      console.error('Erro ao atualizar tags:', error);
      toast.error('Erro ao atualizar tags');
    } finally {
      setSalvandoTags(false);
    }
  };

  const getTagColor = (tagNome: string) => {
    const tag = tagsDisponiveis.find(t => t.nome === tagNome);
    return tag?.cor || '#3b82f6';
  };

  const fetchNegociacoes = async () => {
    setLoadingNegociacoes(true);
    try {
      const { data, error } = await supabase
        .from('negociacoes')
        .select(`
          id,
          titulo,
          valor,
          status,
          created_at,
          estagio_id,
          estagios:estagio_id (
            nome,
            cor,
            funil_id
          )
        `)
        .eq('contato_id', contato.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      const transformedData = (data || []).map((n: any) => ({
        ...n,
        estagio: n.estagios,
        funil_id: n.estagios?.funil_id || null
      }));
      
      setNegociacoes(transformedData);
    } catch (error) {
      console.error('Erro ao buscar negociações:', error);
    } finally {
      setLoadingNegociacoes(false);
    }
  };

  const handleSave = async () => {
    setSalvando(true);
    try {
      const { error } = await supabase
        .from('contatos')
        .update({
          telefone: telefoneEdit,
          email: emailEdit || null,
        })
        .eq('id', contato.id);

      if (error) throw error;

      toast.success('Contato atualizado');
      setEditando(false);
      
      if (onContatoUpdate) {
        onContatoUpdate({
          ...contato,
          telefone: telefoneEdit,
          email: emailEdit || null,
        });
      }
    } catch (error) {
      console.error('Erro ao atualizar contato:', error);
      toast.error('Erro ao atualizar contato');
    } finally {
      setSalvando(false);
    }
  };

  const handleUpdateNegociacao = async (negociacaoId: string, updates: { estagio_id?: string; status?: 'aberto' | 'ganho' | 'perdido' }, estagioAnteriorId?: string | null) => {
    try {
      // Get negotiation details for notification
      const negociacao = negociacoes.find(n => n.id === negociacaoId);
      
      const { error } = await supabase
        .from('negociacoes')
        .update(updates)
        .eq('id', negociacaoId);

      if (error) throw error;

      // Record stage change history and send notification
      if (updates.estagio_id && estagioAnteriorId !== updates.estagio_id) {
        await supabase.from('negociacao_historico').insert({
          negociacao_id: negociacaoId,
          estagio_anterior_id: estagioAnteriorId || null,
          estagio_novo_id: updates.estagio_id,
          usuario_id: usuario?.id,
          tipo: 'mudanca_estagio',
        });

        // Find stage names for notification
        const estagioAnterior = funis.flatMap(f => f.estagios).find(e => e.id === estagioAnteriorId);
        const estagioNovo = funis.flatMap(f => f.estagios).find(e => e.id === updates.estagio_id);

        // Create notification for responsible users
        if (usuario?.conta_id && estagioNovo) {
          await supabase.from('notificacoes').insert({
            conta_id: usuario.conta_id,
            tipo: 'mudanca_estagio',
            titulo: `Negociação movida para ${estagioNovo.nome}`,
            mensagem: `${negociacao?.titulo || 'Negociação'} foi movida${estagioAnterior ? ` de "${estagioAnterior.nome}"` : ''} para "${estagioNovo.nome}"`,
            link: '/crm',
          });
        }

        // Insert system message in conversation to track stage change
        if (conversaId) {
          const mensagemSistema = estagioAnterior 
            ? `📊 ${usuario?.nome || 'Usuário'} moveu negociação de "${estagioAnterior.nome}" para "${estagioNovo?.nome}"`
            : `📊 ${usuario?.nome || 'Usuário'} moveu negociação para "${estagioNovo?.nome}"`;
          
          await supabase.from('mensagens').insert({
            conversa_id: conversaId,
            conteudo: mensagemSistema,
            direcao: 'saida',
            tipo: 'sistema',
            usuario_id: usuario?.id,
          });
        }
      }
      
      toast.success('Negociação atualizada');
      fetchNegociacoes();
      if (historicoExpandido === negociacaoId) {
        fetchHistorico(negociacaoId);
      }
    } catch (error) {
      console.error('Erro ao atualizar negociação:', error);
      toast.error('Erro ao atualizar negociação');
    }
  };

  const fetchHistorico = async (negociacaoId: string) => {
    try {
      const { data, error } = await supabase
        .from('negociacao_historico')
        .select(`
          id,
          tipo,
          descricao,
          created_at,
          estagio_anterior:estagio_anterior_id(nome, cor),
          estagio_novo:estagio_novo_id(nome, cor),
          usuario:usuario_id(nome)
        `)
        .eq('negociacao_id', negociacaoId)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;

      setHistoricos(prev => ({
        ...prev,
        [negociacaoId]: (data || []).map((h: any) => ({
          ...h,
          estagio_anterior: h.estagio_anterior,
          estagio_novo: h.estagio_novo,
          usuario: h.usuario,
        }))
      }));
    } catch (error) {
      console.error('Erro ao buscar histórico:', error);
    }
  };

  const toggleHistorico = (negociacaoId: string) => {
    if (historicoExpandido === negociacaoId) {
      setHistoricoExpandido(null);
    } else {
      setHistoricoExpandido(negociacaoId);
      if (!historicos[negociacaoId]) {
        fetchHistorico(negociacaoId);
      }
    }
  };

  const handleCriarNegociacao = async () => {
    if (!novaNegociacao.titulo.trim() || !novaNegociacao.estagio_id) {
      toast.error('Preencha o título e selecione o estágio');
      return;
    }

    try {
      const { error } = await supabase
        .from('negociacoes')
        .insert({
          titulo: novaNegociacao.titulo.trim(),
          valor: novaNegociacao.valor ? parseFloat(novaNegociacao.valor) : 0,
          estagio_id: novaNegociacao.estagio_id,
          contato_id: contato.id,
          conta_id: usuario?.conta_id,
          status: 'aberto',
          probabilidade: 50,
        });

      if (error) throw error;

      toast.success('Negociação criada');
      setCriandoNegociacao(false);
      setNovaNegociacao({ titulo: '', valor: '', funil_id: '', estagio_id: '' });
      fetchNegociacoes();
    } catch (error) {
      console.error('Erro ao criar negociação:', error);
      toast.error('Erro ao criar negociação');
    }
  };

  const formatCurrency = (value: number | null) => {
    if (value === null || value === undefined) return 'R$ 0,00';
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case 'ganho':
        return 'bg-green-500/20 text-green-500';
      case 'perdido':
        return 'bg-red-500/20 text-red-500';
      default:
        return 'bg-blue-500/20 text-blue-500';
    }
  };

  const getEstagiosByFunilId = (funilId: string) => {
    const funil = funis.find(f => f.id === funilId);
    return funil?.estagios || [];
  };

  const getFunilByEstagioId = (estagioId: string | null) => {
    if (!estagioId) return null;
    for (const funil of funis) {
      if (funil.estagios.some(e => e.id === estagioId)) {
        return funil;
      }
    }
    return null;
  };

  const handleOpenDetalhe = (negociacao: Negociacao) => {
    setNegociacaoSelecionada(negociacao);
    setModalDetalheAberto(true);
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Overlay */}
      <div 
        className="fixed inset-0 bg-black/50 z-40"
        onClick={onClose}
      />
      
      {/* Sidebar */}
      <div className="fixed right-0 top-0 h-full w-96 bg-card border-l border-border z-50 flex flex-col animate-slide-in-right shadow-2xl">
        {/* Header */}
        <div className="p-4 border-b border-border flex items-center justify-between">
          <h3 className="text-lg font-semibold text-foreground">Detalhes do Contato</h3>
          <button
            onClick={onClose}
            className="p-2 hover:bg-muted rounded-lg transition-colors"
          >
            <X className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {/* Avatar e Nome */}
          <div className="flex flex-col items-center text-center">
            {contato.avatar_url ? (
              <img
                src={contato.avatar_url}
                alt={contato.nome}
                className="h-20 w-20 rounded-full object-cover mb-3"
              />
            ) : (
              <div className="h-20 w-20 rounded-full bg-primary/20 flex items-center justify-center text-primary text-2xl font-bold mb-3">
                {contato.nome.charAt(0).toUpperCase()}
              </div>
            )}
            <h4 className="text-xl font-semibold text-foreground">{contato.nome}</h4>
          </div>

          {/* Informações de Contato */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">Informações</span>
              {!editando ? (
                <button
                  onClick={() => setEditando(true)}
                  className="flex items-center gap-1 text-sm text-primary hover:underline"
                >
                  <Edit2 className="h-3 w-3" />
                  Editar
                </button>
              ) : (
                <button
                  onClick={handleSave}
                  disabled={salvando}
                  className="flex items-center gap-1 text-sm text-primary hover:underline disabled:opacity-50"
                >
                  <Save className="h-3 w-3" />
                  {salvando ? 'Salvando...' : 'Salvar'}
                </button>
              )}
            </div>

            {/* Telefone */}
            <div className="bg-muted/50 rounded-lg p-3 space-y-1">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Phone className="h-4 w-4" />
                <span className="text-xs">Telefone</span>
              </div>
              {editando ? (
                <input
                  type="text"
                  value={telefoneEdit}
                  onChange={(e) => setTelefoneEdit(e.target.value)}
                  className="w-full bg-background border border-border rounded px-2 py-1 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              ) : (
                <p className="text-sm font-medium text-foreground">{contato.telefone}</p>
              )}
            </div>

            {/* Email */}
            <div className="bg-muted/50 rounded-lg p-3 space-y-1">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Mail className="h-4 w-4" />
                <span className="text-xs">Email</span>
              </div>
              {editando ? (
                <input
                  type="email"
                  value={emailEdit}
                  onChange={(e) => setEmailEdit(e.target.value)}
                  placeholder="email@exemplo.com"
                  className="w-full bg-background border border-border rounded px-2 py-1 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              ) : (
                <p className="text-sm font-medium text-foreground">
                  {contato.email || <span className="text-muted-foreground italic">Não informado</span>}
                </p>
              )}
            </div>

            {/* Tags */}
            <div className="bg-muted/50 rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Tag className="h-4 w-4" />
                  <span className="text-xs">Tags</span>
                </div>
                <Popover open={tagPopoverOpen} onOpenChange={setTagPopoverOpen}>
                  <PopoverTrigger asChild>
                    <button 
                      className="flex items-center gap-1 text-xs text-primary hover:underline"
                      disabled={salvandoTags}
                    >
                      <Plus className="h-3 w-3" />
                      Gerenciar
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-64 p-2" align="end">
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-muted-foreground px-2 py-1">Selecione as tags:</p>
                      {tagsDisponiveis.length === 0 ? (
                        <p className="text-xs text-muted-foreground text-center py-4">
                          Nenhuma tag cadastrada.
                          <br />
                          <span className="text-primary">Configure em CRM → Configurações</span>
                        </p>
                      ) : (
                        tagsDisponiveis.map((tag) => {
                          const isSelected = contato.tags?.includes(tag.nome) || false;
                          return (
                            <button
                              key={tag.id}
                              onClick={() => handleToggleTag(tag.nome)}
                              disabled={salvandoTags}
                              className={cn(
                                "w-full flex items-center justify-between px-2 py-1.5 rounded-md text-sm transition-colors",
                                isSelected ? "bg-muted" : "hover:bg-muted/50"
                              )}
                            >
                              <div className="flex items-center gap-2">
                                <div 
                                  className="h-3 w-3 rounded-full shrink-0"
                                  style={{ backgroundColor: tag.cor }}
                                />
                                <span className="text-foreground">{tag.nome}</span>
                              </div>
                              {isSelected && (
                                <Check className="h-4 w-4 text-primary" />
                              )}
                            </button>
                          );
                        })
                      )}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
              {contato.tags && contato.tags.length > 0 ? (
                <div className="flex flex-wrap gap-1">
                  {contato.tags.map((tagNome, index) => (
                    <span
                      key={index}
                      className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full text-white"
                      style={{ backgroundColor: getTagColor(tagNome) }}
                    >
                      {tagNome}
                      <button
                        onClick={() => handleToggleTag(tagNome)}
                        disabled={salvandoTags}
                        className="hover:opacity-70 transition-opacity"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground italic">Nenhuma tag atribuída</p>
              )}
            </div>
          </div>

          {/* Negociações */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Briefcase className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium text-muted-foreground">
                  Negociações ({negociacoes.length})
                </span>
              </div>
              <button
                onClick={() => {
                  setCriandoNegociacao(true);
                  setNovaNegociacao({ titulo: contato.nome, valor: '', funil_id: '', estagio_id: '' });
                }}
                className="flex items-center gap-1 text-sm text-primary hover:underline"
              >
                <Plus className="h-3 w-3" />
                Nova
              </button>
            </div>

            {/* Form Nova Negociação */}
            {criandoNegociacao && (
              <div className="bg-muted/50 rounded-lg p-3 space-y-3 border border-primary/30">
                <input
                  type="text"
                  placeholder="Título da negociação"
                  value={novaNegociacao.titulo}
                  onChange={(e) => setNovaNegociacao(prev => ({ ...prev, titulo: e.target.value }))}
                  className="w-full bg-background border border-border rounded px-2 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <input
                  type="number"
                  placeholder="Valor (opcional)"
                  value={novaNegociacao.valor}
                  onChange={(e) => setNovaNegociacao(prev => ({ ...prev, valor: e.target.value }))}
                  className="w-full bg-background border border-border rounded px-2 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <Select
                  value={novaNegociacao.funil_id}
                  onValueChange={(value) => setNovaNegociacao(prev => ({ ...prev, funil_id: value, estagio_id: '' }))}
                >
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue placeholder="Selecione o funil" />
                  </SelectTrigger>
                  <SelectContent>
                    {funis.map(funil => (
                      <SelectItem key={funil.id} value={funil.id}>{funil.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {novaNegociacao.funil_id && (
                  <Select
                    value={novaNegociacao.estagio_id}
                    onValueChange={(value) => setNovaNegociacao(prev => ({ ...prev, estagio_id: value }))}
                  >
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue placeholder="Selecione o estágio" />
                    </SelectTrigger>
                    <SelectContent>
                      {getEstagiosByFunilId(novaNegociacao.funil_id).map(estagio => (
                        <SelectItem key={estagio.id} value={estagio.id}>{estagio.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={handleCriarNegociacao}
                    className="flex-1 bg-primary text-primary-foreground text-sm py-1.5 rounded hover:bg-primary/90 transition-colors"
                  >
                    Criar
                  </button>
                  <button
                    onClick={() => setCriandoNegociacao(false)}
                    className="flex-1 bg-muted text-muted-foreground text-sm py-1.5 rounded hover:bg-muted/80 transition-colors"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            {loadingNegociacoes ? (
              <div className="flex items-center justify-center py-4">
                <div className="h-5 w-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : negociacoes.length === 0 ? (
              <div className="text-center py-6 bg-muted/30 rounded-lg">
                <Briefcase className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
                <p className="text-sm text-muted-foreground">Nenhuma negociação</p>
              </div>
            ) : (
              <div className="space-y-3">
                {negociacoes.map((negociacao) => {
                  const funilAtual = getFunilByEstagioId(negociacao.estagio_id);
                  
                  return (
                    <div
                      key={negociacao.id}
                      className="bg-muted/50 rounded-lg p-3 space-y-3 hover:bg-muted/70 transition-colors"
                    >
                      {/* Header com título e menu */}
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium text-foreground line-clamp-1 flex-1">
                          {negociacao.titulo}
                        </p>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button className="p-1 hover:bg-muted rounded">
                              <MoreVertical className="h-4 w-4 text-muted-foreground" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleOpenDetalhe(negociacao)}>
                              Ver detalhes
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>

                      {/* Selects de Funil e Etapa */}
                      <div className="grid grid-cols-2 gap-2">
                        <Select
                          value={funilAtual?.id || ''}
                          onValueChange={(funilId) => {
                            const novoFunil = funis.find(f => f.id === funilId);
                            if (novoFunil && novoFunil.estagios.length > 0) {
                              handleUpdateNegociacao(negociacao.id, { 
                                estagio_id: novoFunil.estagios[0].id 
                              }, negociacao.estagio_id);
                            }
                          }}
                        >
                          <SelectTrigger className="h-7 text-xs">
                            <SelectValue placeholder="Funil" />
                          </SelectTrigger>
                          <SelectContent>
                            {funis.map(funil => (
                              <SelectItem key={funil.id} value={funil.id} className="text-xs">
                                {funil.nome}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        <Select
                          value={negociacao.estagio_id || ''}
                          onValueChange={(estagioId) => {
                            handleUpdateNegociacao(negociacao.id, { estagio_id: estagioId }, negociacao.estagio_id);
                          }}
                        >
                          <SelectTrigger className="h-7 text-xs">
                            <SelectValue placeholder="Etapa" />
                          </SelectTrigger>
                          <SelectContent>
                            {funilAtual?.estagios.map(estagio => (
                              <SelectItem key={estagio.id} value={estagio.id} className="text-xs">
                                {estagio.nome}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Valor e Status */}
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-foreground">
                          {formatCurrency(negociacao.valor)}
                        </span>
                        <Select
                          value={negociacao.status || 'aberto'}
                          onValueChange={(status: 'aberto' | 'ganho' | 'perdido') => {
                            handleUpdateNegociacao(negociacao.id, { status });
                          }}
                        >
                          <SelectTrigger className={cn(
                            "h-6 w-24 text-xs border-0",
                            getStatusBadge(negociacao.status)
                          )}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="aberto" className="text-xs">Aberto</SelectItem>
                            <SelectItem value="ganho" className="text-xs">Ganho</SelectItem>
                            <SelectItem value="perdido" className="text-xs">Perdido</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Histórico Toggle */}
                      <button
                        onClick={() => toggleHistorico(negociacao.id)}
                        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors w-full"
                      >
                        <History className="h-3 w-3" />
                        <span>Histórico</span>
                        {historicoExpandido === negociacao.id ? (
                          <ChevronUp className="h-3 w-3 ml-auto" />
                        ) : (
                          <ChevronDown className="h-3 w-3 ml-auto" />
                        )}
                      </button>

                      {/* Histórico Content */}
                      {historicoExpandido === negociacao.id && (
                        <div className="border-t border-border pt-2 space-y-2">
                          {!historicos[negociacao.id] ? (
                            <div className="flex items-center justify-center py-2">
                              <div className="h-4 w-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                            </div>
                          ) : historicos[negociacao.id].length === 0 ? (
                            <p className="text-xs text-muted-foreground text-center py-2">
                              Nenhuma movimentação registrada
                            </p>
                          ) : (
                            <div className="space-y-2 max-h-40 overflow-y-auto">
                              {historicos[negociacao.id].map((item) => (
                                <div key={item.id} className="text-xs space-y-0.5">
                                  <div className="flex items-center gap-1 text-muted-foreground">
                                    <span>{format(new Date(item.created_at), "dd/MM HH:mm", { locale: ptBR })}</span>
                                    {item.usuario && (
                                      <span className="text-foreground">• {item.usuario.nome}</span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-1 flex-wrap">
                                    {item.estagio_anterior && (
                                      <span 
                                        className="px-1.5 py-0.5 rounded text-xs"
                                        style={{ 
                                          backgroundColor: `${item.estagio_anterior.cor}20`,
                                          color: item.estagio_anterior.cor || undefined
                                        }}
                                      >
                                        {item.estagio_anterior.nome}
                                      </span>
                                    )}
                                    <span className="text-muted-foreground">→</span>
                                    {item.estagio_novo && (
                                      <span 
                                        className="px-1.5 py-0.5 rounded text-xs"
                                        style={{ 
                                          backgroundColor: `${item.estagio_novo.cor}20`,
                                          color: item.estagio_novo.cor || undefined
                                        }}
                                      >
                                        {item.estagio_novo.nome}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal de Detalhes */}
      {negociacaoSelecionada && (
        <NegociacaoDetalheModal
          isOpen={modalDetalheAberto}
          onClose={() => {
            setModalDetalheAberto(false);
            setNegociacaoSelecionada(null);
          }}
          negociacao={{
            id: negociacaoSelecionada.id,
            titulo: negociacaoSelecionada.titulo,
            valor: negociacaoSelecionada.valor || 0,
            status: negociacaoSelecionada.status || 'aberto',
            estagio_id: negociacaoSelecionada.estagio_id || '',
            contato_id: contato.id,
            contatos: {
              nome: contato.nome,
              telefone: contato.telefone,
            },
          }}
          onUpdate={() => {
            fetchNegociacoes();
          }}
          onDelete={() => {
            fetchNegociacoes();
            setModalDetalheAberto(false);
            setNegociacaoSelecionada(null);
          }}
          estagios={funis.flatMap(f => f.estagios)}
          funis={funis.map(f => ({ ...f, cor: '#3b82f6' }))}
        />
      )}
    </>
  );
}
