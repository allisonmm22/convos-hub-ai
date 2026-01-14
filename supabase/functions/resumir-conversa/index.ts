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
    const { conversa_id, negociacao_id } = await req.json();

    if (!conversa_id) {
      return new Response(
        JSON.stringify({ error: 'conversa_id é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Usar banco de dados EXTERNO como principal
    const supabaseUrl = Deno.env.get('EXTERNAL_SUPABASE_URL') || Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('EXTERNAL_SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    console.log('📦 Usando banco:', supabaseUrl.substring(0, 30) + '...');

    // Fetch conversation with contact info
    const { data: conversa, error: conversaError } = await supabase
      .from('conversas')
      .select(`
        id,
        contato_id,
        contatos (nome, telefone)
      `)
      .eq('id', conversa_id)
      .single();

    if (conversaError || !conversa) {
      console.error('Erro ao buscar conversa:', conversaError);
      return new Response(
        JSON.stringify({ error: 'Conversa não encontrada' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch messages
    const { data: mensagens, error: mensagensError } = await supabase
      .from('mensagens')
      .select('conteudo, direcao, created_at, enviada_por_ia')
      .eq('conversa_id', conversa_id)
      .order('created_at', { ascending: true })
      .limit(100);

    if (mensagensError) {
      console.error('Erro ao buscar mensagens:', mensagensError);
      return new Response(
        JSON.stringify({ error: 'Erro ao buscar mensagens' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!mensagens || mensagens.length === 0) {
      return new Response(
        JSON.stringify({ resumo: 'Nenhuma mensagem encontrada para resumir.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build conversation text
    const conversaTexto = mensagens.map(m => {
      const remetente = m.direcao === 'entrada' ? 'Lead' : (m.enviada_por_ia ? 'Agente IA' : 'Atendente');
      return `${remetente}: ${m.conteudo}`;
    }).join('\n');

    const contatoNome = (conversa.contatos as any)?.nome || 'Lead';

    // Prompt mais conciso para resumos menores
    const prompt = `Resuma esta conversa de vendas com o lead "${contatoNome}" em no máximo 100 palavras.

Inclua apenas:
• O que o lead busca
• Objeções ou dúvidas principais
• Status atual da negociação
• Próximo passo sugerido

Seja direto e objetivo. Máximo 100 palavras.

Conversa:
${conversaTexto}`;

    // Call Lovable AI
    if (!lovableApiKey) {
      console.error('LOVABLE_API_KEY não configurada');
      return new Response(
        JSON.stringify({ error: 'Configuração de IA não encontrada' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Chamando Lovable AI para gerar resumo conciso...');

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: 'Você é um especialista em análise de conversas de vendas. Seja extremamente conciso e direto. Máximo 100 palavras.' },
          { role: 'user', content: prompt }
        ],
        max_tokens: 300,
        temperature: 0.7,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('Erro da IA:', aiResponse.status, errorText);
      
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Limite de requisições excedido. Tente novamente em alguns minutos.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: 'Créditos insuficientes para IA.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ error: 'Erro ao gerar resumo com IA' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const aiData = await aiResponse.json();
    let resumo = aiData.choices?.[0]?.message?.content || 'Não foi possível gerar o resumo.';

    // Truncar se ultrapassar 600 caracteres
    if (resumo.length > 600) {
      resumo = resumo.substring(0, 597) + '...';
    }

    console.log('Resumo gerado com sucesso, tamanho:', resumo.length, 'caracteres');

    // Salvar resumo na negociação se negociacao_id foi fornecido
    if (negociacao_id) {
      const { error: updateError } = await supabase
        .from('negociacoes')
        .update({
          resumo_ia: resumo,
          resumo_gerado_em: new Date().toISOString()
        })
        .eq('id', negociacao_id);

      if (updateError) {
        console.error('Erro ao salvar resumo na negociação:', updateError);
        // Não retorna erro, pois o resumo foi gerado com sucesso
      } else {
        console.log('Resumo salvo na negociação:', negociacao_id);
      }
    }

    return new Response(
      JSON.stringify({ resumo }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Erro na função resumir-conversa:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Erro desconhecido' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
