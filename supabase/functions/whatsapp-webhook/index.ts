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

    const payload = await req.json();
    console.log('Webhook recebido:', JSON.stringify(payload));

    // Evolution API envia diferentes tipos de eventos
    const event = payload.event;
    const instance = payload.instance;
    const data = payload.data;

    // Tratar evento de atualização de conexão
    if (event === 'connection.update') {
      console.log('Evento de conexão recebido:', JSON.stringify(data));
      
      const state = data?.state;
      let status: 'conectado' | 'desconectado' | 'aguardando' = 'desconectado';
      
      if (state === 'open') {
        status = 'conectado';
      } else if (state === 'connecting') {
        status = 'aguardando';
      } else if (state === 'close') {
        status = 'desconectado';
      }

      // Atualizar status da conexão
      const { error: updateError } = await supabase
        .from('conexoes_whatsapp')
        .update({ 
          status,
          numero: data?.instance?.owner?.split('@')[0] || null,
        })
        .eq('instance_name', instance);

      if (updateError) {
        console.error('Erro ao atualizar status:', updateError);
      } else {
        console.log('Status atualizado para:', status);
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Tratar evento de atualização do QR Code
    if (event === 'qrcode.updated') {
      console.log('QR Code atualizado para instância:', instance);
      
      const qrcode = data?.qrcode?.base64;
      
      if (qrcode) {
        await supabase
          .from('conexoes_whatsapp')
          .update({ 
            qrcode,
            status: 'aguardando',
          })
          .eq('instance_name', instance);
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Tratar mensagens recebidas
    if (event === 'messages.upsert' && data?.message) {
      const message = data.message;
      const remoteJid = data.key?.remoteJid;
      const fromMe = data.key?.fromMe;
      const messageContent = message.conversation || message.extendedTextMessage?.text || '';

      if (!remoteJid || !messageContent) {
        return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
      }

      // Extrair número do telefone
      const telefone = remoteJid.replace('@s.whatsapp.net', '').replace('@g.us', '');

      // Buscar conexão pela instância
      const { data: conexao } = await supabase
        .from('conexoes_whatsapp')
        .select('id, conta_id')
        .eq('instance_name', instance)
        .single();

      if (!conexao) {
        console.log('Conexão não encontrada para instância:', instance);
        return new Response(JSON.stringify({ error: 'Conexão não encontrada' }), { headers: corsHeaders });
      }

      // Buscar ou criar contato
      let { data: contato } = await supabase
        .from('contatos')
        .select('id')
        .eq('conta_id', conexao.conta_id)
        .eq('telefone', telefone)
        .single();

      if (!contato) {
        const { data: novoContato } = await supabase
          .from('contatos')
          .insert({
            conta_id: conexao.conta_id,
            nome: data.pushName || telefone,
            telefone,
          })
          .select()
          .single();
        contato = novoContato;
      }

      // Buscar ou criar conversa
      let { data: conversa } = await supabase
        .from('conversas')
        .select('id, agente_ia_ativo, nao_lidas')
        .eq('conta_id', conexao.conta_id)
        .eq('contato_id', contato!.id)
        .single();

      if (!conversa) {
        const { data: novaConversa } = await supabase
          .from('conversas')
          .insert({
            conta_id: conexao.conta_id,
            contato_id: contato!.id,
            conexao_id: conexao.id,
            agente_ia_ativo: true,
          })
          .select('id, agente_ia_ativo, nao_lidas')
          .single();
        conversa = novaConversa;
      }

      // Inserir mensagem
      await supabase.from('mensagens').insert({
        conversa_id: conversa!.id,
        contato_id: contato!.id,
        conteudo: messageContent,
        direcao: fromMe ? 'saida' : 'entrada',
        tipo: 'texto',
      });

      // Atualizar conversa
      await supabase
        .from('conversas')
        .update({
          ultima_mensagem: messageContent,
          ultima_mensagem_at: new Date().toISOString(),
          nao_lidas: fromMe ? 0 : (conversa?.nao_lidas || 0) + 1,
        })
        .eq('id', conversa!.id);

      console.log('Mensagem processada com sucesso');
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    console.error('Erro no webhook:', errorMessage);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
