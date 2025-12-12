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
    const { conexao_id, telefone, mensagem, tipo = 'texto', media_url } = await req.json();

    console.log('Enviando mensagem:', { conexao_id, telefone, tipo });

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Buscar conexão
    const { data: conexao, error } = await supabase
      .from('conexoes_whatsapp')
      .select('*')
      .eq('id', conexao_id)
      .single();

    if (error || !conexao) {
      console.error('Conexão não encontrada:', conexao_id);
      return new Response(JSON.stringify({ error: 'Conexão não encontrada' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const evolutionApiKey = Deno.env.get('EVOLUTION_API_KEY');
    if (!evolutionApiKey) {
      console.error('EVOLUTION_API_KEY não configurada');
      return new Response(JSON.stringify({ error: 'API Key não configurada' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Formatar número (remover caracteres especiais e adicionar @s.whatsapp.net)
    const formattedNumber = telefone.replace(/\D/g, '');

    let evolutionUrl: string;
    let body: Record<string, unknown>;

    // Determinar endpoint e body baseado no tipo
    switch (tipo) {
      case 'imagem':
        evolutionUrl = `${EVOLUTION_API_URL}/message/sendMedia/${conexao.instance_name}`;
        body = {
          number: formattedNumber,
          mediatype: 'image',
          media: media_url,
          caption: mensagem || '',
        };
        break;
      case 'audio':
        evolutionUrl = `${EVOLUTION_API_URL}/message/sendWhatsAppAudio/${conexao.instance_name}`;
        body = {
          number: formattedNumber,
          audio: media_url,
        };
        break;
      case 'documento':
        evolutionUrl = `${EVOLUTION_API_URL}/message/sendMedia/${conexao.instance_name}`;
        body = {
          number: formattedNumber,
          mediatype: 'document',
          media: media_url,
          fileName: mensagem || 'documento',
        };
        break;
      default:
        evolutionUrl = `${EVOLUTION_API_URL}/message/sendText/${conexao.instance_name}`;
        body = {
          number: formattedNumber,
          text: mensagem,
        };
    }

    console.log('Chamando Evolution API:', { evolutionUrl, body });
    
    const response = await fetch(evolutionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': evolutionApiKey,
      },
      body: JSON.stringify(body),
    });

    const result = await response.json();
    console.log('Resposta Evolution:', result);

    if (!response.ok) {
      console.error('Erro na Evolution API:', result);
      return new Response(JSON.stringify({ error: 'Erro ao enviar mensagem', details: result }), {
        status: response.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: true, result }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    console.error('Erro ao enviar mensagem:', errorMessage);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
