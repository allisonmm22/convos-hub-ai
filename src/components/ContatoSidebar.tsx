import { useState, useEffect } from 'react';
import { X, Phone, Edit2, Save, User, Briefcase, Mail, Tag } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface Contato {
  id: string;
  nome: string;
  telefone: string;
  email?: string | null;
  avatar_url: string | null;
  tags?: string[] | null;
}

interface Negociacao {
  id: string;
  titulo: string;
  valor: number | null;
  status: 'aberto' | 'ganho' | 'perdido' | null;
  created_at: string;
  estagio?: {
    nome: string;
    cor: string | null;
  } | null;
}

interface ContatoSidebarProps {
  contato: Contato;
  isOpen: boolean;
  onClose: () => void;
  onContatoUpdate?: (contato: Contato) => void;
}

export function ContatoSidebar({ contato, isOpen, onClose, onContatoUpdate }: ContatoSidebarProps) {
  const [editando, setEditando] = useState(false);
  const [telefoneEdit, setTelefoneEdit] = useState(contato.telefone);
  const [emailEdit, setEmailEdit] = useState(contato.email || '');
  const [salvando, setSalvando] = useState(false);
  const [negociacoes, setNegociacoes] = useState<Negociacao[]>([]);
  const [loadingNegociacoes, setLoadingNegociacoes] = useState(false);

  useEffect(() => {
    setTelefoneEdit(contato.telefone);
    setEmailEdit(contato.email || '');
    setEditando(false);
    if (isOpen) {
      fetchNegociacoes();
    }
  }, [contato, isOpen]);

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
          estagios:estagio_id (
            nome,
            cor
          )
        `)
        .eq('contato_id', contato.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Transform data to match interface
      const transformedData = (data || []).map((n: any) => ({
        ...n,
        estagio: n.estagios
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

  const getStatusLabel = (status: string | null) => {
    switch (status) {
      case 'ganho':
        return 'Ganho';
      case 'perdido':
        return 'Perdido';
      default:
        return 'Aberto';
    }
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
            <div className="h-20 w-20 rounded-full bg-primary/20 flex items-center justify-center text-primary text-2xl font-bold mb-3">
              {contato.nome.charAt(0).toUpperCase()}
            </div>
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
            {contato.tags && contato.tags.length > 0 && (
              <div className="bg-muted/50 rounded-lg p-3 space-y-2">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Tag className="h-4 w-4" />
                  <span className="text-xs">Tags</span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {contato.tags.map((tag, index) => (
                    <span
                      key={index}
                      className="px-2 py-0.5 bg-primary/20 text-primary text-xs rounded-full"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Negociações */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Briefcase className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium text-muted-foreground">
                Negociações ({negociacoes.length})
              </span>
            </div>

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
              <div className="space-y-2">
                {negociacoes.map((negociacao) => (
                  <div
                    key={negociacao.id}
                    className="bg-muted/50 rounded-lg p-3 space-y-2 hover:bg-muted/70 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium text-foreground line-clamp-1">
                        {negociacao.titulo}
                      </p>
                      <span className={cn(
                        'px-2 py-0.5 rounded-full text-xs font-medium shrink-0',
                        getStatusBadge(negociacao.status)
                      )}>
                        {getStatusLabel(negociacao.status)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">
                        {negociacao.estagio?.nome || 'Sem estágio'}
                      </span>
                      <span className="font-medium text-foreground">
                        {formatCurrency(negociacao.valor)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
