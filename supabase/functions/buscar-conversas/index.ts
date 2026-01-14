import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Conectar ao banco EXTERNO para buscar conversas/mensagens
    const externalUrl = Deno.env.get('EXTERNAL_SUPABASE_URL');
    const externalKey = Deno.env.get('EXTERNAL_SUPABASE_SERVICE_ROLE_KEY');
    
    if (!externalUrl || !externalKey) {
      console.error('Configuração do banco externo não encontrada');
      return new Response(
        JSON.stringify({ error: 'Banco externo não configurado' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseExternal = createClient(externalUrl, externalKey);
    console.log('📦 Conectado ao banco externo para buscar conversas');

    const { conta_id, arquivadas, limit = 100 } = await req.json();

    if (!conta_id) {
      return new Response(
        JSON.stringify({ error: 'conta_id é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Buscando conversas para conta:', conta_id, 'arquivadas:', arquivadas);

    // Buscar conversas do banco externo
    let query = supabaseExternal
      .from('conversas')
      .select(`
        id,
        contato_id,
        conexao_id,
        agente_ia_ativo,
        agente_ia_id,
        atendente_id,
        ultima_mensagem,
        ultima_mensagem_at,
        nao_lidas,
        status,
        etapa_ia_atual,
        canal,
        arquivada,
        contatos (
          id,
          nome,
          telefone,
          avatar_url,
          is_grupo,
          grupo_jid,
          tags,
          metadata
        ),
        agent_ia (
          id,
          nome,
          ativo,
          tipo
        )
      `)
      .eq('conta_id', conta_id)
      .order('ultima_mensagem_at', { ascending: false })
      .limit(limit);

    // Filtrar por arquivadas
    if (arquivadas === true) {
      query = query.eq('arquivada', true);
    } else {
      query = query.or('arquivada.is.null,arquivada.eq.false');
    }

    const { data: conversas, error } = await query;

    if (error) {
      console.error('Erro ao buscar conversas:', error);
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Encontradas ${conversas?.length || 0} conversas`);

    return new Response(
      JSON.stringify({ conversas: conversas || [] }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Erro na função buscar-conversas:', error);
    const message = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
