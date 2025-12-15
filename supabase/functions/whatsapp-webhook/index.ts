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
    const dbUrl = Deno.env.get('SUPABASE_DB_URL')!;
    
    const supabase = createClient(supabaseUrl, supabaseKey);

    const payload = await req.json();
    console.log('=== WEBHOOK RECEBIDO ===');
    console.log('Payload completo:', JSON.stringify(payload, null, 2));

    // Evolution API pode enviar eventos em diferentes formatos
    const event = payload.event?.toLowerCase() || '';
    const instance = payload.instance;
    const data = payload.data;

    console.log('Evento:', event);
    console.log('Instância:', instance);

    // Normalizar evento (Evolution API v2 usa maiúsculas)
    const normalizedEvent = event.replace(/_/g, '.').toLowerCase();
    console.log('Evento normalizado:', normalizedEvent);

    // Tratar evento de atualização de conexão
    if (normalizedEvent === 'connection.update' || event === 'connection_update') {
      console.log('=== EVENTO DE CONEXÃO ===');
      console.log('Data:', JSON.stringify(data));
      
      const state = data?.state || data?.status;
      let status: 'conectado' | 'desconectado' | 'aguardando' = 'desconectado';
      
      if (state === 'open' || state === 'connected') {
        status = 'conectado';
      } else if (state === 'connecting' || state === 'qr') {
        status = 'aguardando';
      } else if (state === 'close' || state === 'disconnected') {
        status = 'desconectado';
      }

      console.log('Status calculado:', status);

      // Extrair número do telefone
      const numero = data?.instance?.owner?.split('@')[0] || 
                    data?.ownerJid?.split('@')[0] || 
                    null;

      const { error: updateError } = await supabase
        .from('conexoes_whatsapp')
        .update({ 
          status,
          numero,
        })
        .eq('instance_name', instance);

      if (updateError) {
        console.error('Erro ao atualizar status:', updateError);
      } else {
        console.log('Status atualizado para:', status, 'Número:', numero);
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Tratar evento de atualização do QR Code
    if (normalizedEvent === 'qrcode.updated' || event === 'qrcode_updated' || event === 'qr') {
      console.log('=== EVENTO DE QRCODE ===');
      
      const qrcode = data?.qrcode?.base64 || data?.qrcode || data?.base64;
      
      if (qrcode) {
        console.log('QR Code recebido para instância:', instance);
        
        await supabase
          .from('conexoes_whatsapp')
          .update({ 
            qrcode,
            status: 'aguardando',
          })
          .eq('instance_name', instance);
          
        console.log('QR Code salvo no banco');
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Tratar mensagens recebidas (vários formatos possíveis)
    if (normalizedEvent === 'messages.upsert' || event === 'messages_upsert' || event === 'message') {
      console.log('=== EVENTO DE MENSAGEM ===');
      console.log('Data:', JSON.stringify(data, null, 2));

      // Extrair dados da mensagem (múltiplos formatos)
      const message = data?.message || data?.messages?.[0] || data;
      const key = data?.key || message?.key || {};
      const remoteJid = key.remoteJid || data?.remoteJid || data?.from;
      const fromMe = key.fromMe ?? data?.fromMe ?? false;
      const pushName = data?.pushName || message?.pushName || '';

      console.log('RemoteJid:', remoteJid);
      console.log('FromMe:', fromMe);
      console.log('PushName:', pushName);

      if (!remoteJid) {
        console.log('RemoteJid não encontrado, ignorando');
        return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
      }

      // Ignorar mensagens de grupo por enquanto
      if (remoteJid.includes('@g.us')) {
        console.log('Mensagem de grupo ignorada');
        return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
      }

      // Extrair conteúdo da mensagem
      let messageContent = '';
      let messageType: 'texto' | 'imagem' | 'audio' | 'video' | 'documento' | 'sticker' = 'texto';
      let mediaUrl: string | null = null;
      let needsMediaDownload = false;
      const messageId = key.id;

      // Diferentes estruturas de mensagem na Evolution API
      const msgContent = message?.message || message;
      
      if (msgContent?.conversation) {
        messageContent = msgContent.conversation;
      } else if (msgContent?.extendedTextMessage?.text) {
        messageContent = msgContent.extendedTextMessage.text;
      } else if (msgContent?.imageMessage) {
        messageType = 'imagem';
        messageContent = msgContent.imageMessage.caption || '📷 Imagem';
        needsMediaDownload = true;
      } else if (msgContent?.audioMessage) {
        messageType = 'audio';
        messageContent = '🎵 Áudio';
        needsMediaDownload = true;
      } else if (msgContent?.videoMessage) {
        messageType = 'video';
        messageContent = msgContent.videoMessage.caption || '🎬 Vídeo';
        needsMediaDownload = true;
      } else if (msgContent?.documentMessage) {
        messageType = 'documento';
        messageContent = msgContent.documentMessage.fileName || '📄 Documento';
        needsMediaDownload = true;
      } else if (msgContent?.stickerMessage) {
        messageType = 'sticker';
        messageContent = '🎨 Sticker';
        needsMediaDownload = true;
      } else if (typeof message === 'string') {
        messageContent = message;
      } else if (data?.body) {
        messageContent = data.body;
      }

      // Se é mídia, fazer download e salvar no Storage
      if (needsMediaDownload && messageId) {
        console.log('Baixando mídia:', messageType, messageId);
        try {
          const downloadResponse = await fetch(
            `${supabaseUrl}/functions/v1/download-media`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${supabaseKey}`,
              },
              body: JSON.stringify({
                instance_name: instance,
                message_id: messageId,
                message_type: messageType,
              }),
            }
          );

          if (downloadResponse.ok) {
            const downloadData = await downloadResponse.json();
            mediaUrl = downloadData.url;
            console.log('Mídia baixada com sucesso:', mediaUrl);
          } else {
            console.error('Erro ao baixar mídia:', await downloadResponse.text());
          }
        } catch (downloadError) {
          console.error('Erro ao chamar download-media:', downloadError);
        }
      }

      console.log('Conteúdo da mensagem:', messageContent);
      console.log('Tipo:', messageType);

      if (!messageContent) {
        console.log('Sem conteúdo de mensagem, ignorando');
        return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
      }

      // Extrair número do telefone
      const telefone = remoteJid.replace('@s.whatsapp.net', '').replace('@c.us', '');
      console.log('Telefone:', telefone);

      // Buscar conexão pela instância
      const { data: conexao, error: conexaoError } = await supabase
        .from('conexoes_whatsapp')
        .select('id, conta_id')
        .eq('instance_name', instance)
        .single();

      if (conexaoError || !conexao) {
        console.log('Conexão não encontrada para instância:', instance);
        return new Response(JSON.stringify({ error: 'Conexão não encontrada' }), { 
          status: 200,
          headers: corsHeaders 
        });
      }

      console.log('Conexão encontrada:', conexao.id, 'Conta:', conexao.conta_id);

      // Buscar ou criar contato
      let { data: contato } = await supabase
        .from('contatos')
        .select('id')
        .eq('conta_id', conexao.conta_id)
        .eq('telefone', telefone)
        .single();

      if (!contato) {
        console.log('Criando novo contato...');
        const { data: novoContato, error: contatoError } = await supabase
          .from('contatos')
          .insert({
            conta_id: conexao.conta_id,
            nome: pushName || telefone,
            telefone,
          })
          .select()
          .single();
          
        if (contatoError) {
          console.error('Erro ao criar contato:', contatoError);
          throw contatoError;
        }
        contato = novoContato;
        console.log('Contato criado:', contato?.id);
      }

      // Buscar conversa existente usando SQL direto para evitar cache do PostgREST
      console.log('Buscando conversa existente...');
      
      // Usar fetch direto para a API REST do Supabase com header para ignorar cache
      const conversaResponse = await fetch(
        `${supabaseUrl}/rest/v1/conversas?conta_id=eq.${conexao.conta_id}&contato_id=eq.${contato!.id}&arquivada=eq.false&select=id,agente_ia_ativo,nao_lidas`,
        {
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
            'Accept': 'application/vnd.pgrst.object+json',
            'Prefer': 'return=representation',
          },
        }
      );

      let conversa: { id: string; agente_ia_ativo: boolean; nao_lidas: number } | null = null;
      
      if (conversaResponse.ok) {
        const conversaData = await conversaResponse.json();
        if (conversaData && !conversaData.code) {
          conversa = conversaData;
          console.log('Conversa encontrada:', conversa?.id);
        }
      }

      if (!conversa) {
        console.log('Criando nova conversa com SQL direto...');
        
        // Buscar agente principal da conta
        const { data: agentePrincipal } = await supabase
          .from('agent_ia')
          .select('id')
          .eq('conta_id', conexao.conta_id)
          .eq('tipo', 'principal')
          .eq('ativo', true)
          .maybeSingle();
        
        console.log('Agente principal encontrado:', agentePrincipal?.id);
        
        // Inserir conversa usando SQL direto
        const insertResponse = await fetch(
          `${supabaseUrl}/rest/v1/conversas`,
          {
            method: 'POST',
            headers: {
              'apikey': supabaseKey,
              'Authorization': `Bearer ${supabaseKey}`,
              'Content-Type': 'application/json',
              'Prefer': 'return=representation',
            },
            body: JSON.stringify({
              conta_id: conexao.conta_id,
              contato_id: contato!.id,
              conexao_id: conexao.id,
              agente_ia_ativo: true,
              agente_ia_id: agentePrincipal?.id || null,
              status: 'em_atendimento',
            }),
          }
        );

        if (!insertResponse.ok) {
          const errorText = await insertResponse.text();
          console.error('Erro ao criar conversa:', errorText);
          throw new Error(`Erro ao criar conversa: ${errorText}`);
        }

        const novaConversa = await insertResponse.json();
        conversa = Array.isArray(novaConversa) ? novaConversa[0] : novaConversa;
        console.log('Conversa criada:', conversa?.id);
      }

      // Verificar se mensagem já existe (evitar duplicação com polling)
      if (messageId) {
        const { data: existingMsg } = await supabase
          .from('mensagens')
          .select('id')
          .eq('conversa_id', conversa!.id)
          .contains('metadata', { evolution_msg_id: messageId })
          .maybeSingle();
          
        if (existingMsg) {
          console.log('Mensagem já existe, ignorando:', messageId);
          return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
        }
      }

      // Inserir mensagem com evolution_msg_id nos metadados
      // Se fromMe = true (veio do dispositivo físico via webhook), marcar como enviada_por_dispositivo
      const { error: msgError } = await supabase.from('mensagens').insert({
        conversa_id: conversa!.id,
        contato_id: contato!.id,
        conteudo: messageContent,
        direcao: fromMe ? 'saida' : 'entrada',
        tipo: messageType,
        media_url: mediaUrl,
        enviada_por_dispositivo: fromMe,
        metadata: messageId ? { evolution_msg_id: messageId } : {},
      });

      if (msgError) {
        console.error('Erro ao inserir mensagem:', msgError);
        throw msgError;
      }

      console.log('Mensagem inserida com sucesso');

      // Atualizar conversa usando fetch direto
      const updateResponse = await fetch(
        `${supabaseUrl}/rest/v1/conversas?id=eq.${conversa!.id}`,
        {
          method: 'PATCH',
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            ultima_mensagem: messageContent,
            ultima_mensagem_at: new Date().toISOString(),
            nao_lidas: fromMe ? 0 : (conversa?.nao_lidas || 0) + 1,
            status: fromMe ? 'aguardando_cliente' : 'em_atendimento',
          }),
        }
      );

      if (!updateResponse.ok) {
        console.error('Erro ao atualizar conversa:', await updateResponse.text());
      }

      console.log('Conversa atualizada com sucesso');

      // Processar com IA se ativo e não for mensagem de saída
      if (conversa?.agente_ia_ativo && !fromMe) {
        console.log('=== PROCESSANDO COM IA ===');
        
        try {
          const aiResponse = await fetch(
            `${supabaseUrl}/functions/v1/ai-responder`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${supabaseKey}`,
              },
              body: JSON.stringify({
                conversa_id: conversa.id,
                mensagem: messageContent,
                conta_id: conexao.conta_id,
              }),
            }
          );

          if (aiResponse.ok) {
            const aiData = await aiResponse.json();
            console.log('Resposta IA:', aiData);

            if (aiData.should_respond && aiData.resposta) {
              // Buscar token da conexão para enviar mensagem
              const { data: conexaoCompleta } = await supabase
                .from('conexoes_whatsapp')
                .select('token, instance_name')
                .eq('id', conexao.id)
                .single();

              if (conexaoCompleta) {
                const evolutionApiUrl = 'https://evolution.cognityx.com.br';
                
                // Enviar mensagem via Evolution API
                const sendResponse = await fetch(
                  `${evolutionApiUrl}/message/sendText/${conexaoCompleta.instance_name}`,
                  {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      'apikey': conexaoCompleta.token,
                    },
                    body: JSON.stringify({
                      number: telefone,
                      text: aiData.resposta,
                    }),
                  }
                );

                if (sendResponse.ok) {
                  console.log('Mensagem IA enviada com sucesso');

                  // Salvar mensagem da IA no banco
                  await supabase.from('mensagens').insert({
                    conversa_id: conversa.id,
                    contato_id: contato!.id,
                    conteudo: aiData.resposta,
                    direcao: 'saida',
                    tipo: 'texto',
                    enviada_por_ia: true,
                  });

                  // Atualizar conversa
                  await fetch(
                    `${supabaseUrl}/rest/v1/conversas?id=eq.${conversa.id}`,
                    {
                      method: 'PATCH',
                      headers: {
                        'apikey': supabaseKey,
                        'Authorization': `Bearer ${supabaseKey}`,
                        'Content-Type': 'application/json',
                      },
                      body: JSON.stringify({
                        ultima_mensagem: aiData.resposta,
                        ultima_mensagem_at: new Date().toISOString(),
                        status: 'aguardando_cliente',
                      }),
                    }
                  );

                  console.log('Mensagem IA salva no banco');
                } else {
                  console.error('Erro ao enviar mensagem IA:', await sendResponse.text());
                }
              }
            }
          } else {
            console.error('Erro na resposta do ai-responder:', await aiResponse.text());
          }
        } catch (aiError) {
          console.error('Erro ao processar com IA:', aiError);
        }
      }

      console.log('=== FIM DO PROCESSAMENTO ===');
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    console.error('Erro no webhook:', errorMessage);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
