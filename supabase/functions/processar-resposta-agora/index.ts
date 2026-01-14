import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const EVOLUTION_API_URL = 'https://evolution.cognityx.com.br';

// Função para dividir mensagem de forma inteligente
function dividirMensagem(texto: string, tamanhoMax: number): string[] {
  if (texto.length <= tamanhoMax) {
    return [texto];
  }

  const fracoes: string[] = [];
  const paragrafos = texto.split(/\n\n+/);
  let fracaoAtual = '';

  for (const paragrafo of paragrafos) {
    // Se o parágrafo cabe na fração atual
    if (fracaoAtual.length + paragrafo.length + 2 <= tamanhoMax) {
      fracaoAtual = fracaoAtual ? `${fracaoAtual}\n\n${paragrafo}` : paragrafo;
    } else {
      // Se a fração atual não está vazia, salva ela
      if (fracaoAtual) {
        fracoes.push(fracaoAtual.trim());
        fracaoAtual = '';
      }

      // Se o parágrafo é maior que o tamanho máximo, divide por frases
      if (paragrafo.length > tamanhoMax) {
        const frases = paragrafo.split(/(?<=[.!?])\s+/);
        
        for (const frase of frases) {
          if (fracaoAtual.length + frase.length + 1 <= tamanhoMax) {
            fracaoAtual = fracaoAtual ? `${fracaoAtual} ${frase}` : frase;
          } else {
            if (fracaoAtual) {
              fracoes.push(fracaoAtual.trim());
            }
            // Se a frase sozinha é maior que o max, divide por palavras
            if (frase.length > tamanhoMax) {
              const palavras = frase.split(/\s+/);
              fracaoAtual = '';
              for (const palavra of palavras) {
                if (fracaoAtual.length + palavra.length + 1 <= tamanhoMax) {
                  fracaoAtual = fracaoAtual ? `${fracaoAtual} ${palavra}` : palavra;
                } else {
                  if (fracaoAtual) {
                    fracoes.push(fracaoAtual.trim());
                  }
                  fracaoAtual = palavra;
                }
              }
            } else {
              fracaoAtual = frase;
            }
          }
        }
      } else {
        fracaoAtual = paragrafo;
      }
    }
  }

  // Adiciona a última fração se houver
  if (fracaoAtual.trim()) {
    fracoes.push(fracaoAtual.trim());
  }

  return fracoes;
}

// Função de sleep
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Usar banco de dados EXTERNO como principal
    const supabaseUrl = Deno.env.get('EXTERNAL_SUPABASE_URL') || Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('EXTERNAL_SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    console.log('📦 Usando banco:', supabaseUrl.substring(0, 30) + '...');

    const { conversa_id } = await req.json();
    
    console.log('=== PROCESSAR RESPOSTA AGORA ===');
    console.log('Conversa ID:', conversa_id);

    if (!conversa_id) {
      return new Response(JSON.stringify({ error: 'conversa_id obrigatório' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Tentar adquirir lock atomicamente - só atualiza se processando = false
    const { data: pendente, error: lockError } = await supabase
      .from('respostas_pendentes')
      .update({ processando: true })
      .eq('conversa_id', conversa_id)
      .eq('processando', false)
      .select('*')
      .maybeSingle();

    if (lockError) {
      console.error('Erro ao adquirir lock:', lockError);
      return new Response(JSON.stringify({ error: 'Erro ao adquirir lock' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!pendente) {
      console.log('Nenhuma resposta pendente encontrada ou já está sendo processada por outra instância');
      return new Response(JSON.stringify({ success: true, message: 'Sem pendência ou já processando' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verificar se o tempo de processar já passou
    const agora = new Date();
    const responderEm = new Date(pendente.responder_em);
    
    if (responderEm > agora) {
      console.log('Ainda não é hora de responder. Agendado para:', responderEm.toISOString());
      // Liberar o lock se ainda não é hora
      await supabase.from('respostas_pendentes').update({ processando: false }).eq('conversa_id', conversa_id);
      return new Response(JSON.stringify({ success: true, message: 'Ainda não é hora' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Lock adquirido com sucesso, processando resposta...');

    console.log('Processando resposta pendente...');

    // Buscar dados da conversa
    const { data: conversa, error: conversaError } = await supabase
      .from('conversas')
      .select('*, contato:contatos(*), conexao:conexoes_whatsapp(id, instance_name, token, tipo_provedor), agente:agent_ia(fracionar_mensagens, tamanho_max_fracao, delay_entre_fracoes, simular_digitacao)')
      .eq('id', conversa_id)
      .single();

    if (conversaError || !conversa) {
      console.error('Erro ao buscar conversa:', conversaError);
      // Remover pendência inválida
      await supabase.from('respostas_pendentes').delete().eq('conversa_id', conversa_id);
      return new Response(JSON.stringify({ error: 'Conversa não encontrada' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verificar se IA ainda está ativa
    if (!conversa.agente_ia_ativo) {
      console.log('IA desativada para esta conversa');
      await supabase.from('respostas_pendentes').delete().eq('conversa_id', conversa_id);
      return new Response(JSON.stringify({ success: true, message: 'IA desativada' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Buscar a última mensagem do lead para passar ao ai-responder
    const { data: ultimaMensagem } = await supabase
      .from('mensagens')
      .select('conteudo, tipo, metadata')
      .eq('conversa_id', conversa_id)
      .eq('direcao', 'entrada')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    // Extrair transcrição/descrição/texto de documento se houver
    const metadata = (ultimaMensagem?.metadata as Record<string, any>) || {};
    const transcricao = metadata.transcricao || null;
    const descricaoImagem = metadata.descricao_imagem || null;
    const textoDocumento = metadata.texto_documento || null;

    console.log('Última mensagem do lead:', ultimaMensagem?.conteudo?.substring(0, 50));
    console.log('Conta ID:', conversa.conta_id);
    if (textoDocumento) {
      console.log('Texto de documento detectado:', textoDocumento.substring(0, 50));
    }

    // Chamar ai-responder com TODOS os dados necessários
    console.log('Chamando ai-responder...');
    const aiResponse = await fetch(
      `${supabaseUrl}/functions/v1/ai-responder`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseKey}`,
        },
        body: JSON.stringify({
          conversa_id,
          mensagem: transcricao || ultimaMensagem?.conteudo || 'Olá',
          conta_id: conversa.conta_id,
          mensagem_tipo: ultimaMensagem?.tipo || 'texto',
          transcricao,
          descricao_imagem: descricaoImagem,
          texto_documento: textoDocumento,
        }),
      }
    );

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('Erro ao chamar ai-responder:', aiResponse.status, errorText);
      // Remover pendência para não ficar tentando infinitamente
      await supabase.from('respostas_pendentes').delete().eq('conversa_id', conversa_id);
      return new Response(JSON.stringify({ error: 'Erro no ai-responder' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const aiData = await aiResponse.json();
    console.log('Resposta IA:', aiData?.resposta?.substring(0, 100) || 'sem resposta');

    // Enviar resposta se houver
    if (aiData.should_respond && aiData.resposta) {
      const conexao = conversa.conexao as { id: string; instance_name: string; token: string; tipo_provedor?: string } | null;
      const contato = conversa.contato;
      const agente = conversa.agente as { fracionar_mensagens?: boolean; tamanho_max_fracao?: number; delay_entre_fracoes?: number; simular_digitacao?: boolean } | null;
      
      if (!conexao?.id) {
        console.error('Conexão não encontrada');
        await supabase.from('respostas_pendentes').delete().eq('conversa_id', conversa_id);
        return new Response(JSON.stringify({ error: 'Conexão inválida' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const tipoProvedor = conexao.tipo_provedor || 'evolution';
      console.log('Tipo de provedor:', tipoProvedor);

      // Verificar se deve fracionar a mensagem
      const fracionarMensagens = agente?.fracionar_mensagens ?? false;
      const tamanhoMaxFracao = agente?.tamanho_max_fracao ?? 500;
      const delayEntreFracoes = agente?.delay_entre_fracoes ?? 2;
      const simularDigitacao = agente?.simular_digitacao ?? false;

      let mensagensParaEnviar: string[] = [aiData.resposta];
      
      if (fracionarMensagens && aiData.resposta.length > tamanhoMaxFracao) {
        mensagensParaEnviar = dividirMensagem(aiData.resposta, tamanhoMaxFracao);
        console.log(`Mensagem fracionada em ${mensagensParaEnviar.length} partes`);
      }

      console.log('Enviando resposta para:', contato?.telefone);
      
      // Enviar cada fração com delay
      for (let i = 0; i < mensagensParaEnviar.length; i++) {
        const fracao = mensagensParaEnviar[i];
        
        // Delay entre mensagens (exceto a primeira)
        if (i > 0 && fracionarMensagens) {
          console.log(`Aguardando ${delayEntreFracoes}s antes de enviar fração ${i + 1}...`);
          await sleep(delayEntreFracoes * 1000);
        }

        // Simular digitação apenas para Evolution API (Meta não suporta)
        if (simularDigitacao && tipoProvedor === 'evolution' && conexao.instance_name && conexao.token) {
          try {
            console.log('Enviando indicador de digitação...');
            await fetch(
              `${EVOLUTION_API_URL}/chat/sendPresence/${conexao.instance_name}`,
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'apikey': conexao.token,
                },
                body: JSON.stringify({
                  number: contato?.telefone,
                  presence: 'composing',
                }),
              }
            );
            // Tempo de "digitação" proporcional ao tamanho da mensagem (min 1s, max 3s)
            const tempoDigitacao = Math.min(3000, Math.max(1000, fracao.length * 15));
            console.log(`Simulando digitação por ${tempoDigitacao}ms...`);
            await sleep(tempoDigitacao);
          } catch (typingError) {
            console.error('Erro ao enviar indicador de digitação:', typingError);
            // Continua mesmo se falhar o typing
          }
        }

        // Usar a função centralizada enviar-mensagem que roteia para o provedor correto
        const sendResponse = await fetch(
          `${supabaseUrl}/functions/v1/enviar-mensagem`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${supabaseKey}`,
            },
            body: JSON.stringify({
              conexao_id: conexao.id,
              telefone: contato?.telefone,
              mensagem: fracao,
              tipo: 'texto',
            }),
          }
        );

        if (sendResponse.ok) {
          console.log(`Fração ${i + 1}/${mensagensParaEnviar.length} enviada com sucesso via ${tipoProvedor}`);

          // Salvar mensagem da IA
          const { error: msgError } = await supabase.from('mensagens').insert({
            conversa_id: conversa.id,
            contato_id: contato?.id || null,
            conteudo: fracao,
            direcao: 'saida',
            tipo: 'texto',
            enviada_por_ia: true,
          });

          if (msgError) {
            console.error('Erro ao salvar mensagem:', msgError);
          }
        } else {
          const sendError = await sendResponse.text();
          console.error('Erro ao enviar via enviar-mensagem:', sendResponse.status, sendError);
        }
      }

      // Atualizar conversa com a última fração (ou mensagem completa se não fracionou)
      await supabase.from('conversas').update({
        ultima_mensagem: mensagensParaEnviar[mensagensParaEnviar.length - 1],
        ultima_mensagem_at: new Date().toISOString(),
        status: 'aguardando_cliente',
      }).eq('id', conversa.id);

      console.log('Mensagem(ns) salva(s) e conversa atualizada');
    } else {
      console.log('IA decidiu não responder');
    }

    // Remover da fila de pendentes
    await supabase.from('respostas_pendentes').delete().eq('conversa_id', conversa_id);
    console.log('Pendência removida');

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('Erro geral:', error);
    const message = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});