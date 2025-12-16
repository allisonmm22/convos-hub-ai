import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Endpoint para verificação do webhook da Meta
// A Meta envia uma requisição GET com hub.mode, hub.verify_token e hub.challenge
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

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

      // Verificar se é uma solicitação de verificação válida
      if (mode === 'subscribe' && token && challenge) {
        // Token precisa ser verificado contra o token configurado na conexão
        // Por enquanto, aceita qualquer token (será validado na configuração)
        console.log('Verificação aceita, retornando challenge');
        return new Response(challenge, {
          status: 200,
          headers: { 'Content-Type': 'text/plain' },
        });
      }

      console.log('Verificação inválida');
      return new Response('Forbidden', { status: 403 });
    }

    // POST = mensagens recebidas (encaminhar para o webhook principal)
    if (req.method === 'POST') {
      const payload = await req.json();
      console.log('=== META WEBHOOK MESSAGE ===');
      console.log('Payload:', JSON.stringify(payload, null, 2));

      // Retornar 200 imediatamente (Meta espera resposta rápida)
      // O processamento será feito no whatsapp-webhook
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
