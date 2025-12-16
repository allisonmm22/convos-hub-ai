import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { 
  Loader2, 
  Trash2, 
  Save, 
  User, 
  Phone, 
  MessageSquare,
  Sparkles,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Estagio {
  id: string;
  nome: string;
  cor: string;
  ordem: number;
  funil_id?: string;
}

interface Funil {
  id: string;
  nome: string;
  cor: string;
  estagios: Estagio[];
}

interface Negociacao {
  id: string;
  titulo: string;
  valor: number;
  estagio_id: string;
  contato_id: string;
  status?: string;
  probabilidade?: number;
  notas?: string;
  data_fechamento?: string;
  resumo_ia?: string;
  resumo_gerado_em?: string;
  contatos: {
    nome: string;
    telefone: string;
  };
}

interface Mensagem {
  id: string;
  conteudo: string;
  direcao: 'entrada' | 'saida';
  created_at: string;
  enviada_por_ia: boolean;
}

interface NegociacaoDetalheModalProps {
  negociacao: Negociacao | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (negociacao: Negociacao) => void;
  onDelete: (negociacaoId: string) => void;
  estagios: Estagio[];
  funis: Funil[];
}

export function NegociacaoDetalheModal({
  negociacao,
  isOpen,
  onClose,
  onUpdate,
  onDelete,
  estagios,
  funis,
}: NegociacaoDetalheModalProps) {
  const [editando, setEditando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deletando, setDeletando] = useState(false);
  
  // Form state
  const [titulo, setTitulo] = useState('');
  const [valor, setValor] = useState('');
  const [status, setStatus] = useState('aberto');
  const [probabilidade, setProbabilidade] = useState(50);
  const [notas, setNotas] = useState('');
  const [estagioId, setEstagioId] = useState('');
  
  // Conversa state
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [conversaId, setConversaId] = useState<string | null>(null);
  const [loadingMensagens, setLoadingMensagens] = useState(false);
  const [resumo, setResumo] = useState<string | null>(null);
  const [resumoGeradoEm, setResumoGeradoEm] = useState<string | null>(null);
  const [gerandoResumo, setGerandoResumo] = useState(false);
  const [mensagensExpandidas, setMensagensExpandidas] = useState(false);

  // All stages from all funnels
  const todosEstagios = funis.flatMap(f => f.estagios.map(e => ({ ...e, funil_nome: f.nome })));

  useEffect(() => {
    if (negociacao) {
      setTitulo(negociacao.titulo);
      setValor(String(negociacao.valor || 0));
      setStatus(negociacao.status || 'aberto');
      setProbabilidade(negociacao.probabilidade || 50);
      setNotas(negociacao.notas || '');
      setEstagioId(negociacao.estagio_id || '');
      // Load saved summary if exists
      setResumo(negociacao.resumo_ia || null);
      setResumoGeradoEm(negociacao.resumo_gerado_em || null);
      setMensagensExpandidas(false);
      
      // Fetch conversation
      fetchConversa(negociacao.contato_id);
    }
  }, [negociacao]);

  const fetchConversa = async (contatoId: string) => {
    setLoadingMensagens(true);
    try {
      // Find conversation for this contact
      const { data: conversaData } = await supabase
        .from('conversas')
        .select('id')
        .eq('contato_id', contatoId)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (conversaData) {
        setConversaId(conversaData.id);
        
        // Fetch messages
        const { data: mensagensData } = await supabase
          .from('mensagens')
          .select('id, conteudo, direcao, created_at, enviada_por_ia')
          .eq('conversa_id', conversaData.id)
          .order('created_at', { ascending: false })
          .limit(50);

        setMensagens(mensagensData || []);
      } else {
        setConversaId(null);
        setMensagens([]);
      }
    } catch (error) {
      console.error('Erro ao buscar conversa:', error);
    } finally {
      setLoadingMensagens(false);
    }
  };

  const handleSalvar = async () => {
    if (!negociacao) return;
    
    setSalvando(true);
    try {
      const { error } = await supabase
        .from('negociacoes')
        .update({
          titulo: titulo.trim(),
          valor: parseFloat(valor) || 0,
          status: status as 'aberto' | 'ganho' | 'perdido',
          probabilidade,
          notas: notas.trim() || null,
          estagio_id: estagioId || null,
        })
        .eq('id', negociacao.id);

      if (error) throw error;

      onUpdate({
        ...negociacao,
        titulo: titulo.trim(),
        valor: parseFloat(valor) || 0,
        status: status as 'aberto' | 'ganho' | 'perdido',
        probabilidade,
        notas: notas.trim() || undefined,
        estagio_id: estagioId,
      } as Negociacao);

      setEditando(false);
      toast.success('Negociação atualizada!');
    } catch (error) {
      console.error('Erro ao atualizar:', error);
      toast.error('Erro ao atualizar negociação');
    } finally {
      setSalvando(false);
    }
  };

  const handleExcluir = async () => {
    if (!negociacao) return;
    
    setDeletando(true);
    try {
      const { error } = await supabase
        .from('negociacoes')
        .delete()
        .eq('id', negociacao.id);

      if (error) throw error;

      onDelete(negociacao.id);
      setConfirmDelete(false);
      onClose();
      toast.success('Negociação excluída!');
    } catch (error) {
      console.error('Erro ao excluir:', error);
      toast.error('Erro ao excluir negociação');
    } finally {
      setDeletando(false);
    }
  };

  const gerarResumo = async () => {
    if (!conversaId || !negociacao) {
      toast.error('Nenhuma conversa encontrada para este contato');
      return;
    }

    setGerandoResumo(true);
    try {
      const { data, error } = await supabase.functions.invoke('resumir-conversa', {
        body: { 
          conversa_id: conversaId,
          negociacao_id: negociacao.id
        }
      });

      if (error) throw error;
      
      setResumo(data.resumo);
      setResumoGeradoEm(new Date().toISOString());
      toast.success('Resumo gerado com sucesso!');
    } catch (error) {
      console.error('Erro ao gerar resumo:', error);
      toast.error('Erro ao gerar resumo da conversa');
    } finally {
      setGerandoResumo(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (!negociacao) return null;

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle className="text-xl">Detalhes da Negociação</DialogTitle>
              <div className="flex items-center gap-2">
                {editando ? (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setEditando(false)}
                      disabled={salvando}
                    >
                      Cancelar
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleSalvar}
                      disabled={salvando}
                    >
                      {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
                      Salvar
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setEditando(true)}
                    >
                      Editar
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => setConfirmDelete(true)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </>
                )}
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Informações Principais */}
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 space-y-2">
                <Label>Título</Label>
                {editando ? (
                  <Input
                    value={titulo}
                    onChange={(e) => setTitulo(e.target.value)}
                    placeholder="Título da negociação"
                  />
                ) : (
                  <p className="text-lg font-semibold text-foreground">{negociacao.titulo}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Valor</Label>
                {editando ? (
                  <Input
                    type="number"
                    value={valor}
                    onChange={(e) => setValor(e.target.value)}
                    placeholder="0,00"
                    min="0"
                    step="0.01"
                  />
                ) : (
                  <p className="text-lg font-bold text-success">{formatCurrency(negociacao.valor)}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Status</Label>
                {editando ? (
                  <Select value={status} onValueChange={setStatus}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="aberto">Aberto</SelectItem>
                      <SelectItem value="ganho">Ganho</SelectItem>
                      <SelectItem value="perdido">Perdido</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <div className={cn(
                    'inline-flex px-2.5 py-1 rounded-full text-sm font-medium',
                    negociacao.status === 'ganho' && 'bg-success/20 text-success',
                    negociacao.status === 'perdido' && 'bg-destructive/20 text-destructive',
                    negociacao.status === 'aberto' && 'bg-primary/20 text-primary'
                  )}>
                    {negociacao.status === 'ganho' ? 'Ganho' : negociacao.status === 'perdido' ? 'Perdido' : 'Aberto'}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label>Estágio</Label>
                {editando ? (
                  <Select value={estagioId} onValueChange={setEstagioId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um estágio" />
                    </SelectTrigger>
                    <SelectContent>
                      {funis.map((funil) => (
                        <div key={funil.id}>
                          <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                            {funil.nome}
                          </div>
                          {funil.estagios.map((estagio) => (
                            <SelectItem key={estagio.id} value={estagio.id}>
                              <div className="flex items-center gap-2">
                                <div 
                                  className="h-2.5 w-2.5 rounded-full" 
                                  style={{ backgroundColor: estagio.cor }}
                                />
                                {estagio.nome}
                              </div>
                            </SelectItem>
                          ))}
                        </div>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="flex items-center gap-2">
                    {estagios.find(e => e.id === negociacao.estagio_id) && (
                      <>
                        <div 
                          className="h-3 w-3 rounded-full" 
                          style={{ backgroundColor: estagios.find(e => e.id === negociacao.estagio_id)?.cor }}
                        />
                        <span className="text-foreground">
                          {estagios.find(e => e.id === negociacao.estagio_id)?.nome}
                        </span>
                      </>
                    )}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label>Probabilidade: {probabilidade}%</Label>
                {editando ? (
                  <Slider
                    value={[probabilidade]}
                    onValueChange={([val]) => setProbabilidade(val)}
                    min={0}
                    max={100}
                    step={5}
                  />
                ) : (
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-primary transition-all"
                      style={{ width: `${negociacao.probabilidade || 50}%` }}
                    />
                  </div>
                )}
              </div>

              <div className="col-span-2 space-y-2">
                <Label>Notas</Label>
                {editando ? (
                  <Textarea
                    value={notas}
                    onChange={(e) => setNotas(e.target.value)}
                    placeholder="Anotações sobre a negociação..."
                    rows={3}
                  />
                ) : (
                  <p className="text-muted-foreground text-sm">
                    {negociacao.notas || 'Sem anotações'}
                  </p>
                )}
              </div>
            </div>

            {/* Contato */}
            <div className="border-t border-border pt-4">
              <h4 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                <User className="h-4 w-4" />
                Contato
              </h4>
              <div className="flex items-center gap-4 p-3 rounded-lg bg-muted/50">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/20">
                  <User className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium text-foreground">{negociacao.contatos?.nome}</p>
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <Phone className="h-3 w-3" />
                    {negociacao.contatos?.telefone}
                  </p>
                </div>
              </div>
            </div>

            {/* Histórico da Conversa */}
            <div className="border-t border-border pt-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-semibold text-foreground flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" />
                  Histórico da Conversa
                </h4>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={gerarResumo}
                  disabled={gerandoResumo || !conversaId}
                >
                  {gerandoResumo ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-1" />
                  ) : (
                    <Sparkles className="h-4 w-4 mr-1" />
                  )}
                  {resumo ? '🔄 Atualizar Resumo' : 'Gerar Resumo IA'}
                </Button>
              </div>

              {/* Resumo IA */}
              {resumo && (
                <div className="mb-4 p-4 rounded-lg bg-primary/5 border border-primary/20">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-primary" />
                      <span className="font-medium text-primary text-sm">Resumo da IA</span>
                    </div>
                    {resumoGeradoEm && (
                      <span className="text-xs text-muted-foreground">
                        Gerado em: {new Date(resumoGeradoEm).toLocaleString('pt-BR', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-foreground whitespace-pre-wrap">{resumo}</div>
                </div>
              )}

              {loadingMensagens ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : mensagens.length > 0 ? (
                <div className="space-y-2">
                  <button
                    onClick={() => setMensagensExpandidas(!mensagensExpandidas)}
                    className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {mensagensExpandidas ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    {mensagensExpandidas ? 'Recolher mensagens' : `Ver ${mensagens.length} mensagens`}
                  </button>
                  
                  {mensagensExpandidas && (
                    <div className="space-y-2 max-h-[300px] overflow-y-auto rounded-lg border border-border p-3">
                      {[...mensagens].reverse().map((msg) => (
                        <div
                          key={msg.id}
                          className={cn(
                            'p-2 rounded-lg text-sm',
                            msg.direcao === 'entrada' 
                              ? 'bg-muted text-foreground' 
                              : 'bg-primary/10 text-foreground'
                          )}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium text-xs">
                              {msg.direcao === 'entrada' ? 'Lead' : msg.enviada_por_ia ? 'Agente IA' : 'Atendente'}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {formatDate(msg.created_at)}
                            </span>
                          </div>
                          <p className="break-words">{msg.conteudo}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Nenhuma conversa encontrada para este contato
                </p>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirmação de Exclusão */}
      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Negociação</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir a negociação "{negociacao.titulo}"? 
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletando}>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleExcluir}
              disabled={deletando}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletando ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
