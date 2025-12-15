import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const EVOLUTION_API_URL = 'https://evolution.cognityx.com.br';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { conversa_id } = await req.json();
    
    console.log('=== PROCESSAR RESPOSTA AGORA ===');
    console.log('Conversa ID:', conversa_id);

    if (!conversa_id) {
      return new Response(JSON.stringify({ error: 'conversa_id obrigatório' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verificar se ainda há resposta pendente para esta conversa
    const { data: pendente, error: pendenteError } = await supabase
      .from('respostas_pendentes')
      .select('*')
      .eq('conversa_id', conversa_id)
      .single();

    if (pendenteError || !pendente) {
      console.log('Nenhuma resposta pendente encontrada (pode ter sido cancelada por nova mensagem)');
      return new Response(JSON.stringify({ success: true, message: 'Sem pendência' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verificar se o tempo de processar já passou
    const agora = new Date();
    const responderEm = new Date(pendente.responder_em);
    
    if (responderEm > agora) {
      console.log('Ainda não é hora de responder. Agendado para:', responderEm.toISOString());
      return new Response(JSON.stringify({ success: true, message: 'Ainda não é hora' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Processando resposta pendente...');

    // Buscar dados da conversa
    const { data: conversa, error: conversaError } = await supabase
      .from('conversas')
      .select('*, contato:contatos(*), conexao:conexoes_whatsapp(id, instance_name, token)')
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

    // Chamar ai-responder
    console.log('Chamando ai-responder...');
    const aiResponse = await fetch(
      `${supabaseUrl}/functions/v1/ai-responder`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseKey}`,
        },
        body: JSON.stringify({ conversa_id }),
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
      const conexao = conversa.conexao;
      const contato = conversa.contato;
      
      if (!conexao?.instance_name || !conexao?.token) {
        console.error('Conexão sem instance_name ou token');
        await supabase.from('respostas_pendentes').delete().eq('conversa_id', conversa_id);
        return new Response(JSON.stringify({ error: 'Conexão inválida' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      console.log('Enviando resposta para:', contato?.telefone);
      
      const sendResponse = await fetch(
        `${EVOLUTION_API_URL}/message/sendText/${conexao.instance_name}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': conexao.token,
          },
          body: JSON.stringify({
            number: contato?.telefone,
            text: aiData.resposta,
          }),
        }
      );

      if (sendResponse.ok) {
        console.log('Resposta enviada com sucesso');

        // Salvar mensagem da IA
        const { error: msgError } = await supabase.from('mensagens').insert({
          conversa_id: conversa.id,
          contato_id: contato?.id || null,
          conteudo: aiData.resposta,
          direcao: 'saida',
          tipo: 'texto',
          enviada_por_ia: true,
        });

        if (msgError) {
          console.error('Erro ao salvar mensagem:', msgError);
        }

        // Atualizar conversa
        await supabase.from('conversas').update({
          ultima_mensagem: aiData.resposta,
          ultima_mensagem_at: new Date().toISOString(),
          status: 'aguardando_cliente',
        }).eq('id', conversa.id);

        console.log('Mensagem salva e conversa atualizada');
      } else {
        const sendError = await sendResponse.text();
        console.error('Erro ao enviar:', sendResponse.status, sendError);
      }
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
