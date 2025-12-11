import { useState, useEffect } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Calendar, Plus, Clock, Check, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface Agendamento {
  id: string;
  titulo: string;
  descricao: string | null;
  data_inicio: string;
  data_fim: string | null;
  concluido: boolean;
  contato_id: string | null;
  contatos: {
    nome: string;
  } | null;
}

export default function Agendamentos() {
  const { usuario } = useAuth();
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    titulo: '',
    descricao: '',
    data_inicio: '',
    hora_inicio: '',
  });

  useEffect(() => {
    if (usuario?.conta_id) {
      fetchAgendamentos();
    }
  }, [usuario, currentDate]);

  const fetchAgendamentos = async () => {
    try {
      const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
      const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);

      const { data, error } = await supabase
        .from('agendamentos')
        .select(`*, contatos(nome)`)
        .eq('conta_id', usuario!.conta_id)
        .gte('data_inicio', startOfMonth.toISOString())
        .lte('data_inicio', endOfMonth.toISOString())
        .order('data_inicio');

      if (error) throw error;
      setAgendamentos(data || []);
    } catch (error) {
      console.error('Erro ao buscar agendamentos:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddAgendamento = async () => {
    if (!formData.titulo || !formData.data_inicio || !formData.hora_inicio) {
      toast.error('Preencha título, data e hora');
      return;
    }

    try {
      const dataInicio = new Date(`${formData.data_inicio}T${formData.hora_inicio}`);

      const { error } = await supabase.from('agendamentos').insert({
        conta_id: usuario!.conta_id,
        usuario_id: usuario!.id,
        titulo: formData.titulo,
        descricao: formData.descricao || null,
        data_inicio: dataInicio.toISOString(),
      });

      if (error) throw error;

      toast.success('Agendamento criado!');
      setShowModal(false);
      setFormData({ titulo: '', descricao: '', data_inicio: '', hora_inicio: '' });
      fetchAgendamentos();
    } catch (error) {
      toast.error('Erro ao criar agendamento');
    }
  };

  const toggleConcluido = async (id: string, concluido: boolean) => {
    try {
      const { error } = await supabase
        .from('agendamentos')
        .update({ concluido: !concluido })
        .eq('id', id);

      if (error) throw error;
      fetchAgendamentos();
    } catch (error) {
      toast.error('Erro ao atualizar');
    }
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'short',
    });
  };

  const formatTime = (date: string) => {
    return new Date(date).toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentDate((prev) => {
      const newDate = new Date(prev);
      newDate.setMonth(prev.getMonth() + (direction === 'next' ? 1 : -1));
      return newDate;
    });
  };

  const getMonthName = () => {
    return currentDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  };

  const groupedAgendamentos = agendamentos.reduce((acc, agendamento) => {
    const date = new Date(agendamento.data_inicio).toDateString();
    if (!acc[date]) acc[date] = [];
    acc[date].push(agendamento);
    return acc;
  }, {} as Record<string, Agendamento[]>);

  return (
    <MainLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Agendamentos</h1>
            <p className="text-muted-foreground mt-1">
              Organize suas tarefas e compromissos.
            </p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="h-10 px-4 rounded-lg bg-primary text-primary-foreground font-medium flex items-center gap-2 hover:bg-primary/90 transition-colors"
          >
            <Plus className="h-5 w-5" />
            Novo Agendamento
          </button>
        </div>

        {/* Navegação do Mês */}
        <div className="flex items-center justify-between p-4 rounded-xl bg-card border border-border">
          <button
            onClick={() => navigateMonth('prev')}
            className="p-2 rounded-lg hover:bg-muted transition-colors"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <h2 className="text-lg font-semibold text-foreground capitalize">{getMonthName()}</h2>
          <button
            onClick={() => navigateMonth('next')}
            className="p-2 rounded-lg hover:bg-muted transition-colors"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>

        {/* Lista de Agendamentos */}
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : Object.keys(groupedAgendamentos).length === 0 ? (
          <div className="text-center py-12 bg-card rounded-xl border border-border">
            <Calendar className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
            <p className="text-lg text-muted-foreground">Nenhum agendamento neste mês</p>
            <button
              onClick={() => setShowModal(true)}
              className="mt-4 text-primary hover:underline"
            >
              Criar primeiro agendamento
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(groupedAgendamentos).map(([date, items]) => (
              <div key={date}>
                <h3 className="text-sm font-medium text-muted-foreground mb-3">
                  {formatDate(items[0].data_inicio)}
                </h3>
                <div className="space-y-3">
                  {items.map((agendamento) => (
                    <div
                      key={agendamento.id}
                      className={cn(
                        'p-4 rounded-xl bg-card border border-border flex items-start gap-4 transition-all',
                        agendamento.concluido && 'opacity-50'
                      )}
                    >
                      <button
                        onClick={() => toggleConcluido(agendamento.id, agendamento.concluido)}
                        className={cn(
                          'flex h-6 w-6 items-center justify-center rounded-full border-2 transition-colors flex-shrink-0',
                          agendamento.concluido
                            ? 'bg-primary border-primary'
                            : 'border-muted-foreground hover:border-primary'
                        )}
                      >
                        {agendamento.concluido && <Check className="h-4 w-4 text-primary-foreground" />}
                      </button>
                      <div className="flex-1 min-w-0">
                        <h4
                          className={cn(
                            'font-medium text-foreground',
                            agendamento.concluido && 'line-through'
                          )}
                        >
                          {agendamento.titulo}
                        </h4>
                        {agendamento.descricao && (
                          <p className="text-sm text-muted-foreground mt-1">
                            {agendamento.descricao}
                          </p>
                        )}
                        {agendamento.contatos && (
                          <p className="text-sm text-primary mt-1">{agendamento.contatos.nome}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Clock className="h-4 w-4" />
                        {formatTime(agendamento.data_inicio)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Modal */}
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="w-full max-w-md bg-card rounded-2xl border border-border p-6 animate-scale-in">
              <h2 className="text-xl font-semibold text-foreground mb-6">Novo Agendamento</h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">Título *</label>
                  <input
                    type="text"
                    value={formData.titulo}
                    onChange={(e) => setFormData({ ...formData, titulo: e.target.value })}
                    className="w-full h-11 px-4 rounded-lg bg-input border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="Ex: Reunião com cliente"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Descrição
                  </label>
                  <textarea
                    value={formData.descricao}
                    onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                    rows={3}
                    className="w-full px-4 py-3 rounded-lg bg-input border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                    placeholder="Detalhes do agendamento..."
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">Data *</label>
                    <input
                      type="date"
                      value={formData.data_inicio}
                      onChange={(e) => setFormData({ ...formData, data_inicio: e.target.value })}
                      className="w-full h-11 px-4 rounded-lg bg-input border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">Hora *</label>
                    <input
                      type="time"
                      value={formData.hora_inicio}
                      onChange={(e) => setFormData({ ...formData, hora_inicio: e.target.value })}
                      className="w-full h-11 px-4 rounded-lg bg-input border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowModal(false)}
                  className="flex-1 h-11 rounded-lg bg-muted text-foreground font-medium hover:bg-muted/80 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleAddAgendamento}
                  className="flex-1 h-11 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors"
                >
                  Criar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
