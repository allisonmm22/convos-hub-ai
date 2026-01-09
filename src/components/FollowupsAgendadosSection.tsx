import { useState, useEffect } from 'react';
import { Calendar, Clock, X, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
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

interface FollowupAgendado {
  id: string;
  data_agendada: string;
  motivo: string | null;
  status: string;
  criado_por: string | null;
  created_at: string;
}

interface FollowupsAgendadosSectionProps {
  contatoId: string;
}

export function FollowupsAgendadosSection({ contatoId }: FollowupsAgendadosSectionProps) {
  const [followups, setFollowups] = useState<FollowupAgendado[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancelarId, setCancelarId] = useState<string | null>(null);
  const [cancelando, setCancelando] = useState(false);

  const fetchFollowups = async () => {
    try {
      const { data, error } = await supabase
        .from('followups_agendados')
        .select('id, data_agendada, motivo, status, criado_por, created_at')
        .eq('contato_id', contatoId)
        .eq('status', 'pendente')
        .order('data_agendada', { ascending: true });

      if (error) throw error;
      setFollowups(data || []);
    } catch (error) {
      console.error('Erro ao buscar follow-ups:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFollowups();

    // Realtime subscription
    const channel = supabase
      .channel(`followups-${contatoId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'followups_agendados',
          filter: `contato_id=eq.${contatoId}`
        },
        () => {
          fetchFollowups();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [contatoId]);

  const handleCancelar = async () => {
    if (!cancelarId) return;
    
    setCancelando(true);
    try {
      const { error } = await supabase
        .from('followups_agendados')
        .update({ status: 'cancelado' })
        .eq('id', cancelarId);

      if (error) throw error;
      
      toast.success('Follow-up cancelado');
      fetchFollowups();
    } catch (error) {
      console.error('Erro ao cancelar follow-up:', error);
      toast.error('Erro ao cancelar follow-up');
    } finally {
      setCancelando(false);
      setCancelarId(null);
    }
  };

  if (loading) {
    return (
      <div className="mt-4 bg-card rounded-2xl border border-border shadow-lg p-4">
        <div className="flex items-center gap-2 mb-3">
          <Calendar className="h-4 w-4 text-amber-500" />
          <span className="text-sm font-semibold text-foreground">Follow-ups Agendados</span>
        </div>
        <div className="flex items-center justify-center py-4">
          <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (followups.length === 0) {
    return null;
  }

  return (
    <>
      <div className="mt-4 bg-card rounded-2xl border border-border shadow-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-amber-500" />
            <span className="text-sm font-semibold text-foreground">Follow-ups Agendados</span>
          </div>
          <span className="px-2 py-0.5 text-[10px] font-medium bg-amber-500/20 text-amber-600 dark:text-amber-400 rounded-full">
            {followups.length} pendente{followups.length > 1 ? 's' : ''}
          </span>
        </div>

        <div className="space-y-2">
          {followups.map((followup) => {
            const dataAgendada = new Date(followup.data_agendada);
            const agora = new Date();
            const isAtrasado = dataAgendada < agora;

            return (
              <div 
                key={followup.id} 
                className={`p-3 rounded-xl border transition-colors ${
                  isAtrasado 
                    ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800' 
                    : 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Clock className={`h-3.5 w-3.5 ${isAtrasado ? 'text-red-500' : 'text-amber-500'}`} />
                      <span className={`text-sm font-medium ${isAtrasado ? 'text-red-700 dark:text-red-300' : 'text-amber-700 dark:text-amber-300'}`}>
                        {format(dataAgendada, "dd/MM 'às' HH:mm", { locale: ptBR })}
                      </span>
                      {isAtrasado && (
                        <span className="px-1.5 py-0.5 text-[10px] font-medium bg-red-500/20 text-red-600 dark:text-red-400 rounded">
                          Atrasado
                        </span>
                      )}
                    </div>
                    {followup.motivo && (
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {followup.motivo}
                      </p>
                    )}
                    <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
                      {followup.criado_por === 'agente_ia' ? '🤖 Criado pelo agente' : '👤 Criado manualmente'}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 hover:bg-red-100 dark:hover:bg-red-900/30"
                    onClick={() => setCancelarId(followup.id)}
                  >
                    <X className="h-4 w-4 text-red-500" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <AlertDialog open={!!cancelarId} onOpenChange={(open) => !open && setCancelarId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar Follow-up?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O follow-up não será enviado automaticamente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleCancelar}
              disabled={cancelando}
              className="bg-red-500 hover:bg-red-600"
            >
              {cancelando ? 'Cancelando...' : 'Cancelar Follow-up'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
