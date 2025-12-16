import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const META_API_URL = 'https://graph.facebook.com/v18.0';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { conexao_id, telefone, mensagem, tipo = 'texto', media_url, template_name, template_params } = await req.json();

    console.log('=== META API: ENVIANDO MENSAGEM ===');
    console.log('Conexão:', conexao_id);
    console.log('Telefone:', telefone);
    console.log('Tipo:', tipo);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Buscar conexão com credenciais Meta
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

    if (conexao.tipo_provedor !== 'meta') {
      console.error('Conexão não é do tipo Meta');
      return new Response(JSON.stringify({ error: 'Esta função é apenas para conexões Meta API' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!conexao.meta_phone_number_id || !conexao.meta_access_token) {
      console.error('Credenciais Meta não configuradas');
      return new Response(JSON.stringify({ error: 'Credenciais Meta API não configuradas' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Formatar número (Meta API espera formato com código do país sem +)
    const formattedNumber = telefone.replace(/\D/g, '');

    let body: Record<string, unknown>;

    // Montar body baseado no tipo de mensagem
    if (template_name) {
      // Mensagem de template (necessária para iniciar conversas)
      body = {
        messaging_product: 'whatsapp',
        to: formattedNumber,
        type: 'template',
        template: {
          name: template_name,
          language: { code: 'pt_BR' },
          components: template_params ? [
            {
              type: 'body',
              parameters: template_params.map((param: string) => ({
                type: 'text',
                text: param,
              })),
            },
          ] : [],
        },
      };
    } else {
      // Mensagem normal
      switch (tipo) {
        case 'imagem':
          body = {
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: formattedNumber,
            type: 'image',
            image: {
              link: media_url,
              caption: mensagem || undefined,
            },
          };
          break;
        case 'audio':
          body = {
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: formattedNumber,
            type: 'audio',
            audio: {
              link: media_url,
            },
          };
          break;
        case 'documento':
          body = {
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: formattedNumber,
            type: 'document',
            document: {
              link: media_url,
              filename: mensagem || 'documento',
            },
          };
          break;
        default:
          body = {
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: formattedNumber,
            type: 'text',
            text: {
              preview_url: false,
              body: mensagem,
            },
          };
      }
    }

    console.log('Enviando para Meta API:', JSON.stringify(body, null, 2));

    const response = await fetch(
      `${META_API_URL}/${conexao.meta_phone_number_id}/messages`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${conexao.meta_access_token}`,
        },
        body: JSON.stringify(body),
      }
    );

    const result = await response.json();
    console.log('Resposta Meta API:', JSON.stringify(result, null, 2));

    if (!response.ok) {
      console.error('Erro na Meta API:', result);

      // Logar erro no sistema
      await supabase.from('logs_atividade').insert({
        conta_id: conexao.conta_id,
        tipo: 'erro_whatsapp',
        descricao: `Erro ao enviar mensagem via Meta API para ${telefone}`,
        metadata: {
          erro: result,
          status_code: response.status,
          tipo_mensagem: tipo,
        },
      });

      return new Response(JSON.stringify({ error: 'Erro ao enviar mensagem', details: result }), {
        status: response.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const metaMsgId = result?.messages?.[0]?.id;

    return new Response(JSON.stringify({ success: true, result, meta_msg_id: metaMsgId }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    console.error('Erro ao enviar mensagem via Meta:', errorMessage);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
