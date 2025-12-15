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
  tipo: 'etapa' | 'tag' | 'transferir' | 'notificar' | 'finalizar' | 'nome' | 'negociacao' | 'agenda';
  valor?: string;
  calendario_id?: string;
}

// Parser de ações do prompt
function parseAcoesDoPrompt(texto: string): { acoes: string[], acoesParseadas: Acao[] } {
  const acoesRegex = /@(etapa|tag|transferir|notificar|finalizar|nome|negociacao|agenda)(?::([^\s@:]+)(?::([^\s@]+))?)?/gi;
  const matches = [...texto.matchAll(acoesRegex)];
  
  const acoes: string[] = [];
  const acoesParseadas: Acao[] = [];
  
  for (const match of matches) {
    acoes.push(match[0]);
    // Remover pontuação final do valor (. , ; ! ?)
    const valorLimpo = match[2]?.replace(/[.,;!?]+$/, '') || undefined;
    const subValor = match[3]?.replace(/[.,;!?]+$/, '') || undefined;
    
    // Para ações de agenda, combinar tipo e subvalor
    const acaoObj: Acao = {
      tipo: match[1].toLowerCase() as Acao['tipo'],
      valor: subValor ? `${valorLimpo}:${subValor}` : valorLimpo,
    };
    
    acoesParseadas.push(acaoObj);
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

// Função para executar ação de agenda e retornar resultado
async function executarAgendaLocal(
  supabase: any, 
  supabaseUrl: string, 
  supabaseKey: string, 
  contaId: string,
  conversaId: string,
  contatoId: string,
  valor: string
): Promise<{ sucesso: boolean; mensagem: string; dados?: any }> {
  console.log('Executando ação de agenda local:', valor);
  
  // Buscar calendário ativo da conta
  const { data: calendario } = await supabase
    .from('calendarios_google')
    .select('id, nome')
    .eq('conta_id', contaId)
    .eq('ativo', true)
    .limit(1)
    .maybeSingle();
  
  if (!calendario) {
    return { sucesso: false, mensagem: 'Nenhum calendário Google conectado' };
  }
  
  // CONSULTAR disponibilidade
  if (valor === 'consultar' || valor.startsWith('consultar:')) {
    // Consultar disponibilidade para os próximos 7 dias
    const dataInicio = new Date().toISOString();
    const dataFim = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    
    try {
      const calendarResponse = await fetch(`${supabaseUrl}/functions/v1/google-calendar-actions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          operacao: 'consultar',
          calendario_id: calendario.id,
          dados: { data_inicio: dataInicio, data_fim: dataFim },
        }),
      });
      
      const calendarResult = await calendarResponse.json();
      
      if (calendarResult.error) {
        return { sucesso: false, mensagem: calendarResult.error };
      }
      
      // Calcular horários livres baseado nos eventos
      const eventos = calendarResult.eventos || [];
      const horariosOcupados = eventos.map((e: any) => ({
        inicio: e.inicio,
        fim: e.fim,
        titulo: e.titulo,
      }));
      
      // Gerar lista de horários disponíveis (simplificado)
      const horariosDisponiveis: string[] = [];
      const agora = new Date();
      
      for (let dia = 0; dia < 7; dia++) {
        const data = new Date(agora);
        data.setDate(data.getDate() + dia);
        data.setHours(8, 0, 0, 0);
        
        // Pular finais de semana
        if (data.getDay() === 0 || data.getDay() === 6) continue;
        
        // Verificar cada horário comercial (8h às 18h)
        for (let hora = 8; hora < 18; hora++) {
          const horarioCheck = new Date(data);
          horarioCheck.setHours(hora, 0, 0, 0);
          
          // Pular horários passados
          if (horarioCheck <= agora) continue;
          
          // Verificar se está ocupado
          const ocupado = horariosOcupados.some((e: any) => {
            const eventoInicio = new Date(e.inicio);
            const eventoFim = new Date(e.fim);
            return horarioCheck >= eventoInicio && horarioCheck < eventoFim;
          });
          
          if (!ocupado) {
            const diasSemana = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
            const diaSemanaStr = diasSemana[horarioCheck.getDay()];
            const diaStr = horarioCheck.getDate().toString().padStart(2, '0');
            const mesStr = (horarioCheck.getMonth() + 1).toString().padStart(2, '0');
            horariosDisponiveis.push(`${diaSemanaStr} ${diaStr}/${mesStr} às ${hora}h`);
          }
        }
      }
      
      return { 
        sucesso: true, 
        mensagem: 'Disponibilidade consultada',
        dados: {
          eventos_ocupados: horariosOcupados,
          horarios_disponiveis: horariosDisponiveis.slice(0, 10),
          calendario_nome: calendario.nome,
        }
      };
    } catch (e) {
      console.error('Erro ao consultar calendário:', e);
      return { sucesso: false, mensagem: 'Erro ao consultar calendário' };
    }
  }
  
  // CRIAR evento
  if (valor.startsWith('criar:')) {
    console.log('Executando criação de evento via executar-acao:', valor);
    
    try {
      const response = await fetch(`${supabaseUrl}/functions/v1/executar-acao`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          acao: { tipo: 'agenda', valor },
          conversa_id: conversaId,
          contato_id: contatoId,
          conta_id: contaId,
        }),
      });
      
      const resultado = await response.json();
      console.log('Resultado da criação de evento:', resultado);
      
      if (resultado.sucesso) {
        return {
          sucesso: true,
          mensagem: resultado.mensagem || 'Evento criado com sucesso',
          dados: resultado.dados || {},
        };
      } else {
        return {
          sucesso: false,
          mensagem: resultado.mensagem || 'Erro ao criar evento',
        };
      }
    } catch (e) {
      console.error('Erro ao executar criação de evento:', e);
      return { sucesso: false, mensagem: 'Erro ao criar evento no calendário' };
    }
  }
  
  return { sucesso: true, mensagem: 'Ação de agenda processada' };
}

async function callOpenAI(
  apiKey: string,
  messages: { role: string; content: string }[],
  modelo: string,
  maxTokens: number,
  temperatura: number,
  tools?: any[],
  executarAgendaFn?: (valor: string) => Promise<{ sucesso: boolean; mensagem: string; dados?: any }>
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
    // Processar tool calls e obter resultados
    const toolResults: { tool_call_id: string; content: string }[] = [];
    
    for (const toolCall of toolCalls) {
      if (toolCall.function?.name === 'executar_acao') {
        try {
          const args = JSON.parse(toolCall.function.arguments);
          acoes.push(args);
          
          // Se for ação de agenda (consultar OU criar), executar e guardar resultado
          if (args.tipo === 'agenda' && executarAgendaFn) {
            const resultado = await executarAgendaFn(args.valor);
            toolResults.push({
              tool_call_id: toolCall.id,
              content: JSON.stringify(resultado),
            });
          } else {
            toolResults.push({
              tool_call_id: toolCall.id,
              content: JSON.stringify({ sucesso: true, mensagem: 'Ação será executada automaticamente' }),
            });
          }
        } catch (e) {
          console.error('Erro ao parsear argumentos da ação:', e);
          toolResults.push({
            tool_call_id: toolCall.id,
            content: JSON.stringify({ sucesso: false, mensagem: 'Erro ao processar ação' }),
          });
        }
      }
    }
    
    // Se há ações, fazer segunda chamada com os resultados
    if (acoes.length > 0) {
      console.log('Tool call detectado, fazendo segunda chamada com resultados...');
      
      // Montar mensagens com o resultado do tool call
      const toolResultMessages: any[] = [
        ...messages,
        message, // Mensagem original com tool_calls
      ];
      
      // Adicionar resultado de cada tool call
      for (const result of toolResults) {
        toolResultMessages.push({
          role: 'tool',
          tool_call_id: result.tool_call_id,
          content: result.content,
        });
      }
      
      // Segunda chamada para obter resposta textual com os resultados
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
  tools?: any[],
  executarAgendaFn?: (valor: string) => Promise<{ sucesso: boolean; mensagem: string; dados?: any }>
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
    // Processar tool calls e obter resultados
    const toolResults: { tool_call_id: string; content: string }[] = [];
    
    for (const toolCall of toolCalls) {
      if (toolCall.function?.name === 'executar_acao') {
        try {
          const args = JSON.parse(toolCall.function.arguments);
          acoes.push(args);
          
          // Se for ação de agenda:consultar, executar e guardar resultado
          if (args.tipo === 'agenda' && args.valor?.startsWith('consultar') && executarAgendaFn) {
            const resultado = await executarAgendaFn(args.valor);
            toolResults.push({
              tool_call_id: toolCall.id,
              content: JSON.stringify(resultado),
            });
          } else {
            toolResults.push({
              tool_call_id: toolCall.id,
              content: JSON.stringify({ sucesso: true, mensagem: 'Ação será executada automaticamente' }),
            });
          }
        } catch (e) {
          console.error('Erro ao parsear argumentos da ação:', e);
          toolResults.push({
            tool_call_id: toolCall.id,
            content: JSON.stringify({ sucesso: false, mensagem: 'Erro ao processar ação' }),
          });
        }
      }
    }
    
    // Se há ações, fazer segunda chamada com os resultados
    if (acoes.length > 0) {
      console.log('Tool call detectado (Lovable AI), fazendo segunda chamada com resultados...');
      
      // Montar mensagens com o resultado do tool call
      const toolResultMessages: any[] = [
        ...messages,
        message, // Mensagem original com tool_calls
      ];
      
      // Adicionar resultado de cada tool call
      for (const result of toolResults) {
        toolResultMessages.push({
          role: 'tool',
          tool_call_id: result.tool_call_id,
          content: result.content,
        });
      }
      
      // Segunda chamada para obter resposta textual com os resultados
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

    const { conversa_id, mensagem, conta_id, mensagem_tipo, transcricao, descricao_imagem } = await req.json();

    console.log('=== AI RESPONDER ===');
    console.log('Conversa ID:', conversa_id);
    console.log('Conta ID:', conta_id);
    console.log('Mensagem recebida:', mensagem);
    console.log('Tipo de mensagem:', mensagem_tipo || 'texto');
    if (transcricao) {
      console.log('Transcrição de áudio:', transcricao.substring(0, 100));
    }
    if (descricao_imagem) {
      console.log('Descrição de imagem:', descricao_imagem.substring(0, 100));
    }

    // 1. Buscar API Key da OpenAI da conta (opcional agora)
    const { data: conta } = await supabase
      .from('contas')
      .select('openai_api_key')
      .eq('id', conta_id)
      .single();

    const hasOpenAIKey = !!conta?.openai_api_key;
    console.log('OpenAI API Key configurada:', hasOpenAIKey);

    // 2. Buscar dados da conversa para determinar qual agente usar
    const { data: conversaData } = await supabase
      .from('conversas')
      .select('agente_ia_id')
      .eq('id', conversa_id)
      .single();

    let agente = null;

    // Se a conversa tem um agente específico atribuído, usar ele
    if (conversaData?.agente_ia_id) {
      console.log('Conversa tem agente específico:', conversaData.agente_ia_id);
      const { data: agenteEspecifico } = await supabase
        .from('agent_ia')
        .select('*')
        .eq('id', conversaData.agente_ia_id)
        .eq('ativo', true)
        .single();
      
      agente = agenteEspecifico;
    }

    // Se não tem agente específico ou ele não está ativo, buscar agente principal
    if (!agente) {
      console.log('Buscando agente principal da conta...');
      const { data: agentePrincipal } = await supabase
        .from('agent_ia')
        .select('*')
        .eq('conta_id', conta_id)
        .eq('tipo', 'principal')
        .eq('ativo', true)
        .single();
      
      agente = agentePrincipal;
    }

    // Se ainda não encontrou, buscar qualquer agente ativo
    if (!agente) {
      console.log('Buscando qualquer agente ativo da conta...');
      const { data: agenteQualquer } = await supabase
        .from('agent_ia')
        .select('*')
        .eq('conta_id', conta_id)
        .eq('ativo', true)
        .limit(1)
        .maybeSingle();
      
      agente = agenteQualquer;
    }

    if (!agente) {
      console.log('Nenhum agente IA ativo para esta conta');
      return new Response(
        JSON.stringify({ error: 'Nenhum agente IA ativo', should_respond: false }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Agente encontrado:', agente.nome, '(tipo:', agente.tipo + ')');

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

    // Adicionar contexto temporal (Brasil - UTC-3)
    const agora = new Date();
    const brasilOffset = -3 * 60;
    const utcOffset = agora.getTimezoneOffset();
    const diferencaMinutos = brasilOffset + utcOffset;
    const agoraBrasil = new Date(agora.getTime() + diferencaMinutos * 60 * 1000);

    const diasSemana = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
    const meses = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

    const diaSemana = diasSemana[agoraBrasil.getDay()];
    const diaNum = agoraBrasil.getDate();
    const mes = meses[agoraBrasil.getMonth()];
    const ano = agoraBrasil.getFullYear();
    const hora = agoraBrasil.getHours().toString().padStart(2, '0');
    const minuto = agoraBrasil.getMinutes().toString().padStart(2, '0');

    let periodo = 'madrugada';
    const horaNum = agoraBrasil.getHours();
    if (horaNum >= 5 && horaNum < 12) periodo = 'manhã';
    else if (horaNum >= 12 && horaNum < 18) periodo = 'tarde';
    else if (horaNum >= 18 && horaNum < 24) periodo = 'noite';

    promptCompleto += `\n\n## CONTEXTO TEMPORAL\n`;
    promptCompleto += `- Data atual: ${diaNum} de ${mes} de ${ano}\n`;
    promptCompleto += `- Dia da semana: ${diaSemana}\n`;
    promptCompleto += `- Horário atual: ${hora}:${minuto} (horário de Brasília)\n`;
    promptCompleto += `- Período do dia: ${periodo}\n`;
    promptCompleto += `\nUse estas informações para cumprimentos apropriados (Bom dia/Boa tarde/Boa noite) e referências temporais.\n`;

    // Adicionar contexto de mídia se for áudio com transcrição
    if (mensagem_tipo === 'audio' && transcricao) {
      promptCompleto += `\n\n## CONTEXTO DE MÍDIA\n`;
      promptCompleto += `O lead enviou um áudio. Transcrição do áudio:\n"${transcricao}"\n\n`;
      promptCompleto += `Responda naturalmente como se tivesse ouvido e compreendido o áudio. Não mencione que recebeu uma transcrição.\n`;
    }

    // Adicionar contexto de mídia se for imagem com descrição
    if (mensagem_tipo === 'imagem' && descricao_imagem) {
      promptCompleto += `\n\n## CONTEXTO DE MÍDIA\n`;
      promptCompleto += `O lead enviou uma imagem. Análise da imagem:\n"${descricao_imagem}"\n\n`;
      promptCompleto += `Responda naturalmente baseado no conteúdo da imagem. Exemplos de comportamento:\n`;
      promptCompleto += `- Se for um comprovante de pagamento: confirme o recebimento e mencione o valor se visível.\n`;
      promptCompleto += `- Se for um produto: identifique e forneça informações relevantes.\n`;
      promptCompleto += `- Se tiver dados importantes (valores, datas, nomes): mencione-os naturalmente.\n`;
      promptCompleto += `- Se for um screenshot de erro: ajude a resolver o problema.\n`;
      promptCompleto += `Não mencione que recebeu uma análise ou descrição da imagem. Aja como se tivesse visto a imagem diretamente.\n`;
    }

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
      promptCompleto += '- @negociacao:<funil/estagio> ou @negociacao:<funil/estagio>:<valor> - Criar uma nova negociação no CRM\n';
      promptCompleto += '- @transferir:humano - Transferir a conversa para um atendente humano\n';
      promptCompleto += '- @transferir:ia - Devolver a conversa para o agente IA principal\n';
      promptCompleto += '- @transferir:agente:<id_ou_nome> - Transferir a conversa para outro agente IA específico\n';
      promptCompleto += '- @notificar - Enviar notificação para a equipe\n';
      promptCompleto += '- @finalizar - Encerrar a conversa\n';
      promptCompleto += '- @nome:<novo nome> - Alterar o nome do contato/lead (use quando o cliente se identificar)\n';
      promptCompleto += '- @agenda:consultar - Consultar disponibilidade do calendário (próximos 7 dias)\n';
      promptCompleto += '- @agenda:criar:<titulo>|<data_inicio> - Criar evento no calendário com Google Meet (datas em ISO8601)\n';
      promptCompleto += '\n### INSTRUÇÕES DE AGENDAMENTO (MUITO IMPORTANTE)\n';
      promptCompleto += 'O agendamento DEVE ser feito em ETAPAS SEPARADAS:\n\n';
      
      promptCompleto += '**ETAPA 1 - Quando o cliente PERGUNTAR sobre agendamento:**\n';
      promptCompleto += '- Use @agenda:consultar para verificar disponibilidade\n';
      promptCompleto += '- O sistema retornará os horários livres\n';
      promptCompleto += '- Apresente as opções de horários ao cliente\n';
      promptCompleto += '- PARE e AGUARDE o cliente escolher um horário\n';
      promptCompleto += '- NÃO diga "vou agendar" nesta etapa - apenas ofereça as opções!\n\n';
      
      promptCompleto += '**ETAPA 2 - SOMENTE após o cliente CONFIRMAR um horário específico:**\n';
      promptCompleto += '- QUANDO o cliente disser "pode ser às Xh", "confirmo", "esse horário", "pode agendar", etc.\n';
      promptCompleto += '- ENTÃO use @agenda:criar:<titulo>|<data_inicio> para criar o evento\n';
      promptCompleto += '- Exemplo: @agenda:criar:Reunião com João|2025-01-20T14:00:00-03:00\n';
      promptCompleto += '- O sistema criará evento de 1 hora com link do Google Meet\n';
      promptCompleto += '- O resultado incluirá o campo "meet_link" - SEMPRE inclua este link na sua resposta!\n';
      promptCompleto += '- Considere horário comercial (8h-18h)\n\n';
      
      promptCompleto += '**COMPORTAMENTO OBRIGATÓRIO:**\n';
      promptCompleto += '- NUNCA execute @agenda:criar se o cliente apenas perguntou sobre horários\n';
      promptCompleto += '- NUNCA diga "vou agendar" ou "só um momento" antes do cliente confirmar\n';
      promptCompleto += '- SEMPRE espere confirmação explícita antes de criar o evento\n';
      promptCompleto += '- SEMPRE inclua o link do Google Meet na resposta após criar o evento\n';
      
      promptCompleto += '\nQuando identificar que uma ação deve ser executada baseado no contexto da conversa, use a ferramenta executar_acao.\n';
      promptCompleto += '\n## REGRAS IMPORTANTES\n';
      promptCompleto += '- NUNCA mencione ao cliente que está executando ações internas como transferências, mudanças de etapa, tags, etc.\n';
      promptCompleto += '- NUNCA inclua comandos @ na sua resposta ao cliente (ex: @transferir, @etapa, @tag).\n';
      promptCompleto += '- As ações são executadas silenciosamente em background. Mantenha o fluxo natural da conversa.\n';
      promptCompleto += '- Quando transferir para outro agente, apenas se despeça naturalmente sem mencionar a transferência.\n';
    }

    // Adicionar restrições absolutas de escopo
    promptCompleto += '\n## RESTRIÇÕES ABSOLUTAS\n';
    promptCompleto += '- NUNCA invente informações sobre você, sua identidade, sua empresa ou seus serviços.\n';
    promptCompleto += '- Se o lead perguntar "quem é você?", "o que você faz?", "sobre a empresa" ou perguntas similares, responda APENAS com informações que estão explicitamente configuradas acima nas regras gerais, etapas ou perguntas frequentes.\n';
    promptCompleto += '- Se não houver informação suficiente no prompt configurado para responder uma pergunta sobre você ou a empresa, diga educadamente que pode ajudar com outras questões ou solicite que o lead entre em contato com a equipe.\n';
    promptCompleto += '- NUNCA adicione detalhes, funções, serviços ou características que não foram mencionados nas instruções acima.\n';
    promptCompleto += '- Mantenha-se estritamente dentro do escopo das informações fornecidas.\n';

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
          description: 'Executa uma ação automatizada como mover lead para etapa do CRM, adicionar tag, transferir conversa, alterar nome do contato, consultar agenda ou criar evento.',
          parameters: {
            type: 'object',
            properties: {
              tipo: {
                type: 'string',
                enum: ['etapa', 'tag', 'transferir', 'notificar', 'finalizar', 'nome', 'negociacao', 'agenda'],
                description: 'Tipo da ação a ser executada. Use "nome" para alterar o nome do contato quando ele se identificar. Use "negociacao" para criar uma nova negociação no CRM. Use "agenda" para consultar disponibilidade ou criar eventos.',
              },
              valor: {
                type: 'string',
                description: 'Valor associado à ação (ID da etapa, nome da tag, destino da transferência, novo nome do contato, para agenda use "consultar" ou "criar:titulo|data_inicio" onde data_inicio é ISO8601)',
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

    // Criar função de execução de agenda para passar para as chamadas de IA
    const executarAgendaFn = async (valor: string) => {
      return await executarAgendaLocal(supabase, supabaseUrl, supabaseKey, conta_id, conversa_id, contatoId, valor);
    };

    let result: AIResponse;

    // Tentar OpenAI primeiro se tiver chave configurada
    if (hasOpenAIKey) {
      try {
        console.log('Tentando OpenAI com modelo:', modelo);
        result = await callOpenAI(conta.openai_api_key, messages, modelo, maxTokens, temperatura, tools, executarAgendaFn);
        console.log('✅ Resposta via OpenAI');
      } catch (openaiError: any) {
        const errorMsg = openaiError.message || '';
        console.error('❌ Erro OpenAI:', errorMsg);
        
        // Fallback para Lovable AI em caso de erro
        console.log('⚡ Fallback para Lovable AI...');
        try {
          result = await callLovableAI(messages, modelo, tools, executarAgendaFn);
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
        result = await callLovableAI(messages, modelo, tools, executarAgendaFn);
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
        // Pular ações de agenda:consultar que já foram executadas durante o tool-calling
        if (acao.tipo === 'agenda' && acao.valor?.startsWith('consultar')) {
          console.log('Pulando ação agenda:consultar (já executada durante tool-calling)');
          continue;
        }
        
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

    // Limpar comandos @ que possam ter vazado para o texto da resposta
    let respostaFinal = result.resposta;
    respostaFinal = respostaFinal.replace(/@(etapa|tag|transferir|notificar|finalizar|nome|negociacao|agenda)(?::[^\s@.,!?]+(?::[^\s@.,!?]+)?)?/gi, '').trim();
    respostaFinal = respostaFinal.replace(/\s{2,}/g, ' ').trim();
    
    // Remover menções de transferência que possam ter escapado
    respostaFinal = respostaFinal.replace(/estou transferindo.*?(humano|agente|atendente).*?\./gi, '').trim();

    return new Response(
      JSON.stringify({ 
        resposta: respostaFinal, 
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
