import { useState, useEffect, useMemo } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { 
  Plus, DollarSign, User, MoreVertical, GripVertical, Loader2, Settings, 
  Calendar, Percent, Bell, BellOff, Edit2, TrendingUp, Briefcase, Target,
  ArrowRight
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Link, useNavigate } from 'react-router-dom';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { NegociacaoDetalheModal } from '@/components/NegociacaoDetalheModal';

interface Estagio {
  id: string;
  nome: string;
  cor: string;
  ordem: number;
  funil_id?: string;
  followup_ativo?: boolean;
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
  created_at?: string;
  resumo_ia?: string;
  resumo_gerado_em?: string;
  contatos: {
    nome: string;
    telefone: string;
  };
}

interface Funil {
  id: string;
  nome: string;
  cor: string;
  estagios: Estagio[];
}

interface Contato {
  id: string;
  nome: string;
  telefone: string;
}

export default function CRM() {
  const { usuario } = useAuth();
  const navigate = useNavigate();
  const [funis, setFunis] = useState<Funil[]>([]);
  const [selectedFunilId, setSelectedFunilId] = useState<string | null>(null);
  const [negociacoes, setNegociacoes] = useState<Negociacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [dragging, setDragging] = useState<string | null>(null);
  const [dragOverEstagio, setDragOverEstagio] = useState<string | null>(null);
  
  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [contatos, setContatos] = useState<Contato[]>([]);
  const [novoContatoId, setNovoContatoId] = useState('');
  const [novoTitulo, setNovoTitulo] = useState('');
  const [tituloEditado, setTituloEditado] = useState(false);
  const [novoValor, setNovoValor] = useState('');
  const [novoEstagioId, setNovoEstagioId] = useState('');
  const [criando, setCriando] = useState(false);

  // Detalhe modal state
  const [negociacaoSelecionada, setNegociacaoSelecionada] = useState<Negociacao | null>(null);
  const [detalheModalOpen, setDetalheModalOpen] = useState(false);

  const selectedFunil = funis.find(f => f.id === selectedFunilId) || null;

  // Métricas calculadas
  const metricas = useMemo(() => {
    const negociacoesDoFunil = selectedFunil 
      ? negociacoes.filter(n => selectedFunil.estagios.some(e => e.id === n.estagio_id))
      : negociacoes;
    
    const totalPipeline = negociacoesDoFunil.reduce((acc, n) => acc + Number(n.valor), 0);
    const totalNegociacoes = negociacoesDoFunil.length;
    const mediaProbabilidade = totalNegociacoes > 0 
      ? Math.round(negociacoesDoFunil.reduce((acc, n) => acc + (n.probabilidade || 0), 0) / totalNegociacoes)
      : 0;
    
    return { totalPipeline, totalNegociacoes, mediaProbabilidade };
  }, [negociacoes, selectedFunil]);

  useEffect(() => {
    if (usuario?.conta_id) {
      fetchData();
    }
  }, [usuario]);

  useEffect(() => {
    const savedFunilId = localStorage.getItem('crm_selected_funil');
    if (savedFunilId && funis.some(f => f.id === savedFunilId)) {
      setSelectedFunilId(savedFunilId);
    } else if (funis.length > 0 && !selectedFunilId) {
      setSelectedFunilId(funis[0].id);
    }
  }, [funis]);

  const handleFunilChange = (funilId: string) => {
    setSelectedFunilId(funilId);
    localStorage.setItem('crm_selected_funil', funilId);
  };

  const fetchData = async () => {
    try {
      const [funisRes, negociacoesRes] = await Promise.all([
        supabase
          .from('funis')
          .select(`*, estagios(*)`)
          .eq('conta_id', usuario!.conta_id)
          .order('ordem'),
        supabase
          .from('negociacoes')
          .select(`*, contatos(nome, telefone)`)
          .eq('conta_id', usuario!.conta_id)
          .eq('status', 'aberto'),
      ]);

      if (funisRes.data) {
        const funisWithSortedEstagios = funisRes.data.map(funil => ({
          ...funil,
          estagios: (funil.estagios || []).sort(
            (a: Estagio, b: Estagio) => a.ordem - b.ordem
          )
        }));
        setFunis(funisWithSortedEstagios);
      }

      if (negociacoesRes.data) {
        setNegociacoes(negociacoesRes.data);
      }
    } catch (error) {
      console.error('Erro ao buscar dados:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchContatos = async () => {
    const { data } = await supabase
      .from('contatos')
      .select('id, nome, telefone')
      .eq('conta_id', usuario!.conta_id)
      .order('nome');
    if (data) setContatos(data);
  };

  const openModal = async () => {
    await fetchContatos();
    setNovoContatoId('');
    setNovoTitulo('');
    setTituloEditado(false);
    setNovoValor('');
    setNovoEstagioId(selectedFunil?.estagios[0]?.id || '');
    setModalOpen(true);
  };

  const handleContatoChange = (contatoId: string) => {
    setNovoContatoId(contatoId);
    if (!tituloEditado) {
      const contato = contatos.find(c => c.id === contatoId);
      if (contato) setNovoTitulo(contato.nome);
    }
  };

  const handleTituloChange = (valor: string) => {
    setNovoTitulo(valor);
    setTituloEditado(true);
  };

  const handleCriarNegociacao = async () => {
    if (!novoContatoId || !novoTitulo.trim()) {
      toast.error('Selecione um contato e preencha o título');
      return;
    }

    setCriando(true);
    try {
      const { data, error } = await supabase
        .from('negociacoes')
        .insert({
          titulo: novoTitulo.trim(),
          contato_id: novoContatoId,
          valor: parseFloat(novoValor) || 0,
          estagio_id: novoEstagioId || null,
          conta_id: usuario!.conta_id,
          status: 'aberto',
          probabilidade: 50,
        })
        .select('*, contatos(nome, telefone)')
        .single();

      if (error) throw error;

      setNegociacoes(prev => [...prev, data]);
      setModalOpen(false);
      toast.success('Negociação criada!');
    } catch (error) {
      toast.error('Erro ao criar negociação');
    } finally {
      setCriando(false);
    }
  };

  const handleDragStart = (e: React.DragEvent, negociacaoId: string) => {
    e.dataTransfer.setData('negociacaoId', negociacaoId);
    setDragging(negociacaoId);
  };

  const handleDragEnd = () => {
    setDragging(null);
    setDragOverEstagio(null);
  };

  const handleDragOver = (e: React.DragEvent, estagioId: string) => {
    e.preventDefault();
    setDragOverEstagio(estagioId);
  };

  const handleDragLeave = () => {
    setDragOverEstagio(null);
  };

  const handleDrop = async (e: React.DragEvent, estagioId: string) => {
    e.preventDefault();
    const negociacaoId = e.dataTransfer.getData('negociacaoId');
    setDragging(null);
    setDragOverEstagio(null);

    try {
      const { error } = await supabase
        .from('negociacoes')
        .update({ estagio_id: estagioId })
        .eq('id', negociacaoId);

      if (error) throw error;

      setNegociacoes((prev) =>
        prev.map((n) => (n.id === negociacaoId ? { ...n, estagio_id: estagioId } : n))
      );

      toast.success('Negociação movida!');
    } catch (error) {
      toast.error('Erro ao mover negociação');
    }
  };

  const handleAbrirDetalhes = (negociacao: Negociacao) => {
    setNegociacaoSelecionada(negociacao);
    setDetalheModalOpen(true);
  };

  const handleAtualizarNegociacao = (negociacaoAtualizada: Negociacao) => {
    setNegociacoes((prev) =>
      prev.map((n) => (n.id === negociacaoAtualizada.id ? negociacaoAtualizada : n))
    );
    setNegociacaoSelecionada(negociacaoAtualizada);
  };

  const handleExcluirNegociacao = (negociacaoId: string) => {
    setNegociacoes((prev) => prev.filter((n) => n.id !== negociacaoId));
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const getNegociacoesPorEstagio = (estagioId: string) => {
    return negociacoes.filter((n) => n.estagio_id === estagioId);
  };

  const getTotalPorEstagio = (estagioId: string) => {
    return getNegociacoesPorEstagio(estagioId).reduce((acc, n) => acc + Number(n.valor), 0);
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  };

  const getProbabilityColor = (prob: number | undefined) => {
    if (!prob) return { bg: 'bg-muted', border: 'border-muted-foreground/20', text: 'text-muted-foreground' };
    if (prob >= 70) return { bg: 'bg-emerald-500/20', border: 'border-emerald-500', text: 'text-emerald-500' };
    if (prob >= 40) return { bg: 'bg-amber-500/20', border: 'border-amber-500', text: 'text-amber-500' };
    return { bg: 'bg-muted', border: 'border-muted-foreground/30', text: 'text-muted-foreground' };
  };

  const handleToggleFollowup = async (estagio: Estagio) => {
    const novoValor = !(estagio.followup_ativo ?? true);
    try {
      const { error } = await supabase
        .from('estagios')
        .update({ followup_ativo: novoValor })
        .eq('id', estagio.id);

      if (error) throw error;

      setFunis(prev => prev.map(funil => ({
        ...funil,
        estagios: funil.estagios.map(e => 
          e.id === estagio.id ? { ...e, followup_ativo: novoValor } : e
        )
      })));

      toast.success(novoValor ? 'Follow-up ativado' : 'Follow-up desativado');
    } catch (error) {
      console.error('Erro ao atualizar follow-up:', error);
      toast.error('Erro ao atualizar follow-up');
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
      <div className="space-y-6 animate-fade-in">
        {/* Header com Métricas */}
        <div className="space-y-6">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground">CRM</h1>
              <p className="text-muted-foreground mt-1">
                Gerencie suas negociações e acompanhe o funil de vendas
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Link
                to="/crm/configuracoes"
                className="p-2.5 rounded-xl border border-border hover:bg-muted transition-all hover:scale-105"
                title="Configurações do CRM"
              >
                <Settings className="h-5 w-5 text-muted-foreground" />
              </Link>
              <button 
                onClick={openModal}
                className="h-11 px-5 rounded-xl bg-primary text-primary-foreground font-medium flex items-center gap-2 hover:bg-primary/90 transition-all hover:scale-105 shadow-lg shadow-primary/25"
              >
                <Plus className="h-5 w-5" />
                Nova Negociação
              </button>
            </div>
          </div>

          {/* Cards de Métricas */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border border-emerald-500/20">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-emerald-500/20">
                  <DollarSign className="h-5 w-5 text-emerald-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Pipeline</p>
                  <p className="text-2xl font-bold text-foreground">{formatCurrency(metricas.totalPipeline)}</p>
                </div>
              </div>
            </div>
            
            <div className="p-4 rounded-2xl bg-gradient-to-br from-blue-500/10 to-blue-500/5 border border-blue-500/20">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-blue-500/20">
                  <Briefcase className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Negociações</p>
                  <p className="text-2xl font-bold text-foreground">{metricas.totalNegociacoes}</p>
                </div>
              </div>
            </div>
            
            <div className="p-4 rounded-2xl bg-gradient-to-br from-violet-500/10 to-violet-500/5 border border-violet-500/20">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-violet-500/20">
                  <TrendingUp className="h-5 w-5 text-violet-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Prob. Média</p>
                  <p className="text-2xl font-bold text-foreground">{metricas.mediaProbabilidade}%</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Nova Negociação */}
        <Dialog open={modalOpen} onOpenChange={setModalOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Nova Negociação</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Contato *</Label>
                <Select value={novoContatoId} onValueChange={handleContatoChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um contato" />
                  </SelectTrigger>
                  <SelectContent>
                    {contatos.map((contato) => (
                      <SelectItem key={contato.id} value={contato.id}>
                        {contato.nome} - {contato.telefone}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Título da Negociação *</Label>
                <Input
                  value={novoTitulo}
                  onChange={(e) => handleTituloChange(e.target.value)}
                  placeholder="Nome da negociação"
                />
                {novoContatoId && !tituloEditado && (
                  <p className="text-xs text-muted-foreground">
                    Auto-preenchido com nome do contato
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Valor (R$)</Label>
                <Input
                  type="number"
                  value={novoValor}
                  onChange={(e) => setNovoValor(e.target.value)}
                  placeholder="0,00"
                  min="0"
                  step="0.01"
                />
              </div>

              <div className="space-y-2">
                <Label>Estágio Inicial</Label>
                <Select value={novoEstagioId} onValueChange={setNovoEstagioId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um estágio" />
                  </SelectTrigger>
                  <SelectContent>
                    {selectedFunil?.estagios.map((estagio) => (
                      <SelectItem key={estagio.id} value={estagio.id}>
                        <div className="flex items-center gap-2">
                          <div 
                            className="h-3 w-3 rounded-full" 
                            style={{ backgroundColor: estagio.cor }}
                          />
                          {estagio.nome}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button variant="outline" onClick={() => setModalOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleCriarNegociacao} disabled={criando}>
                  {criando ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Criar Negociação'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Seletor de Funil Aprimorado */}
        {funis.length > 0 && (
          <div className="flex items-center gap-4 p-4 rounded-2xl bg-card border border-border">
            <div className="flex items-center gap-2">
              <Target className="h-5 w-5 text-muted-foreground" />
              <span className="text-sm font-medium text-muted-foreground">Funil:</span>
            </div>
            <Select value={selectedFunilId || ''} onValueChange={handleFunilChange}>
              <SelectTrigger className="w-[280px] bg-background">
                <SelectValue placeholder="Selecione um funil" />
              </SelectTrigger>
              <SelectContent>
                {funis.map((funil) => (
                  <SelectItem key={funil.id} value={funil.id}>
                    <div className="flex items-center gap-3">
                      <div 
                        className="h-3 w-3 rounded-full ring-2 ring-offset-1 ring-offset-background" 
                        style={{ backgroundColor: funil.cor, boxShadow: `0 0 8px ${funil.cor}50` }}
                      />
                      <span className="font-medium">{funil.nome}</span>
                      <span className="text-xs text-muted-foreground">
                        ({funil.estagios.length} etapas)
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            {selectedFunil && (
              <div className="flex items-center gap-2 ml-auto text-sm text-muted-foreground">
                <span>{selectedFunil.estagios.length} etapas</span>
                <span>•</span>
                <span>{formatCurrency(metricas.totalPipeline)} em pipeline</span>
              </div>
            )}
          </div>
        )}

        {/* Pipeline Progress Bar */}
        {selectedFunil && selectedFunil.estagios.length > 0 && (
          <div className="flex items-center gap-1 px-1">
            {selectedFunil.estagios.map((estagio, index) => {
              const count = getNegociacoesPorEstagio(estagio.id).length;
              const total = metricas.totalNegociacoes || 1;
              const width = Math.max(count / total * 100, 5);
              
              return (
                <div key={estagio.id} className="flex items-center flex-1">
                  <div 
                    className="h-2 rounded-full transition-all duration-500"
                    style={{ 
                      backgroundColor: estagio.cor,
                      width: `${width}%`,
                      minWidth: '20px',
                      opacity: count > 0 ? 1 : 0.3
                    }}
                    title={`${estagio.nome}: ${count} negociações`}
                  />
                  {index < selectedFunil.estagios.length - 1 && (
                    <ArrowRight className="h-3 w-3 text-muted-foreground/30 mx-1 flex-shrink-0" />
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Kanban */}
        {selectedFunil ? (
          <div 
            className="flex gap-5 overflow-x-auto pb-4 pt-2"
            style={{ transform: 'rotateX(180deg)' }}
          >
            {selectedFunil.estagios.map((estagio, estagioIndex) => {
              const negociacoesEstagio = getNegociacoesPorEstagio(estagio.id);
              const isDropTarget = dragOverEstagio === estagio.id;
              
              return (
                <div
                  key={estagio.id}
                  className={cn(
                    "flex-shrink-0 w-80 transition-all duration-300",
                    isDropTarget && "scale-[1.02]"
                  )}
                  style={{ 
                    transform: 'rotateX(180deg)',
                    animationDelay: `${estagioIndex * 50}ms`
                  }}
                  onDragOver={(e) => handleDragOver(e, estagio.id)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, estagio.id)}
                >
                  {/* Header do Estágio */}
                  <div 
                    className={cn(
                      "mb-4 p-4 rounded-2xl border transition-all duration-300",
                      isDropTarget 
                        ? "border-primary shadow-lg shadow-primary/20" 
                        : "border-border"
                    )}
                    style={{
                      background: `linear-gradient(135deg, ${estagio.cor}15, ${estagio.cor}05)`,
                      borderLeft: `4px solid ${estagio.cor}`
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div
                          className="h-3 w-3 rounded-full ring-2 ring-offset-2 ring-offset-card"
                          style={{ 
                            backgroundColor: estagio.cor,
                            boxShadow: `0 0 12px ${estagio.cor}60`
                          }}
                        />
                        <h3 className="font-semibold text-foreground">{estagio.nome}</h3>
                        <span className="text-xs font-medium text-foreground bg-background/80 px-2.5 py-1 rounded-full border border-border">
                          {negociacoesEstagio.length}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {estagio.followup_ativo === false ? (
                          <span title="Follow-up desativado" className="text-muted-foreground/40">
                            <BellOff className="h-4 w-4" />
                          </span>
                        ) : (
                          <span title="Follow-up ativo" className="text-primary/60">
                            <Bell className="h-4 w-4" />
                          </span>
                        )}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button className="p-1.5 rounded-lg hover:bg-background/80 transition-colors">
                              <MoreVertical className="h-4 w-4 text-muted-foreground" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => navigate('/crm/configuracoes')}>
                              <Edit2 className="h-4 w-4 mr-2" />
                              Editar etapa
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleToggleFollowup(estagio)}>
                              {estagio.followup_ativo === false ? (
                                <>
                                  <Bell className="h-4 w-4 mr-2" />
                                  Ativar follow-up
                                </>
                              ) : (
                                <>
                                  <BellOff className="h-4 w-4 mr-2" />
                                  Desativar follow-up
                                </>
                              )}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                    {/* Total */}
                    <div className="mt-3 pt-3 border-t border-border/50 flex items-center gap-2">
                      <DollarSign className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium text-foreground">
                        {formatCurrency(getTotalPorEstagio(estagio.id))}
                      </span>
                    </div>
                  </div>

                  {/* Cards */}
                  <div className="space-y-3 min-h-[200px]">
                    {negociacoesEstagio.map((negociacao, cardIndex) => {
                      const probColors = getProbabilityColor(negociacao.probabilidade);
                      
                      return (
                        <div
                          key={negociacao.id}
                          draggable
                          onDragStart={(e) => handleDragStart(e, negociacao.id)}
                          onDragEnd={handleDragEnd}
                          onClick={() => handleAbrirDetalhes(negociacao)}
                          className={cn(
                            'group relative rounded-2xl bg-card border cursor-pointer transition-all duration-300',
                            'hover:shadow-xl hover:shadow-black/10 hover:-translate-y-1',
                            dragging === negociacao.id 
                              ? 'opacity-50 cursor-grabbing rotate-2 scale-105' 
                              : 'hover:border-primary/30'
                          )}
                          style={{
                            animationDelay: `${cardIndex * 30}ms`,
                            borderTop: `3px solid ${probColors.border === 'border-emerald-500' ? '#10b981' : probColors.border === 'border-amber-500' ? '#f59e0b' : 'hsl(var(--muted-foreground) / 0.3)'}`
                          }}
                        >
                          <div className="p-4">
                            {/* Header com Grip e Probabilidade */}
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                <GripVertical className="h-4 w-4 text-muted-foreground/50 cursor-grab opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                                <h4 className="font-semibold text-foreground truncate">{negociacao.titulo}</h4>
                              </div>
                              <div className={cn(
                                'flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold flex-shrink-0',
                                probColors.bg, probColors.text
                              )}>
                                <Percent className="h-3 w-3" />
                                {negociacao.probabilidade || 0}
                              </div>
                            </div>

                            {/* Avatar e Nome do Contato */}
                            <div className="flex items-center gap-3 mb-4">
                              <div 
                                className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold flex-shrink-0"
                                style={{
                                  backgroundColor: `${estagio.cor}25`,
                                  color: estagio.cor
                                }}
                              >
                                {negociacao.contatos?.nome ? getInitials(negociacao.contatos.nome) : <User className="h-4 w-4" />}
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-medium text-foreground truncate">
                                  {negociacao.contatos?.nome || 'Sem contato'}
                                </p>
                                <p className="text-xs text-muted-foreground">Contato</p>
                              </div>
                            </div>

                            {/* Valor e Data */}
                            <div className="flex items-center justify-between pt-3 border-t border-border/50">
                              <div className="flex items-center gap-2">
                                <div className="p-1.5 rounded-lg bg-emerald-500/10">
                                  <DollarSign className="h-4 w-4 text-emerald-500" />
                                </div>
                                <span className="font-bold text-foreground">
                                  {formatCurrency(Number(negociacao.valor))}
                                </span>
                              </div>
                              {negociacao.created_at && (
                                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                  <Calendar className="h-3.5 w-3.5" />
                                  <span>
                                    {formatDistanceToNow(new Date(negociacao.created_at), { 
                                      addSuffix: true, 
                                      locale: ptBR 
                                    })}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    {/* Empty State */}
                    {negociacoesEstagio.length === 0 && (
                      <div 
                        className={cn(
                          "p-8 rounded-2xl border-2 border-dashed text-center transition-all duration-300",
                          isDropTarget 
                            ? "border-primary bg-primary/5 scale-[1.02]" 
                            : "border-border/50"
                        )}
                      >
                        <div 
                          className="w-12 h-12 rounded-2xl mx-auto mb-3 flex items-center justify-center"
                          style={{ backgroundColor: `${estagio.cor}15` }}
                        >
                          <Target className="h-6 w-6" style={{ color: estagio.cor }} />
                        </div>
                        <p className="text-sm font-medium text-muted-foreground">
                          {isDropTarget ? 'Solte aqui!' : 'Arraste negociações'}
                        </p>
                        <p className="text-xs text-muted-foreground/70 mt-1">
                          para esta etapa
                        </p>
                        <button
                          onClick={openModal}
                          className="mt-4 text-xs font-medium text-primary hover:underline"
                        >
                          + Criar negociação
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-16">
            <div className="w-16 h-16 rounded-2xl bg-muted mx-auto mb-4 flex items-center justify-center">
              <Target className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">Nenhum funil configurado</h3>
            <p className="text-muted-foreground mb-4">
              Configure seu primeiro funil para começar a gerenciar negociações
            </p>
            <Link
              to="/crm/configuracoes"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors"
            >
              <Settings className="h-4 w-4" />
              Configurar CRM
            </Link>
          </div>
        )}

        {/* Modal de Detalhes da Negociação */}
        <NegociacaoDetalheModal
          negociacao={negociacaoSelecionada}
          isOpen={detalheModalOpen}
          onClose={() => {
            setDetalheModalOpen(false);
            setNegociacaoSelecionada(null);
          }}
          onUpdate={handleAtualizarNegociacao}
          onDelete={handleExcluirNegociacao}
          estagios={selectedFunil?.estagios || []}
          funis={funis}
        />
      </div>
    </MainLayout>
  );
}
