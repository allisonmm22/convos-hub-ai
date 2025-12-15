import { supabase } from '@/integrations/supabase/client';

export type TipoLog = 
  | 'login'
  | 'logout'
  | 'mensagem_enviada'
  | 'ia_resposta'
  | 'negociacao_criada'
  | 'negociacao_movida'
  | 'conversa_encerrada'
  | 'conversa_transferida'
  | 'agente_ia_toggle'
  | 'usuario_criado'
  | 'contato_criado';

interface LogOptions {
  contaId: string;
  usuarioId?: string;
  tipo: TipoLog;
  descricao: string;
  metadata?: Record<string, unknown>;
}

export async function registrarLog(options: LogOptions): Promise<void> {
  const { contaId, usuarioId, tipo, descricao, metadata } = options;
  
  try {
    await supabase.functions.invoke('registrar-log', {
      body: {
        conta_id: contaId,
        usuario_id: usuarioId,
        tipo,
        descricao,
        metadata,
      },
    });
  } catch (error) {
    // Log silenciosamente para não interferir no fluxo principal
    console.error('Erro ao registrar log de atividade:', error);
  }
}
