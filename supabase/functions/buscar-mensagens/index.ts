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
    // Conectar ao banco EXTERNO para buscar mensagens
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
    console.log('📦 Conectado ao banco externo para buscar mensagens');

    const { conversa_id, limit = 100, offset = 0 } = await req.json();

    if (!conversa_id) {
      return new Response(
        JSON.stringify({ error: 'conversa_id é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Buscando mensagens da conversa:', conversa_id, 'limit:', limit, 'offset:', offset);

    // Buscar mensagens do banco externo
    const { data: mensagens, error } = await supabaseExternal
      .from('mensagens')
      .select(`
        id,
        conversa_id,
        contato_id,
        conteudo,
        direcao,
        created_at,
        enviada_por_ia,
        enviada_por_dispositivo,
        lida,
        tipo,
        media_url,
        metadata,
        deletada,
        deletada_por,
        deletada_em,
        usuario_id
      `)
      .eq('conversa_id', conversa_id)
      .order('created_at', { ascending: true })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('Erro ao buscar mensagens:', error);
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Encontradas ${mensagens?.length || 0} mensagens`);

    return new Response(
      JSON.stringify({ mensagens: mensagens || [] }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Erro na função buscar-mensagens:', error);
    const message = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
