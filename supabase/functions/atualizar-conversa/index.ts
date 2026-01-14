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
    // Conectar ao banco EXTERNO para atualizar conversa
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
    console.log('📦 Conectado ao banco externo para atualizar conversa');

    const { conversa_id, updates } = await req.json();

    if (!conversa_id) {
      return new Response(
        JSON.stringify({ error: 'conversa_id é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!updates || Object.keys(updates).length === 0) {
      return new Response(
        JSON.stringify({ error: 'updates é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Atualizando conversa:', conversa_id, 'updates:', updates);

    // Campos permitidos para atualização
    const camposPermitidos = [
      'nao_lidas',
      'status',
      'agente_ia_ativo',
      'agente_ia_id',
      'atendente_id',
      'etapa_ia_atual',
      'arquivada',
      'ultima_mensagem',
      'ultima_mensagem_at'
    ];

    // Filtrar apenas campos permitidos
    const updatesFiltrados: Record<string, any> = {};
    for (const key of Object.keys(updates)) {
      if (camposPermitidos.includes(key)) {
        updatesFiltrados[key] = updates[key];
      }
    }

    if (Object.keys(updatesFiltrados).length === 0) {
      return new Response(
        JSON.stringify({ error: 'Nenhum campo válido para atualizar' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Atualizar conversa no banco externo
    const { data, error } = await supabaseExternal
      .from('conversas')
      .update(updatesFiltrados)
      .eq('id', conversa_id)
      .select()
      .single();

    if (error) {
      console.error('Erro ao atualizar conversa:', error);
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Conversa atualizada com sucesso');

    return new Response(
      JSON.stringify({ success: true, conversa: data }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Erro na função atualizar-conversa:', error);
    const message = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
