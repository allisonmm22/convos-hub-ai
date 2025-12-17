import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, stripe-signature',
};

// Função para verificar assinatura do Stripe
async function verifyStripeSignature(
  payload: string,
  signature: string,
  webhookSecret: string
): Promise<boolean> {
  try {
    const encoder = new TextEncoder();
    
    // Extrair timestamp e assinaturas do header
    const elements = signature.split(',');
    let timestamp = '';
    const signatures: string[] = [];
    
    for (const element of elements) {
      const [key, value] = element.split('=');
      if (key === 't') timestamp = value;
      if (key === 'v1') signatures.push(value);
    }
    
    if (!timestamp || signatures.length === 0) {
      console.error('[stripe-webhook] Assinatura mal formatada');
      return false;
    }
    
    // Verificar se timestamp não é muito antigo (5 minutos)
    const timestampAge = Math.floor(Date.now() / 1000) - parseInt(timestamp);
    if (timestampAge > 300) {
      console.error('[stripe-webhook] Timestamp muito antigo:', timestampAge);
      return false;
    }
    
    // Calcular assinatura esperada
    const signedPayload = `${timestamp}.${payload}`;
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(webhookSecret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    
    const signatureBuffer = await crypto.subtle.sign(
      'HMAC',
      key,
      encoder.encode(signedPayload)
    );
    
    const expectedSignature = Array.from(new Uint8Array(signatureBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    
    // Verificar se alguma das assinaturas bate
    return signatures.some(sig => sig === expectedSignature);
  } catch (error) {
    console.error('[stripe-webhook] Erro ao verificar assinatura:', error);
    return false;
  }
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Buscar webhook secret da tabela de configurações
    const { data: configData, error: configError } = await supabase
      .from('configuracoes_plataforma')
      .select('valor')
      .eq('chave', 'stripe_webhook_secret')
      .single();

    if (configError || !configData?.valor) {
      console.error('[stripe-webhook] Webhook secret não configurado');
      return new Response(
        JSON.stringify({ error: 'Webhook secret não configurado' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    const webhookSecret = configData.valor;
    const signature = req.headers.get('stripe-signature');
    const payload = await req.text();

    if (!signature) {
      console.error('[stripe-webhook] Assinatura não fornecida');
      return new Response(
        JSON.stringify({ error: 'Assinatura não fornecida' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Verificar assinatura
    const isValid = await verifyStripeSignature(payload, signature, webhookSecret);
    if (!isValid) {
      console.error('[stripe-webhook] Assinatura inválida');
      return new Response(
        JSON.stringify({ error: 'Assinatura inválida' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    const event = JSON.parse(payload);
    console.log('[stripe-webhook] Evento recebido:', event.type);

    // Processar eventos
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        console.log('[stripe-webhook] Checkout completado:', session.id);
        
        // Extrair metadados
        const contaId = session.metadata?.conta_id;
        const planoId = session.metadata?.plano_id;
        
        if (contaId && planoId) {
          // Atualizar plano da conta
          const { error: updateError } = await supabase
            .from('contas')
            .update({ plano_id: planoId })
            .eq('id', contaId);
          
          if (updateError) {
            console.error('[stripe-webhook] Erro ao atualizar plano:', updateError);
          } else {
            console.log('[stripe-webhook] Plano atualizado:', contaId, '->', planoId);
            
            // Registrar log
            await supabase.from('logs_atividade').insert({
              conta_id: contaId,
              tipo: 'upgrade_plano',
              descricao: `Plano atualizado via Stripe`,
              metadata: { 
                session_id: session.id,
                plano_id: planoId,
                amount: session.amount_total,
                currency: session.currency
              }
            });
          }
        }
        break;
      }

      case 'invoice.paid': {
        const invoice = event.data.object;
        console.log('[stripe-webhook] Fatura paga:', invoice.id);
        
        // Registrar pagamento recorrente
        const customerId = invoice.customer;
        
        // Buscar conta pelo customer_id (se armazenado)
        // Por enquanto, apenas loga
        console.log('[stripe-webhook] Customer:', customerId, 'Amount:', invoice.amount_paid);
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object;
        console.log('[stripe-webhook] Assinatura atualizada:', subscription.id);
        
        // Verificar se assinatura foi cancelada ou pausada
        if (subscription.status === 'canceled' || subscription.status === 'unpaid') {
          console.log('[stripe-webhook] Assinatura cancelada/não paga');
          // Implementar lógica de downgrade se necessário
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        console.log('[stripe-webhook] Assinatura deletada:', subscription.id);
        
        // Implementar lógica de remoção de plano
        break;
      }

      default:
        console.log('[stripe-webhook] Evento não tratado:', event.type);
    }

    return new Response(
      JSON.stringify({ received: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[stripe-webhook] Erro:', error);
    return new Response(
      JSON.stringify({ error: 'Erro interno' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});