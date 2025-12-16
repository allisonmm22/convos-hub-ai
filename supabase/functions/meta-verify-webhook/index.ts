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

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const url = new URL(req.url);
    
    // Meta envia verificação via GET
    if (req.method === 'GET') {
      const mode = url.searchParams.get('hub.mode');
      const token = url.searchParams.get('hub.verify_token');
      const challenge = url.searchParams.get('hub.challenge');

      console.log('=== META WEBHOOK VERIFICATION ===');
      console.log('Mode:', mode);
      console.log('Token:', token);
      console.log('Challenge:', challenge);

      if (mode === 'subscribe' && token && challenge) {
        // Verificar se o token corresponde a alguma conexão
        const { data: conexao } = await supabase
          .from('conexoes_whatsapp')
          .select('id')
          .eq('meta_webhook_verify_token', token)
          .eq('tipo_provedor', 'meta')
          .single();

        if (conexao) {
          console.log('Token válido para conexão:', conexao.id);
          return new Response(challenge, {
            status: 200,
            headers: { 'Content-Type': 'text/plain' },
          });
        }

        // Fallback: aceitar se o token tem formato válido
        if (token.startsWith('verify_')) {
          console.log('Token com formato válido, aceitando verificação');
          return new Response(challenge, {
            status: 200,
            headers: { 'Content-Type': 'text/plain' },
          });
        }

        console.log('Token não encontrado no banco');
      }

      console.log('Verificação inválida');
      return new Response('Forbidden', { status: 403 });
    }

    // POST = mensagens recebidas
    if (req.method === 'POST') {
      const payload = await req.json();
      console.log('=== META WEBHOOK MESSAGE ===');
      console.log('Payload:', JSON.stringify(payload, null, 2));

      // Processar mensagens da Meta
      const entry = payload.entry?.[0];
      const changes = entry?.changes?.[0];
      const value = changes?.value;
      
      if (!value) {
        console.log('Payload Meta sem dados relevantes');
        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const phoneNumberId = value.metadata?.phone_number_id;
      const messages = value.messages || [];
      const contacts = value.contacts || [];

      console.log('Phone Number ID:', phoneNumberId);
      console.log('Mensagens:', messages.length);

      if (!phoneNumberId || messages.length === 0) {
        // Pode ser status update ou outro evento
        console.log('Sem mensagens para processar');
        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Buscar conexão pelo meta_phone_number_id
      const { data: conexao, error: conexaoError } = await supabase
        .from('conexoes_whatsapp')
        .select('id, conta_id, instance_name, tipo_provedor')
        .eq('meta_phone_number_id', phoneNumberId)
        .eq('tipo_provedor', 'meta')
        .single();

      if (conexaoError || !conexao) {
        console.log('Conexão Meta não encontrada para phone_number_id:', phoneNumberId);
        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      console.log('Conexão encontrada:', conexao.id);

      // Processar cada mensagem
      for (const msg of messages) {
        const fromNumber = msg.from;
        const messageType = msg.type;
        const timestamp = new Date(parseInt(msg.timestamp) * 1000).toISOString();
        const metaMsgId = msg.id;

        let messageContent = '';
        let tipo: string = 'texto';
        let mediaUrl: string | null = null;

        switch (messageType) {
          case 'text':
            messageContent = msg.text?.body || '';
            break;
          case 'image':
            tipo = 'imagem';
            messageContent = msg.image?.caption || '📷 Imagem';
            break;
          case 'audio':
            tipo = 'audio';
            messageContent = '🎵 Áudio';
            break;
          case 'video':
            tipo = 'video';
            messageContent = msg.video?.caption || '🎬 Vídeo';
            break;
          case 'document':
            tipo = 'documento';
            messageContent = msg.document?.filename || '📄 Documento';
            break;
          default:
            messageContent = `Mensagem do tipo: ${messageType}`;
        }

        console.log('Processando mensagem:', { from: fromNumber, tipo, conteudo: messageContent.substring(0, 50) });

        // Buscar ou criar contato
        const contactName = contacts.find((c: any) => c.wa_id === fromNumber)?.profile?.name || fromNumber;
        
        let { data: contato } = await supabase
          .from('contatos')
          .select('id')
          .eq('conta_id', conexao.conta_id)
          .eq('telefone', fromNumber)
          .single();

        if (!contato) {
          const { data: novoContato, error: contatoError } = await supabase
            .from('contatos')
            .insert({
              conta_id: conexao.conta_id,
              nome: contactName,
              telefone: fromNumber,
            })
            .select()
            .single();

          if (contatoError || !novoContato) {
            console.error('Erro ao criar contato:', contatoError);
            continue;
          }
          contato = novoContato;
        }

        if (!contato) {
          console.error('Contato não disponível');
          continue;
        }

        // Buscar ou criar conversa
        let { data: conversa } = await supabase
          .from('conversas')
          .select('id, agente_ia_ativo, nao_lidas, agente_ia_id, status')
          .eq('conta_id', conexao.conta_id)
          .eq('contato_id', contato.id)
          .eq('arquivada', false)
          .single();

        if (!conversa) {
          const { data: agentePrincipal } = await supabase
            .from('agent_ia')
            .select('id')
            .eq('conta_id', conexao.conta_id)
            .eq('tipo', 'principal')
            .eq('ativo', true)
            .maybeSingle();

          const { data: novaConversa, error: conversaError } = await supabase
            .from('conversas')
            .insert({
              conta_id: conexao.conta_id,
              contato_id: contato.id,
              conexao_id: conexao.id,
              agente_ia_ativo: true,
              agente_ia_id: agentePrincipal?.id || null,
              status: 'em_atendimento',
            })
            .select()
            .single();

          if (conversaError || !novaConversa) {
            console.error('Erro ao criar conversa:', conversaError);
            continue;
          }
          conversa = novaConversa;
        }

        if (!conversa) {
          console.error('Conversa não disponível');
          continue;
        }

        // Verificar duplicatas
        const { data: existingMsg } = await supabase
          .from('mensagens')
          .select('id')
          .eq('conversa_id', conversa.id)
          .contains('metadata', { meta_msg_id: metaMsgId })
          .single();

        if (existingMsg) {
          console.log('Mensagem já existe, ignorando:', metaMsgId);
          continue;
        }

        // Inserir mensagem
        const { error: msgError } = await supabase.from('mensagens').insert({
          conversa_id: conversa.id,
          contato_id: contato.id,
          conteudo: messageContent,
          direcao: 'entrada',
          tipo,
          media_url: mediaUrl,
          metadata: { meta_msg_id: metaMsgId },
        });

        if (msgError) {
          console.error('Erro ao inserir mensagem:', msgError);
          continue;
        }

        // Atualizar conversa
        await supabase
          .from('conversas')
          .update({
            ultima_mensagem: messageContent,
            ultima_mensagem_at: timestamp,
            nao_lidas: (conversa.nao_lidas || 0) + 1,
            status: 'em_atendimento',
          })
          .eq('id', conversa.id);

        // Se IA ativa, agendar resposta
        if (conversa.agente_ia_ativo) {
          const { data: agenteConfig } = await supabase
            .from('agent_ia')
            .select('tempo_espera_segundos')
            .eq('id', conversa.agente_ia_id)
            .single();

          const tempoEspera = agenteConfig?.tempo_espera_segundos || 5;
          const responderEm = new Date(Date.now() + tempoEspera * 1000).toISOString();

          await supabase
            .from('respostas_pendentes')
            .upsert({ conversa_id: conversa.id, responder_em: responderEm }, { onConflict: 'conversa_id' });

          // @ts-ignore
          if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime.waitUntil) {
            // @ts-ignore
            EdgeRuntime.waitUntil(
              new Promise<void>((resolve) => {
                setTimeout(async () => {
                  try {
                    await fetch(`${supabaseUrl}/functions/v1/processar-resposta-agora`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseKey}` },
                      body: JSON.stringify({ conversa_id: conversa.id }),
                    });
                  } catch (err) {
                    console.error('Erro ao chamar processador:', err);
                  }
                  resolve();
                }, tempoEspera * 1000);
              })
            );
          }
        }

        console.log('Mensagem Meta processada com sucesso');
      }

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response('Method not allowed', { status: 405 });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    console.error('Erro no webhook Meta:', errorMessage);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
