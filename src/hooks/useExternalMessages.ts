// Hook para buscar conversas e mensagens do banco externo via edge functions
import { useState, useCallback } from 'react';
import { supabaseFunctions } from '@/integrations/supabase/externalClient';

interface Contato {
  id: string;
  nome: string;
  telefone: string;
  avatar_url: string | null;
  is_grupo?: boolean | null;
  grupo_jid?: string | null;
  tags?: string[] | null;
  metadata?: unknown;
}

interface AgenteIA {
  id: string;
  nome: string | null;
  ativo: boolean | null;
  tipo: string | null;
}

interface EtapaIA {
  id: string;
  nome: string;
  numero: number;
}

interface Conversa {
  id: string;
  contato_id: string;
  conexao_id: string | null;
  agente_ia_ativo: boolean | null;
  agente_ia_id: string | null;
  atendente_id: string | null;
  ultima_mensagem: string | null;
  ultima_mensagem_at: string | null;
  nao_lidas: number | null;
  status?: string | null;
  etapa_ia_atual?: string | null;
  canal?: string | null;
  arquivada?: boolean | null;
  contatos: Contato;
  agent_ia?: AgenteIA | null;
  etapa_ia?: EtapaIA | null;
}

interface Mensagem {
  id: string;
  conversa_id: string;
  conteudo: string;
  direcao: 'entrada' | 'saida';
  created_at: string;
  enviada_por_ia: boolean;
  enviada_por_dispositivo: boolean | null;
  lida: boolean;
  tipo: 'texto' | 'imagem' | 'audio' | 'video' | 'documento' | 'sticker' | 'sistema' | null;
  media_url: string | null;
  metadata?: Record<string, unknown> | null;
  deletada?: boolean;
  deletada_por?: string;
  deletada_em?: string;
}

export function useExternalMessages() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Buscar conversas do banco externo
  const fetchConversasExterno = useCallback(async (
    contaId: string, 
    arquivadas = false
  ): Promise<Conversa[]> => {
    setLoading(true);
    setError(null);
    
    try {
      const { data, error: fnError } = await supabaseFunctions.functions.invoke('buscar-conversas', {
        body: { conta_id: contaId, arquivadas }
      });
      
      if (fnError) {
        console.error('Erro ao buscar conversas externas:', fnError);
        setError(fnError.message);
        return [];
      }
      
      return data?.conversas || [];
    } catch (err) {
      console.error('Erro ao buscar conversas externas:', err);
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  // Buscar mensagens de uma conversa do banco externo
  const fetchMensagensExterno = useCallback(async (
    conversaId: string,
    limit = 100,
    offset = 0
  ): Promise<Mensagem[]> => {
    setLoading(true);
    setError(null);
    
    try {
      const { data, error: fnError } = await supabaseFunctions.functions.invoke('buscar-mensagens', {
        body: { conversa_id: conversaId, limit, offset }
      });
      
      if (fnError) {
        console.error('Erro ao buscar mensagens externas:', fnError);
        setError(fnError.message);
        return [];
      }
      
      return data?.mensagens || [];
    } catch (err) {
      console.error('Erro ao buscar mensagens externas:', err);
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  // Atualizar conversa no banco externo
  const atualizarConversaExterno = useCallback(async (
    conversaId: string,
    updates: Record<string, unknown>
  ): Promise<boolean> => {
    try {
      const { data, error: fnError } = await supabaseFunctions.functions.invoke('atualizar-conversa', {
        body: { conversa_id: conversaId, updates }
      });
      
      if (fnError) {
        console.error('Erro ao atualizar conversa externa:', fnError);
        return false;
      }
      
      return data?.success || false;
    } catch (err) {
      console.error('Erro ao atualizar conversa externa:', err);
      return false;
    }
  }, []);

  return {
    loading,
    error,
    fetchConversasExterno,
    fetchMensagensExterno,
    atualizarConversaExterno,
  };
}
