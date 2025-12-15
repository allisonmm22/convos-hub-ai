import { useState, useEffect } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Calendar, Plus, Clock, Check, Loader2, ChevronLeft, ChevronRight, X, Pencil, Trash2, Video } from 'lucide-react';
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
  google_event_id: string | null;
  google_meet_link: string | null;
  contatos: {
    nome: string;
  } | null;
}

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export default function Agendamentos() {
  const { usuario } = useAuth();
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    titulo: '',
    descricao: '',
    data_inicio: '',
    hora_inicio: '',
  });

  // Estados para edição
  const [editingAgendamento, setEditingAgendamento] = useState<Agendamento | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editFormData, setEditFormData] = useState({
    titulo: '',
    descricao: '',
    data_inicio: '',
    hora_inicio: '',
  });

  // Estados para exclusão
  const [deletingAgendamento, setDeletingAgendamento] = useState<Agendamento | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

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

  const openEditModal = (agendamento: Agendamento) => {
    const dataInicio = new Date(agendamento.data_inicio);
    setEditingAgendamento(agendamento);
    setEditFormData({
      titulo: agendamento.titulo,
      descricao: agendamento.descricao || '',
      data_inicio: dataInicio.toISOString().split('T')[0],
      hora_inicio: dataInicio.toTimeString().slice(0, 5),
    });
    setShowEditModal(true);
  };

  const handleUpdateAgendamento = async () => {
    if (!editingAgendamento || !editFormData.titulo || !editFormData.data_inicio || !editFormData.hora_inicio) {
      toast.error('Preencha título, data e hora');
      return;
    }

    setActionLoading(true);
    try {
      const novaDataInicio = new Date(`${editFormData.data_inicio}T${editFormData.hora_inicio}`);
      const novaDataFim = new Date(novaDataInicio.getTime() + 60 * 60 * 1000); // +1 hora

      // Atualizar no banco local
      const { error } = await supabase
        .from('agendamentos')
        .update({
          titulo: editFormData.titulo,
          descricao: editFormData.descricao || null,
          data_inicio: novaDataInicio.toISOString(),
          data_fim: novaDataFim.toISOString(),
        })
        .eq('id', editingAgendamento.id);

      if (error) throw error;

      // Se tem google_event_id, sincronizar com Google Calendar
      if (editingAgendamento.google_event_id) {
        try {
          // Buscar calendário associado
          const { data: calendarios } = await supabase
            .from('calendarios_google')
            .select('id')
            .eq('conta_id', usuario!.conta_id)
            .eq('ativo', true)
            .limit(1);

          if (calendarios && calendarios.length > 0) {
            await supabase.functions.invoke('google-calendar-actions', {
              body: {
                operacao: 'reagendar',
                calendario_id: calendarios[0].id,
                dados: {
                  evento_id: editingAgendamento.google_event_id,
                  nova_data_inicio: novaDataInicio.toISOString(),
                  nova_data_fim: novaDataFim.toISOString(),
                }
              }
            });
          }
        } catch (calendarError) {
          console.error('Erro ao sincronizar com Google Calendar:', calendarError);
          // Não falhar a operação por causa do Google Calendar
        }
      }

      toast.success('Agendamento atualizado!');
      setShowEditModal(false);
      setEditingAgendamento(null);
      fetchAgendamentos();
    } catch (error) {
      console.error('Erro ao atualizar:', error);
      toast.error('Erro ao atualizar agendamento');
    } finally {
      setActionLoading(false);
    }
  };

  const confirmDelete = (agendamento: Agendamento) => {
    setDeletingAgendamento(agendamento);
    setShowDeleteConfirm(true);
  };

  const handleDeleteAgendamento = async () => {
    if (!deletingAgendamento) return;

    setActionLoading(true);
    try {
      // Se tem google_event_id, deletar do Google Calendar primeiro
      if (deletingAgendamento.google_event_id) {
        try {
          // Buscar calendário associado
          const { data: calendarios } = await supabase
            .from('calendarios_google')
            .select('id')
            .eq('conta_id', usuario!.conta_id)
            .eq('ativo', true)
            .limit(1);

          if (calendarios && calendarios.length > 0) {
            await supabase.functions.invoke('google-calendar-actions', {
              body: {
                operacao: 'deletar',
                calendario_id: calendarios[0].id,
                dados: {
                  evento_id: deletingAgendamento.google_event_id
                }
              }
            });
          }
        } catch (calendarError) {
          console.error('Erro ao deletar do Google Calendar:', calendarError);
          // Não falhar a operação por causa do Google Calendar
        }
      }

      // Deletar do banco local
      const { error } = await supabase
        .from('agendamentos')
        .delete()
        .eq('id', deletingAgendamento.id);

      if (error) throw error;

      toast.success('Agendamento excluído!');
      setShowDeleteConfirm(false);
      setDeletingAgendamento(null);
      fetchAgendamentos();
    } catch (error) {
      console.error('Erro ao deletar:', error);
      toast.error('Erro ao excluir agendamento');
    } finally {
      setActionLoading(false);
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
    setSelectedDate(null);
  };

  const getMonthName = () => {
    return currentDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  };

  // Gerar grid do calendário
  const generateCalendarGrid = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    
    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);
    
    const startDay = firstDayOfMonth.getDay();
    const daysInMonth = lastDayOfMonth.getDate();
    
    const grid: (Date | null)[] = [];
    
    // Dias do mês anterior
    const prevMonth = new Date(year, month, 0);
    for (let i = startDay - 1; i >= 0; i--) {
      grid.push(new Date(year, month - 1, prevMonth.getDate() - i));
    }
    
    // Dias do mês atual
    for (let day = 1; day <= daysInMonth; day++) {
      grid.push(new Date(year, month, day));
    }
    
    // Dias do próximo mês para completar a grade
    const remainingDays = 42 - grid.length;
    for (let day = 1; day <= remainingDays; day++) {
      grid.push(new Date(year, month + 1, day));
    }
    
    return grid;
  };

  const getAgendamentosForDate = (date: Date) => {
    return agendamentos.filter((a) => {
      const aDate = new Date(a.data_inicio);
      return (
        aDate.getDate() === date.getDate() &&
        aDate.getMonth() === date.getMonth() &&
        aDate.getFullYear() === date.getFullYear()
      );
    });
  };

  const isToday = (date: Date) => {
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  };

  const isCurrentMonth = (date: Date) => {
    return date.getMonth() === currentDate.getMonth();
  };

  const isSelected = (date: Date) => {
    if (!selectedDate) return false;
    return (
      date.getDate() === selectedDate.getDate() &&
      date.getMonth() === selectedDate.getMonth() &&
      date.getFullYear() === selectedDate.getFullYear()
    );
  };

  const handleDayClick = (date: Date) => {
    setSelectedDate(date);
  };

  const openNewAgendamentoModal = (prefilledDate?: Date) => {
    if (prefilledDate) {
      const dateStr = prefilledDate.toISOString().split('T')[0];
      setFormData({ ...formData, data_inicio: dateStr });
    }
    setShowModal(true);
  };

  const calendarGrid = generateCalendarGrid();
  const selectedDateAgendamentos = selectedDate ? getAgendamentosForDate(selectedDate) : [];

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
            onClick={() => openNewAgendamentoModal()}
            className="h-10 px-4 rounded-lg bg-primary text-primary-foreground font-medium flex items-center gap-2 hover:bg-primary/90 transition-colors"
          >
            <Plus className="h-5 w-5" />
            Novo Agendamento
          </button>
        </div>

        <div className="flex gap-6">
          {/* Calendário */}
          <div className="flex-1">
            {/* Navegação do Mês */}
            <div className="flex items-center justify-between p-4 rounded-t-xl bg-card border border-border border-b-0">
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

            {/* Grid do Calendário */}
            <div className="bg-card border border-border rounded-b-xl overflow-hidden">
              {/* Cabeçalho dos dias da semana */}
              <div className="grid grid-cols-7 border-b border-border">
                {WEEKDAYS.map((day) => (
                  <div
                    key={day}
                    className="py-3 text-center text-sm font-medium text-muted-foreground"
                  >
                    {day}
                  </div>
                ))}
              </div>

              {/* Dias do mês */}
              {loading ? (
                <div className="flex items-center justify-center h-96">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : (
                <div className="grid grid-cols-7">
                  {calendarGrid.map((date, index) => {
                    if (!date) return <div key={index} />;
                    
                    const dayAgendamentos = getAgendamentosForDate(date);
                    const isTodayDate = isToday(date);
                    const isCurrentMonthDate = isCurrentMonth(date);
                    const isSelectedDate = isSelected(date);

                    return (
                      <div
                        key={index}
                        onClick={() => handleDayClick(date)}
                        className={cn(
                          'min-h-[100px] p-2 border-b border-r border-border cursor-pointer transition-colors hover:bg-muted/50',
                          !isCurrentMonthDate && 'bg-muted/30',
                          isSelectedDate && 'bg-primary/10 ring-2 ring-primary ring-inset',
                          isTodayDate && !isSelectedDate && 'bg-primary/5'
                        )}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span
                            className={cn(
                              'text-sm font-medium w-7 h-7 flex items-center justify-center rounded-full',
                              !isCurrentMonthDate && 'text-muted-foreground/50',
                              isTodayDate && 'bg-primary text-primary-foreground',
                              isCurrentMonthDate && !isTodayDate && 'text-foreground'
                            )}
                          >
                            {date.getDate()}
                          </span>
                          {dayAgendamentos.length > 0 && (
                            <span className="text-xs text-muted-foreground">
                              {dayAgendamentos.length}
                            </span>
                          )}
                        </div>

                        {/* Mini cards dos agendamentos */}
                        <div className="space-y-1">
                          {dayAgendamentos.slice(0, 2).map((a) => (
                            <div
                              key={a.id}
                              className={cn(
                                'text-xs px-1.5 py-0.5 rounded truncate',
                                a.concluido
                                  ? 'bg-muted text-muted-foreground line-through'
                                  : 'bg-primary/10 text-primary'
                              )}
                            >
                              {a.titulo}
                            </div>
                          ))}
                          {dayAgendamentos.length > 2 && (
                            <span className="text-xs text-muted-foreground pl-1">
                              +{dayAgendamentos.length - 2} mais
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Sidebar de Detalhes do Dia */}
          <div className="w-80 flex-shrink-0">
            <div className="bg-card border border-border rounded-xl p-4 sticky top-4">
              {selectedDate ? (
                <>
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="font-semibold text-foreground">
                        {selectedDate.toLocaleDateString('pt-BR', {
                          weekday: 'long',
                          day: 'numeric',
                        })}
                      </h3>
                      <p className="text-sm text-muted-foreground capitalize">
                        {selectedDate.toLocaleDateString('pt-BR', {
                          month: 'long',
                          year: 'numeric',
                        })}
                      </p>
                    </div>
                    <button
                      onClick={() => setSelectedDate(null)}
                      className="p-1 rounded hover:bg-muted transition-colors"
                    >
                      <X className="h-4 w-4 text-muted-foreground" />
                    </button>
                  </div>

                  {selectedDateAgendamentos.length === 0 ? (
                    <div className="text-center py-8">
                      <Calendar className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
                      <p className="text-sm text-muted-foreground mb-4">
                        Nenhum agendamento neste dia
                      </p>
                      <button
                        onClick={() => openNewAgendamentoModal(selectedDate)}
                        className="text-sm text-primary hover:underline"
                      >
                        + Criar agendamento
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {selectedDateAgendamentos.map((agendamento) => (
                        <div
                          key={agendamento.id}
                          className={cn(
                            'p-3 rounded-lg bg-muted/50 border border-border transition-all',
                            agendamento.concluido && 'opacity-50'
                          )}
                        >
                          <div className="flex items-start gap-3">
                            <button
                              onClick={() => toggleConcluido(agendamento.id, agendamento.concluido)}
                              className={cn(
                                'flex h-5 w-5 items-center justify-center rounded-full border-2 transition-colors flex-shrink-0 mt-0.5',
                                agendamento.concluido
                                  ? 'bg-primary border-primary'
                                  : 'border-muted-foreground hover:border-primary'
                              )}
                            >
                              {agendamento.concluido && (
                                <Check className="h-3 w-3 text-primary-foreground" />
                              )}
                            </button>
                            <div className="flex-1 min-w-0">
                              <h4
                                className={cn(
                                  'font-medium text-sm text-foreground',
                                  agendamento.concluido && 'line-through'
                                )}
                              >
                                {agendamento.titulo}
                              </h4>
                              {agendamento.descricao && (
                                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                                  {agendamento.descricao}
                                </p>
                              )}
                              <div className="flex items-center gap-2 mt-1">
                                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                  <Clock className="h-3 w-3" />
                                  {formatTime(agendamento.data_inicio)}
                                </div>
                                {agendamento.contatos && (
                                  <span className="text-xs text-primary">
                                    {agendamento.contatos.nome}
                                  </span>
                                )}
                              </div>
                              {agendamento.google_meet_link && (
                                <a
                                  href={agendamento.google_meet_link}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-1 text-xs text-blue-500 hover:underline mt-1"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <Video className="h-3 w-3" />
                                  Google Meet
                                </a>
                              )}
                            </div>
                            <div className="flex items-center gap-1">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openEditModal(agendamento);
                                }}
                                className="p-1.5 rounded hover:bg-muted transition-colors"
                                title="Editar"
                              >
                                <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  confirmDelete(agendamento);
                                }}
                                className="p-1.5 rounded hover:bg-destructive/10 transition-colors"
                                title="Excluir"
                              >
                                <Trash2 className="h-3.5 w-3.5 text-destructive" />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}

                      <button
                        onClick={() => openNewAgendamentoModal(selectedDate)}
                        className="w-full py-2 text-sm text-primary hover:underline"
                      >
                        + Novo agendamento
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-12">
                  <Calendar className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
                  <p className="text-sm text-muted-foreground">
                    Selecione um dia no calendário para ver os agendamentos
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Modal de Criar */}
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
                  onClick={() => {
                    setShowModal(false);
                    setFormData({ titulo: '', descricao: '', data_inicio: '', hora_inicio: '' });
                  }}
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

        {/* Modal de Editar */}
        {showEditModal && editingAgendamento && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="w-full max-w-md bg-card rounded-2xl border border-border p-6 animate-scale-in">
              <h2 className="text-xl font-semibold text-foreground mb-6">Editar Agendamento</h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">Título *</label>
                  <input
                    type="text"
                    value={editFormData.titulo}
                    onChange={(e) => setEditFormData({ ...editFormData, titulo: e.target.value })}
                    className="w-full h-11 px-4 rounded-lg bg-input border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="Ex: Reunião com cliente"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Descrição
                  </label>
                  <textarea
                    value={editFormData.descricao}
                    onChange={(e) => setEditFormData({ ...editFormData, descricao: e.target.value })}
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
                      value={editFormData.data_inicio}
                      onChange={(e) => setEditFormData({ ...editFormData, data_inicio: e.target.value })}
                      className="w-full h-11 px-4 rounded-lg bg-input border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">Hora *</label>
                    <input
                      type="time"
                      value={editFormData.hora_inicio}
                      onChange={(e) => setEditFormData({ ...editFormData, hora_inicio: e.target.value })}
                      className="w-full h-11 px-4 rounded-lg bg-input border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                </div>

                {editingAgendamento.google_meet_link && (
                  <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                    <div className="flex items-center gap-2 text-sm text-blue-500">
                      <Video className="h-4 w-4" />
                      <span className="font-medium">Google Meet</span>
                    </div>
                    <a
                      href={editingAgendamento.google_meet_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-400 hover:underline mt-1 block truncate"
                    >
                      {editingAgendamento.google_meet_link}
                    </a>
                  </div>
                )}

                {editingAgendamento.google_event_id && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    Sincronizado com Google Calendar
                  </p>
                )}
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => {
                    setShowEditModal(false);
                    setEditingAgendamento(null);
                  }}
                  disabled={actionLoading}
                  className="flex-1 h-11 rounded-lg bg-muted text-foreground font-medium hover:bg-muted/80 transition-colors disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleUpdateAgendamento}
                  disabled={actionLoading}
                  className="flex-1 h-11 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {actionLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                  Salvar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal de Confirmação de Exclusão */}
        {showDeleteConfirm && deletingAgendamento && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="w-full max-w-sm bg-card rounded-2xl border border-border p-6 animate-scale-in">
              <h2 className="text-lg font-semibold text-foreground mb-2">Excluir agendamento?</h2>
              <p className="text-sm text-muted-foreground mb-4">
                "{deletingAgendamento.titulo}" será removido permanentemente.
                {deletingAgendamento.google_event_id && (
                  <span className="block mt-1 text-orange-500">
                    Este evento também será removido do Google Calendar.
                  </span>
                )}
              </p>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowDeleteConfirm(false);
                    setDeletingAgendamento(null);
                  }}
                  disabled={actionLoading}
                  className="flex-1 h-10 rounded-lg bg-muted text-foreground font-medium hover:bg-muted/80 transition-colors disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleDeleteAgendamento}
                  disabled={actionLoading}
                  className="flex-1 h-10 rounded-lg bg-destructive text-destructive-foreground font-medium hover:bg-destructive/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {actionLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                  Excluir
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
