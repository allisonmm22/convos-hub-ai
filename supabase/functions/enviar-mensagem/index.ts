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
    const { conexao_id, telefone, mensagem, tipo = 'texto', media_url, media_base64 } = await req.json();

    console.log('Enviando mensagem:', { conexao_id, telefone, tipo, hasBase64: !!media_base64 });

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

    // Formatar número (remover caracteres especiais)
    const formattedNumber = telefone.replace(/\D/g, '');

    let evolutionUrl: string;
    let body: Record<string, unknown>;

    // Se tem base64, fazer upload para o storage primeiro (exceto para áudio que vai direto)
    let finalMediaUrl = media_url;
    
    if (media_base64 && tipo !== 'audio') {
      // Fazer upload do base64 para o storage
      const extension = tipo === 'imagem' ? 'jpg' : tipo === 'documento' ? 'pdf' : 'bin';
      const mimeType = tipo === 'imagem' ? 'image/jpeg' : tipo === 'documento' ? 'application/pdf' : 'application/octet-stream';
      const fileName = `${Date.now()}-upload.${extension}`;
      
      // Converter base64 para Uint8Array
      const binaryString = atob(media_base64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      
      const { error: uploadError } = await supabase.storage
        .from('whatsapp-media')
        .upload(fileName, bytes, { contentType: mimeType });
      
      if (uploadError) {
        console.error('Erro ao fazer upload:', uploadError);
      } else {
        const { data: urlData } = supabase.storage
          .from('whatsapp-media')
          .getPublicUrl(fileName);
        finalMediaUrl = urlData.publicUrl;
        console.log('Upload realizado:', finalMediaUrl);
      }
    }

    // Determinar endpoint e body baseado no tipo
    switch (tipo) {
      case 'imagem':
        evolutionUrl = `${EVOLUTION_API_URL}/message/sendMedia/${conexao.instance_name}`;
        body = {
          number: formattedNumber,
          mediatype: 'image',
          media: finalMediaUrl,
          caption: mensagem || '',
        };
        break;
      case 'audio':
        evolutionUrl = `${EVOLUTION_API_URL}/message/sendWhatsAppAudio/${conexao.instance_name}`;
        // Para áudio, a Evolution API aceita base64 diretamente
        body = {
          number: formattedNumber,
          audio: media_base64 ? `data:audio/webm;base64,${media_base64}` : finalMediaUrl,
        };
        break;
      case 'documento':
        evolutionUrl = `${EVOLUTION_API_URL}/message/sendMedia/${conexao.instance_name}`;
        body = {
          number: formattedNumber,
          mediatype: 'document',
          media: finalMediaUrl,
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
