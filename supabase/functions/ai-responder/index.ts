import "https://deno.land/x/xhr@0.1.0/mod.ts";
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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { conversa_id, mensagem, conta_id } = await req.json();

    console.log('=== AI RESPONDER ===');
    console.log('Conversa ID:', conversa_id);
    console.log('Conta ID:', conta_id);
    console.log('Mensagem recebida:', mensagem);

    // 1. Buscar API Key da OpenAI da conta
    const { data: conta, error: contaError } = await supabase
      .from('contas')
      .select('openai_api_key')
      .eq('id', conta_id)
      .single();

    if (contaError || !conta?.openai_api_key) {
      console.log('API Key não configurada para esta conta');
      return new Response(
        JSON.stringify({ error: 'API Key da OpenAI não configurada', should_respond: false }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Buscar configuração do agente IA ativo
    const { data: agente, error: agenteError } = await supabase
      .from('agent_ia')
      .select('*')
      .eq('conta_id', conta_id)
      .eq('ativo', true)
      .single();

    if (agenteError || !agente) {
      console.log('Nenhum agente IA ativo para esta conta');
      return new Response(
        JSON.stringify({ error: 'Nenhum agente IA ativo', should_respond: false }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Agente encontrado:', agente.nome);

    // Verificar horário de funcionamento
    const agora = new Date();
    const diaSemana = agora.getDay(); // 0 = domingo
    const horaAtual = agora.toTimeString().slice(0, 5); // HH:MM

    const dentroDoHorario = agente.dias_ativos?.includes(diaSemana) &&
      horaAtual >= agente.horario_inicio &&
      horaAtual <= agente.horario_fim;

    if (!dentroDoHorario && agente.mensagem_fora_horario) {
      console.log('Fora do horário de atendimento');
      return new Response(
        JSON.stringify({ 
          resposta: agente.mensagem_fora_horario, 
          should_respond: true,
          fora_horario: true 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 3. Buscar etapas de atendimento
    const { data: etapas } = await supabase
      .from('agent_ia_etapas')
      .select('*')
      .eq('agent_ia_id', agente.id)
      .order('numero', { ascending: true });

    // 4. Buscar perguntas frequentes
    const { data: perguntas } = await supabase
      .from('agent_ia_perguntas')
      .select('*')
      .eq('agent_ia_id', agente.id)
      .order('ordem', { ascending: true });

    // 5. Buscar histórico de mensagens da conversa (últimas 20)
    const { data: historico } = await supabase
      .from('mensagens')
      .select('conteudo, direcao, created_at')
      .eq('conversa_id', conversa_id)
      .order('created_at', { ascending: true })
      .limit(20);

    // 6. Montar o prompt completo
    let promptCompleto = agente.prompt_sistema || '';

    // Adicionar etapas de atendimento
    if (etapas && etapas.length > 0) {
      promptCompleto += '\n\n## ETAPAS DE ATENDIMENTO\n';
      promptCompleto += 'Siga estas etapas no fluxo de atendimento:\n\n';
      etapas.forEach((etapa: any) => {
        promptCompleto += `### Etapa ${etapa.numero}${etapa.tipo ? ` (${etapa.tipo})` : ''}: ${etapa.nome}\n`;
        if (etapa.descricao) {
          promptCompleto += `${etapa.descricao}\n\n`;
        }
      });
    }

    // Adicionar perguntas frequentes
    if (perguntas && perguntas.length > 0) {
      promptCompleto += '\n\n## PERGUNTAS FREQUENTES\n';
      promptCompleto += 'Use estas respostas quando apropriado:\n\n';
      perguntas.forEach((faq: any) => {
        promptCompleto += `**P: ${faq.pergunta}**\nR: ${faq.resposta}\n\n`;
      });
    }

    console.log('Prompt montado com', promptCompleto.length, 'caracteres');

    // 7. Montar mensagens para a API
    const messages: { role: string; content: string }[] = [
      { role: 'system', content: promptCompleto }
    ];

    // Adicionar histórico da conversa
    if (historico && historico.length > 0) {
      historico.forEach((msg: any) => {
        messages.push({
          role: msg.direcao === 'entrada' ? 'user' : 'assistant',
          content: msg.conteudo
        });
      });
    }

    // Adicionar mensagem atual (se não estiver no histórico)
    const ultimaMensagem = historico?.[historico.length - 1];
    if (!ultimaMensagem || ultimaMensagem.conteudo !== mensagem) {
      messages.push({ role: 'user', content: mensagem });
    }

    console.log('Total de mensagens para API:', messages.length);

    // 8. Chamar API da OpenAI
    const modelo = agente.modelo || 'gpt-4o-mini';
    
    // Determinar se é modelo novo (GPT-5, O3, O4) ou legado
    const isModeloNovo = modelo.includes('gpt-5') || modelo.includes('gpt-4.1') || 
                         modelo.includes('o3') || modelo.includes('o4');
    
    const requestBody: any = {
      model: modelo,
      messages,
    };

    // Configurar parâmetros baseado no modelo
    if (isModeloNovo) {
      requestBody.max_completion_tokens = agente.max_tokens || 1000;
      // Modelos novos não suportam temperature
    } else {
      requestBody.max_tokens = agente.max_tokens || 1000;
      requestBody.temperature = agente.temperatura || 0.7;
    }

    console.log('Chamando OpenAI com modelo:', modelo);

    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${conta.openai_api_key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!openaiResponse.ok) {
      const errorText = await openaiResponse.text();
      console.error('Erro da OpenAI:', openaiResponse.status, errorText);
      return new Response(
        JSON.stringify({ error: `Erro da OpenAI: ${errorText}`, should_respond: false }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const openaiData = await openaiResponse.json();
    const resposta = openaiData.choices?.[0]?.message?.content;

    if (!resposta) {
      console.error('Resposta vazia da OpenAI');
      return new Response(
        JSON.stringify({ error: 'Resposta vazia da OpenAI', should_respond: false }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Resposta gerada:', resposta.substring(0, 100) + '...');

    return new Response(
      JSON.stringify({ resposta, should_respond: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    console.error('Erro no ai-responder:', errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage, should_respond: false }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
