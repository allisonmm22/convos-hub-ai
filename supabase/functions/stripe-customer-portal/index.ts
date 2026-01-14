import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Usar banco de dados EXTERNO como principal
    const supabaseUrl = Deno.env.get('EXTERNAL_SUPABASE_URL') || Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('EXTERNAL_SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    console.log('📦 Usando banco:', supabaseUrl.substring(0, 30) + '...');

    // Verificar autenticação
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Não autorizado' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    // Buscar usuário autenticado
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Usuário não autenticado' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    // Buscar conta do usuário com stripe_customer_id
    const { data: usuario, error: usuarioError } = await supabase
      .from('usuarios')
      .select('conta_id')
      .eq('user_id', user.id)
      .single();

    if (usuarioError || !usuario) {
      return new Response(
        JSON.stringify({ error: 'Usuário não encontrado' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      );
    }

    const { data: conta, error: contaError } = await supabase
      .from('contas')
      .select('stripe_customer_id')
      .eq('id', usuario.conta_id)
      .single();

    if (contaError || !conta?.stripe_customer_id) {
      return new Response(
        JSON.stringify({ error: 'Nenhuma assinatura ativa encontrada' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Buscar Stripe secret key das configurações
    const { data: configData } = await supabase
      .from('configuracoes_plataforma')
      .select('valor')
      .eq('chave', 'stripe_secret_key')
      .single();

    if (!configData?.valor) {
      return new Response(
        JSON.stringify({ error: 'Stripe não configurado' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    const stripeSecretKey = configData.valor;

    // Parsear body para obter return_url
    const { return_url } = await req.json();

    // Criar sessão do Customer Portal
    const portalResponse = await fetch('https://api.stripe.com/v1/billing_portal/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${stripeSecretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        customer: conta.stripe_customer_id,
        return_url: return_url || `${req.headers.get('origin')}/minha-assinatura`,
      }),
    });

    if (!portalResponse.ok) {
      const errorText = await portalResponse.text();
      console.error('[stripe-customer-portal] Erro ao criar sessão:', errorText);
      return new Response(
        JSON.stringify({ error: 'Erro ao criar sessão do portal' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    const portalSession = await portalResponse.json();

    return new Response(
      JSON.stringify({ url: portalSession.url }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[stripe-customer-portal] Erro:', error);
    return new Response(
      JSON.stringify({ error: 'Erro interno' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
