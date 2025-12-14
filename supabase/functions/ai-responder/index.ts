import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Mapeamento de modelos OpenAI para Lovable AI
const modelMapping: Record<string, string> = {
  'gpt-4o-mini': 'google/gemini-2.5-flash',
  'gpt-4o': 'google/gemini-2.5-pro',
  'gpt-4.1-mini-2025-04-14': 'google/gemini-2.5-flash',
  'gpt-4.1-2025-04-14': 'google/gemini-2.5-pro',
  'gpt-5-2025-08-07': 'openai/gpt-5',
  'gpt-5-mini-2025-08-07': 'openai/gpt-5-mini',
  'gpt-5-nano-2025-08-07': 'openai/gpt-5-nano',
};

interface AIResponse {
  resposta: string;
  provider: 'openai' | 'lovable';
}

async function callOpenAI(
  apiKey: string,
  messages: { role: string; content: string }[],
  modelo: string,
  maxTokens: number,
  temperatura: number
): Promise<AIResponse> {
  const isModeloNovo = modelo.includes('gpt-5') || modelo.includes('gpt-4.1') || 
                       modelo.includes('o3') || modelo.includes('o4');
  
  const requestBody: any = {
    model: modelo,
    messages,
  };

  if (isModeloNovo) {
    requestBody.max_completion_tokens = maxTokens;
  } else {
    requestBody.max_tokens = maxTokens;
    requestBody.temperature = temperatura;
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI error ${response.status}: ${errorText}`);
  }

  const data = await response.json();
  const resposta = data.choices?.[0]?.message?.content;

  if (!resposta) {
    throw new Error('Resposta vazia da OpenAI');
  }

  return { resposta, provider: 'openai' };
}

async function callLovableAI(
  messages: { role: string; content: string }[],
  modelo: string
): Promise<AIResponse> {
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  
  if (!LOVABLE_API_KEY) {
    throw new Error('LOVABLE_API_KEY não configurada');
  }

  // Mapear modelo OpenAI para equivalente Lovable AI
  const lovableModel = modelMapping[modelo] || 'google/gemini-2.5-flash';

  console.log('Usando Lovable AI com modelo:', lovableModel);

  const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${LOVABLE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: lovableModel,
      messages,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Lovable AI error ${response.status}: ${errorText}`);
  }

  const data = await response.json();
  const resposta = data.choices?.[0]?.message?.content;

  if (!resposta) {
    throw new Error('Resposta vazia da Lovable AI');
  }

  return { resposta, provider: 'lovable' };
}

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

    // 1. Buscar API Key da OpenAI da conta (opcional agora)
    const { data: conta } = await supabase
      .from('contas')
      .select('openai_api_key')
      .eq('id', conta_id)
      .single();

    const hasOpenAIKey = !!conta?.openai_api_key;
    console.log('OpenAI API Key configurada:', hasOpenAIKey);

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

    // Verificar se o agente está configurado para atender 24h
    if (!agente.atender_24h) {
      const agora = new Date();
      const brasilOffset = -3 * 60;
      const localTime = new Date(agora.getTime() + (brasilOffset + agora.getTimezoneOffset()) * 60000);
      
      const diaSemana = localTime.getDay();
      const horaAtual = localTime.toTimeString().slice(0, 5);

      console.log('Verificando horário - Dia:', diaSemana, 'Hora (Brasil):', horaAtual);

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

    if (historico && historico.length > 0) {
      historico.forEach((msg: any) => {
        messages.push({
          role: msg.direcao === 'entrada' ? 'user' : 'assistant',
          content: msg.conteudo
        });
      });
    }

    const ultimaMensagem = historico?.[historico.length - 1];
    if (!ultimaMensagem || ultimaMensagem.conteudo !== mensagem) {
      messages.push({ role: 'user', content: mensagem });
    }

    console.log('Total de mensagens para API:', messages.length);

    // 8. Chamar API com fallback inteligente
    const modelo = agente.modelo || 'gpt-4o-mini';
    const maxTokens = agente.max_tokens || 1000;
    const temperatura = agente.temperatura || 0.7;

    let result: AIResponse;

    // Tentar OpenAI primeiro se tiver chave configurada
    if (hasOpenAIKey) {
      try {
        console.log('Tentando OpenAI com modelo:', modelo);
        result = await callOpenAI(conta.openai_api_key, messages, modelo, maxTokens, temperatura);
        console.log('✅ Resposta via OpenAI');
      } catch (openaiError: any) {
        const errorMsg = openaiError.message || '';
        console.error('❌ Erro OpenAI:', errorMsg);
        
        // Fallback para Lovable AI em caso de erro 429 (rate limit) ou 402 (quota) ou qualquer erro
        console.log('⚡ Fallback para Lovable AI...');
        try {
          result = await callLovableAI(messages, modelo);
          console.log('✅ Resposta via Lovable AI (fallback)');
        } catch (lovableError: any) {
          console.error('❌ Erro Lovable AI:', lovableError.message);
          return new Response(
            JSON.stringify({ error: `Erro em ambos provedores: OpenAI - ${errorMsg}, Lovable AI - ${lovableError.message}`, should_respond: false }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }
    } else {
      // Usar Lovable AI diretamente se não tiver chave OpenAI
      console.log('Usando Lovable AI diretamente (sem chave OpenAI configurada)');
      try {
        result = await callLovableAI(messages, modelo);
        console.log('✅ Resposta via Lovable AI');
      } catch (lovableError: any) {
        console.error('❌ Erro Lovable AI:', lovableError.message);
        return new Response(
          JSON.stringify({ error: lovableError.message, should_respond: false }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    console.log('Resposta gerada via', result.provider + ':', result.resposta.substring(0, 100) + '...');

    return new Response(
      JSON.stringify({ resposta: result.resposta, should_respond: true, provider: result.provider }),
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
