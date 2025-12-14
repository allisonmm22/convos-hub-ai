import { useState, useEffect } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Plus, DollarSign, User, MoreVertical, GripVertical, Loader2, Settings } from 'lucide-react';
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

interface Estagio {
  id: string;
  nome: string;
  cor: string;
  ordem: number;
}

interface Negociacao {
  id: string;
  titulo: string;
  valor: number;
  estagio_id: string;
  contato_id: string;
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

export default function CRM() {
  const { usuario } = useAuth();
  const [funis, setFunis] = useState<Funil[]>([]);
  const [selectedFunilId, setSelectedFunilId] = useState<string | null>(null);
  const [negociacoes, setNegociacoes] = useState<Negociacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [dragging, setDragging] = useState<string | null>(null);

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
            <button className="h-10 px-4 rounded-lg bg-primary text-primary-foreground font-medium flex items-center gap-2 hover:bg-primary/90 transition-colors">
              <Plus className="h-5 w-5" />
              Nova Negociação
            </button>
          </div>
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
          <div className="flex gap-4 overflow-x-auto pb-4">
            {selectedFunil.estagios.map((estagio) => (
              <div
                key={estagio.id}
                className="flex-shrink-0 w-80"
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
                      className={cn(
                        'p-4 rounded-xl bg-card border border-border cursor-grab active:cursor-grabbing transition-all',
                        'hover:border-primary/50 hover:shadow-md',
                        dragging === negociacao.id && 'opacity-50'
                      )}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <GripVertical className="h-4 w-4 text-muted-foreground" />
                          <h4 className="font-medium text-foreground">{negociacao.titulo}</h4>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 mb-3">
                        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/20">
                          <User className="h-3 w-3 text-primary" />
                        </div>
                        <span className="text-sm text-muted-foreground">
                          {negociacao.contatos?.nome || 'Sem contato'}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <DollarSign className="h-4 w-4 text-success" />
                        <span className="font-semibold text-success">
                          {formatCurrency(Number(negociacao.valor))}
                        </span>
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
      </div>
    </MainLayout>
  );
}
