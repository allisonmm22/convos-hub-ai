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
  acoes?: Acao[];
}

interface Acao {
  tipo: 'etapa' | 'tag' | 'transferir' | 'notificar' | 'finalizar';
  valor?: string;
}

// Parser de ações do prompt
function parseAcoesDoPrompt(texto: string): { acoes: string[], acoesParseadas: Acao[] } {
  const acoesRegex = /@(etapa|tag|transferir|notificar|finalizar)(?::([^\s@]+))?/gi;
  const matches = [...texto.matchAll(acoesRegex)];
  
  const acoes: string[] = [];
  const acoesParseadas: Acao[] = [];
  
  for (const match of matches) {
    acoes.push(match[0]);
    // Remover pontuação final do valor (. , ; ! ?)
    const valorLimpo = match[2]?.replace(/[.,;!?]+$/, '') || undefined;
    acoesParseadas.push({
      tipo: match[1].toLowerCase() as Acao['tipo'],
      valor: valorLimpo,
    });
  }
  
  return { acoes, acoesParseadas };
}

// Mapear nome de etapa para ID
async function mapearEtapaNome(supabase: any, contaId: string, nomeEtapa: string): Promise<string | null> {
  // Normalizar nome (remover hífens, pontuação final, lowercase)
  const nomeNormalizado = nomeEtapa.toLowerCase()
    .replace(/-/g, ' ')
    .replace(/[.,;!?]+$/, ''); // Remover pontuação final
  
  console.log('Mapeando etapa:', nomeEtapa, '-> normalizado:', nomeNormalizado);
  
  // Buscar estágios da conta
  const { data: funis } = await supabase
    .from('funis')
    .select('id')
    .eq('conta_id', contaId);
    
  if (!funis || funis.length === 0) {
    console.log('Nenhum funil encontrado para conta:', contaId);
    return null;
  }
  
  const { data: estagios } = await supabase
    .from('estagios')
    .select('id, nome')
    .in('funil_id', funis.map((f: any) => f.id));
    
  if (!estagios) {
    console.log('Nenhum estágio encontrado');
    return null;
  }
  
  console.log('Estágios disponíveis:', estagios.map((e: any) => e.nome));
  
  // Encontrar estágio por nome (case insensitive, com/sem hífen)
  const estagio = estagios.find((e: any) => 
    e.nome.toLowerCase() === nomeNormalizado ||
    e.nome.toLowerCase().replace(/\s+/g, '-') === nomeNormalizado
  );
  
  console.log('Estágio encontrado:', estagio?.id || 'nenhum');
  
  return estagio?.id || null;
}

async function callOpenAI(
  apiKey: string,
  messages: { role: string; content: string }[],
  modelo: string,
  maxTokens: number,
  temperatura: number,
  tools?: any[]
): Promise<AIResponse> {
  const isModeloNovo = modelo.includes('gpt-5') || modelo.includes('gpt-4.1') || 
                       modelo.includes('o3') || modelo.includes('o4');
  
  const requestBody: any = {
    model: modelo,
    messages,
  };

  if (tools && tools.length > 0) {
    requestBody.tools = tools;
    requestBody.tool_choice = 'auto';
  }

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
  
  // Verificar se há tool calls
  const message = data.choices?.[0]?.message;
  const toolCalls = message?.tool_calls;
  
  let resposta = message?.content || '';
  let acoes: Acao[] = [];
  
  if (toolCalls && toolCalls.length > 0) {
    for (const toolCall of toolCalls) {
      if (toolCall.function?.name === 'executar_acao') {
        try {
          const args = JSON.parse(toolCall.function.arguments);
          acoes.push(args);
        } catch (e) {
          console.error('Erro ao parsear argumentos da ação:', e);
        }
      }
    }
    
    // Se há ações mas sem resposta textual, fazer segunda chamada para obter resposta
    if (!resposta && acoes.length > 0) {
      console.log('Tool call sem resposta textual, fazendo segunda chamada...');
      
      // Montar mensagens com o resultado do tool call
      const toolResultMessages: any[] = [
        ...messages,
        message, // Mensagem original com tool_calls
      ];
      
      // Adicionar resultado de cada tool call
      for (const toolCall of toolCalls) {
        toolResultMessages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: JSON.stringify({ sucesso: true, mensagem: 'Ação será executada automaticamente' }),
        });
      }
      
      // Segunda chamada sem tools para obter resposta textual
      const continuationBody: any = {
        model: modelo,
        messages: toolResultMessages,
      };
      
      if (isModeloNovo) {
        continuationBody.max_completion_tokens = maxTokens;
      } else {
        continuationBody.max_tokens = maxTokens;
        continuationBody.temperature = temperatura;
      }
      
      try {
        const continuationResponse = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(continuationBody),
        });
        
        if (continuationResponse.ok) {
          const continuationData = await continuationResponse.json();
          resposta = continuationData.choices?.[0]?.message?.content || '';
          console.log('Resposta da continuação:', resposta.substring(0, 100));
        }
      } catch (e) {
        console.error('Erro na segunda chamada OpenAI:', e);
      }
      
      // Fallback se ainda não houver resposta
      if (!resposta) {
        resposta = 'Entendido! Estou processando sua solicitação.';
      }
    }
  }

  if (!resposta && acoes.length === 0) {
    throw new Error('Resposta vazia da OpenAI');
  }

  return { resposta, provider: 'openai', acoes: acoes.length > 0 ? acoes : undefined };
}

async function callLovableAI(
  messages: { role: string; content: string }[],
  modelo: string,
  tools?: any[]
): Promise<AIResponse> {
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  
  if (!LOVABLE_API_KEY) {
    throw new Error('LOVABLE_API_KEY não configurada');
  }

  // Mapear modelo OpenAI para equivalente Lovable AI
  const lovableModel = modelMapping[modelo] || 'google/gemini-2.5-flash';

  console.log('Usando Lovable AI com modelo:', lovableModel);

  const requestBody: any = {
    model: lovableModel,
    messages,
  };

  if (tools && tools.length > 0) {
    requestBody.tools = tools;
    requestBody.tool_choice = 'auto';
  }

  const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${LOVABLE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Lovable AI error ${response.status}: ${errorText}`);
  }

  const data = await response.json();
  
  // Verificar se há tool calls
  const message = data.choices?.[0]?.message;
  const toolCalls = message?.tool_calls;
  
  let resposta = message?.content || '';
  let acoes: Acao[] = [];
  
  if (toolCalls && toolCalls.length > 0) {
    for (const toolCall of toolCalls) {
      if (toolCall.function?.name === 'executar_acao') {
        try {
          const args = JSON.parse(toolCall.function.arguments);
          acoes.push(args);
        } catch (e) {
          console.error('Erro ao parsear argumentos da ação:', e);
        }
      }
    }
    
    // Se há ações mas sem resposta textual, fazer segunda chamada para obter resposta
    if (!resposta && acoes.length > 0) {
      console.log('Tool call sem resposta textual (Lovable AI), fazendo segunda chamada...');
      
      // Montar mensagens com o resultado do tool call
      const toolResultMessages: any[] = [
        ...messages,
        message, // Mensagem original com tool_calls
      ];
      
      // Adicionar resultado de cada tool call
      for (const toolCall of toolCalls) {
        toolResultMessages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: JSON.stringify({ sucesso: true, mensagem: 'Ação será executada automaticamente' }),
        });
      }
      
      // Segunda chamada sem tools para obter resposta textual
      const continuationBody: any = {
        model: lovableModel,
        messages: toolResultMessages,
      };
      
      try {
        const continuationResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${LOVABLE_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(continuationBody),
        });
        
        if (continuationResponse.ok) {
          const continuationData = await continuationResponse.json();
          resposta = continuationData.choices?.[0]?.message?.content || '';
          console.log('Resposta da continuação (Lovable):', resposta.substring(0, 100));
        }
      } catch (e) {
        console.error('Erro na segunda chamada Lovable AI:', e);
      }
      
      // Fallback se ainda não houver resposta
      if (!resposta) {
        resposta = 'Entendido! Estou processando sua solicitação.';
      }
    }
  }

  if (!resposta && acoes.length === 0) {
    throw new Error('Resposta vazia da Lovable AI');
  }

  return { resposta, provider: 'lovable', acoes: acoes.length > 0 ? acoes : undefined };
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

    // 5. Buscar dados da conversa para obter contato_id e memoria_limpa_em
    const { data: conversa } = await supabase
      .from('conversas')
      .select('contato_id, memoria_limpa_em')
      .eq('id', conversa_id)
      .single();

    const contatoId = conversa?.contato_id;
    const memoriaLimpaEm = conversa?.memoria_limpa_em;

    // 6. Buscar histórico de mensagens da conversa (últimas 20, filtrando por memoria_limpa_em)
    let historicoQuery = supabase
      .from('mensagens')
      .select('conteudo, direcao, created_at')
      .eq('conversa_id', conversa_id)
      .order('created_at', { ascending: true })
      .limit(20);

    // Se há data de limpeza de memória, ignorar mensagens anteriores
    if (memoriaLimpaEm) {
      console.log('Filtrando mensagens após:', memoriaLimpaEm);
      historicoQuery = historicoQuery.gt('created_at', memoriaLimpaEm);
    }

    const { data: historico } = await historicoQuery;

    // 7. Parsear ações das etapas para construir ferramentas
    let todasAcoes: { etapaNum: number; acoes: string[] }[] = [];
    let acoesDisponiveis: Acao[] = [];

    if (etapas && etapas.length > 0) {
      for (const etapa of etapas) {
        if (etapa.descricao) {
          const { acoes, acoesParseadas } = parseAcoesDoPrompt(etapa.descricao);
          if (acoes.length > 0) {
            todasAcoes.push({ etapaNum: etapa.numero, acoes });
            
            // Processar ações para mapear nomes de etapas para IDs
            for (const acao of acoesParseadas) {
              if (acao.tipo === 'etapa' && acao.valor) {
                const estagioId = await mapearEtapaNome(supabase, conta_id, acao.valor);
                if (estagioId) {
                  acoesDisponiveis.push({ ...acao, valor: estagioId });
                }
              } else {
                acoesDisponiveis.push(acao);
              }
            }
          }
        }
      }
    }

    // 8. Montar o prompt completo
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

    // Adicionar instruções sobre ações se houver ações configuradas
    if (acoesDisponiveis.length > 0) {
      promptCompleto += '\n\n## AÇÕES DISPONÍVEIS\n';
      promptCompleto += 'Você pode executar as seguintes ações quando apropriado:\n';
      promptCompleto += '- @etapa:<nome> - Mover o lead para uma etapa específica do CRM\n';
      promptCompleto += '- @tag:<nome> - Adicionar uma tag ao contato\n';
      promptCompleto += '- @transferir:humano - Transferir a conversa para um atendente humano\n';
      promptCompleto += '- @transferir:ia - Devolver a conversa para o agente IA\n';
      promptCompleto += '- @notificar - Enviar notificação para a equipe\n';
      promptCompleto += '- @finalizar - Encerrar a conversa\n';
      promptCompleto += '\nQuando identificar que uma ação deve ser executada baseado no contexto da conversa, use a ferramenta executar_acao.\n';
    }

    console.log('Prompt montado com', promptCompleto.length, 'caracteres');
    console.log('Ações disponíveis:', acoesDisponiveis.length);

    // 9. Montar mensagens para a API
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

    // 10. Definir ferramentas (tools) se houver ações configuradas
    const tools = acoesDisponiveis.length > 0 ? [
      {
        type: 'function',
        function: {
          name: 'executar_acao',
          description: 'Executa uma ação automatizada como mover lead para etapa do CRM, adicionar tag, transferir conversa, etc.',
          parameters: {
            type: 'object',
            properties: {
              tipo: {
                type: 'string',
                enum: ['etapa', 'tag', 'transferir', 'notificar', 'finalizar'],
                description: 'Tipo da ação a ser executada',
              },
              valor: {
                type: 'string',
                description: 'Valor associado à ação (ID da etapa, nome da tag, destino da transferência)',
              },
            },
            required: ['tipo'],
          },
        },
      },
    ] : undefined;

    // 11. Chamar API com fallback inteligente
    const modelo = agente.modelo || 'gpt-4o-mini';
    const maxTokens = agente.max_tokens || 1000;
    const temperatura = agente.temperatura || 0.7;

    let result: AIResponse;

    // Tentar OpenAI primeiro se tiver chave configurada
    if (hasOpenAIKey) {
      try {
        console.log('Tentando OpenAI com modelo:', modelo);
        result = await callOpenAI(conta.openai_api_key, messages, modelo, maxTokens, temperatura, tools);
        console.log('✅ Resposta via OpenAI');
      } catch (openaiError: any) {
        const errorMsg = openaiError.message || '';
        console.error('❌ Erro OpenAI:', errorMsg);
        
        // Fallback para Lovable AI em caso de erro
        console.log('⚡ Fallback para Lovable AI...');
        try {
          result = await callLovableAI(messages, modelo, tools);
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
        result = await callLovableAI(messages, modelo, tools);
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

    // 12. Executar ações se houver
    if (result.acoes && result.acoes.length > 0 && contatoId) {
      console.log('Executando', result.acoes.length, 'ações...');
      
      for (const acao of result.acoes) {
        try {
          const response = await fetch(`${supabaseUrl}/functions/v1/executar-acao`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${supabaseKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              acao,
              conversa_id,
              contato_id: contatoId,
              conta_id,
            }),
          });
          
          const resultado = await response.json();
          console.log('Resultado da ação:', resultado);
        } catch (e) {
          console.error('Erro ao executar ação:', e);
        }
      }
    }

    return new Response(
      JSON.stringify({ 
        resposta: result.resposta, 
        should_respond: true, 
        provider: result.provider,
        acoes_executadas: result.acoes?.length || 0,
      }),
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
