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
    const { mensagem_id } = await req.json();

    if (!mensagem_id) {
      return new Response(
        JSON.stringify({ error: 'mensagem_id é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. Buscar a mensagem
    const { data: mensagem, error: mensagemError } = await supabase
      .from('mensagens')
      .select('*')
      .eq('id', mensagem_id)
      .single();

    if (mensagemError || !mensagem) {
      console.error('Erro ao buscar mensagem:', mensagemError);
      return new Response(
        JSON.stringify({ error: 'Mensagem não encontrada' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Verificar se é mensagem de saída
    if (mensagem.direcao !== 'saida') {
      return new Response(
        JSON.stringify({ error: 'Apenas mensagens enviadas podem ser deletadas' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 3. Buscar conversa
    const { data: conversa, error: conversaError } = await supabase
      .from('conversas')
      .select('*, contatos(*)')
      .eq('id', mensagem.conversa_id)
      .single();

    if (conversaError || !conversa) {
      console.error('Erro ao buscar conversa:', conversaError);
      return new Response(
        JSON.stringify({ error: 'Conversa não encontrada' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 4. Buscar conexão
    const { data: conexao, error: conexaoError } = await supabase
      .from('conexoes_whatsapp')
      .select('*')
      .eq('id', conversa.conexao_id)
      .single();

    if (conexaoError || !conexao) {
      console.log('Sem conexão WhatsApp, deletando apenas do banco');
      // Deletar apenas do banco
      const { error: deleteError } = await supabase
        .from('mensagens')
        .delete()
        .eq('id', mensagem_id);

      if (deleteError) {
        console.error('Erro ao deletar mensagem do banco:', deleteError);
        return new Response(
          JSON.stringify({ error: 'Erro ao deletar mensagem' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, whatsapp_deleted: false, message: 'Mensagem deletada apenas do CRM' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 5. Verificar se tem evolution_msg_id
    const evolutionMsgId = mensagem.metadata?.evolution_msg_id;
    let whatsappDeleted = false;

    if (evolutionMsgId && conexao.status === 'conectado') {
      // Montar o remoteJid
      const contato = conversa.contatos;
      const remoteJid = contato.grupo_jid || `${contato.telefone}@s.whatsapp.net`;

      console.log('Deletando mensagem do WhatsApp:', {
        instance: conexao.instance_name,
        evolution_msg_id: evolutionMsgId,
        remoteJid,
      });

      try {
        const evolutionApiKey = Deno.env.get('EVOLUTION_API_KEY');
        
        const response = await fetch(
          `${EVOLUTION_API_URL}/chat/deleteMessageForEveryone/${conexao.instance_name}`,
          {
            method: 'DELETE',
            headers: {
              'apikey': evolutionApiKey!,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              id: evolutionMsgId,
              remoteJid: remoteJid,
              fromMe: true,
            }),
          }
        );

        if (response.ok) {
          whatsappDeleted = true;
          console.log('Mensagem deletada do WhatsApp com sucesso');
        } else {
          const errorText = await response.text();
          console.error('Erro ao deletar do WhatsApp:', response.status, errorText);
        }
      } catch (whatsappError) {
        console.error('Erro na chamada Evolution API:', whatsappError);
      }
    } else {
      console.log('Mensagem sem evolution_msg_id ou conexão offline, deletando apenas do banco');
    }

    // 6. Deletar do banco
    const { error: deleteError } = await supabase
      .from('mensagens')
      .delete()
      .eq('id', mensagem_id);

    if (deleteError) {
      console.error('Erro ao deletar mensagem do banco:', deleteError);
      return new Response(
        JSON.stringify({ error: 'Erro ao deletar mensagem do banco' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Mensagem deletada com sucesso:', {
      mensagem_id,
      whatsapp_deleted: whatsappDeleted,
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        whatsapp_deleted: whatsappDeleted,
        message: whatsappDeleted 
          ? 'Mensagem deletada do WhatsApp e CRM' 
          : 'Mensagem deletada apenas do CRM'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Erro ao deletar mensagem:', error);
    return new Response(
      JSON.stringify({ error: 'Erro interno do servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
