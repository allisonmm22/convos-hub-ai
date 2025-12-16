import { useState, useEffect } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Plus, DollarSign, User, MoreVertical, GripVertical, Loader2, Settings, Calendar, Percent } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Link } from 'react-router-dom';
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
  const [funis, setFunis] = useState<Funil[]>([]);
  const [selectedFunilId, setSelectedFunilId] = useState<string | null>(null);
  const [negociacoes, setNegociacoes] = useState<Negociacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [dragging, setDragging] = useState<string | null>(null);
  
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

  useEffect(() => {
    if (usuario?.conta_id) {
      fetchData();
    }
  }, [usuario]);

  useEffect(() => {
    // Load last selected funil from localStorage
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

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (e: React.DragEvent, estagioId: string) => {
    e.preventDefault();
    const negociacaoId = e.dataTransfer.getData('negociacaoId');
    setDragging(null);

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
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">CRM</h1>
            <p className="text-muted-foreground mt-1">
              Gerencie suas negociações e acompanhe o funil de vendas.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              to="/crm/configuracoes"
              className="p-2.5 rounded-lg border border-border hover:bg-muted transition-colors"
              title="Configurações do CRM"
            >
              <Settings className="h-5 w-5 text-muted-foreground" />
            </Link>
            <button 
              onClick={openModal}
              className="h-10 px-4 rounded-lg bg-primary text-primary-foreground font-medium flex items-center gap-2 hover:bg-primary/90 transition-colors"
            >
              <Plus className="h-5 w-5" />
              Nova Negociação
            </button>
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

        <div className="space-y-6">
        </div>

        {/* Funnel Selector */}
        {funis.length > 0 && (
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">Funil:</span>
            <Select value={selectedFunilId || ''} onValueChange={handleFunilChange}>
              <SelectTrigger className="w-[250px]">
                <SelectValue placeholder="Selecione um funil" />
              </SelectTrigger>
              <SelectContent>
                {funis.map((funil) => (
                  <SelectItem key={funil.id} value={funil.id}>
                    <div className="flex items-center gap-2">
                      <div 
                        className="h-3 w-3 rounded-full" 
                        style={{ backgroundColor: funil.cor }}
                      />
                      {funil.nome}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Kanban */}
        {selectedFunil ? (
          <div 
            className="flex gap-4 overflow-x-auto pt-4"
            style={{ transform: 'rotateX(180deg)' }}
          >
            {selectedFunil.estagios.map((estagio) => (
              <div
                key={estagio.id}
                className="flex-shrink-0 w-80"
                style={{ transform: 'rotateX(180deg)' }}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, estagio.id)}
              >
                {/* Header do Estágio */}
                <div className="flex items-center justify-between mb-4 p-3 rounded-lg bg-card border border-border">
                  <div className="flex items-center gap-3">
                    <div
                      className="h-3 w-3 rounded-full"
                      style={{ backgroundColor: estagio.cor }}
                    />
                    <h3 className="font-semibold text-foreground">{estagio.nome}</h3>
                    <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                      {getNegociacoesPorEstagio(estagio.id).length}
                    </span>
                  </div>
                  <button className="p-1 rounded hover:bg-muted transition-colors">
                    <MoreVertical className="h-4 w-4 text-muted-foreground" />
                  </button>
                </div>

                {/* Total */}
                <div className="mb-3 text-sm text-muted-foreground">
                  Total: {formatCurrency(getTotalPorEstagio(estagio.id))}
                </div>

                {/* Cards */}
                <div className="space-y-3 min-h-[200px]">
                  {getNegociacoesPorEstagio(estagio.id).map((negociacao) => (
                    <div
                      key={negociacao.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, negociacao.id)}
                      onClick={() => handleAbrirDetalhes(negociacao)}
                      className={cn(
                        'p-4 rounded-xl bg-card border border-border cursor-pointer transition-all',
                        'hover:border-primary/50 hover:shadow-md',
                        dragging === negociacao.id && 'opacity-50 cursor-grabbing'
                      )}
                    >
                      {/* Header */}
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab flex-shrink-0" />
                          <h4 className="font-medium text-foreground truncate">{negociacao.titulo}</h4>
                        </div>
                        {/* Probabilidade Badge */}
                        <div className={cn(
                          'flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0',
                          negociacao.probabilidade && negociacao.probabilidade >= 70 
                            ? 'bg-success/20 text-success'
                            : negociacao.probabilidade && negociacao.probabilidade >= 40 
                              ? 'bg-warning/20 text-warning'
                              : 'bg-muted text-muted-foreground'
                        )}>
                          <Percent className="h-3 w-3" />
                          {negociacao.probabilidade || 0}
                        </div>
                      </div>

                      {/* Contato */}
                      <div className="flex items-center gap-2 mb-3">
                        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/20 flex-shrink-0">
                          <User className="h-3 w-3 text-primary" />
                        </div>
                        <span className="text-sm text-muted-foreground truncate">
                          {negociacao.contatos?.nome || 'Sem contato'}
                        </span>
                      </div>

                      {/* Valor e Data */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <DollarSign className="h-4 w-4 text-success" />
                          <span className="font-semibold text-success">
                            {formatCurrency(Number(negociacao.valor))}
                          </span>
                        </div>
                        {negociacao.created_at && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Calendar className="h-3 w-3" />
                            <span>{format(new Date(negociacao.created_at), 'dd MMM', { locale: ptBR })}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}

                  {getNegociacoesPorEstagio(estagio.id).length === 0 && (
                    <div className="p-8 rounded-xl border-2 border-dashed border-border text-center text-muted-foreground">
                      <p className="text-sm">Arraste negociações para cá</p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            <p>Nenhum funil configurado</p>
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
