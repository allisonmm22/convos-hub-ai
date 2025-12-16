import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const META_APP_ID = Deno.env.get('META_APP_ID');
    
    if (!META_APP_ID) {
      console.error('[instagram-oauth-auth] META_APP_ID não configurado');
      return new Response(
        JSON.stringify({ error: 'META_APP_ID não configurado' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { conta_id, redirect_url } = await req.json();

    if (!conta_id) {
      return new Response(
        JSON.stringify({ error: 'conta_id é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[instagram-oauth-auth] Iniciando OAuth para conta:', conta_id);

    // Escopos necessários para Instagram Business API
    const scopes = [
      'instagram_business_basic',
      'instagram_business_manage_messages',
      'instagram_business_manage_comments',
      'pages_show_list',
      'pages_read_engagement'
    ].join(',');

    // URL de callback - precisa ser a URL da Edge Function
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const callbackUrl = `${SUPABASE_URL}/functions/v1/instagram-oauth-callback`;

    // State contém conta_id e redirect_url codificados
    const state = btoa(JSON.stringify({ conta_id, redirect_url: redirect_url || '' }));

    // Construir URL de autorização do Facebook (Instagram usa Facebook OAuth)
    const authUrl = new URL('https://www.facebook.com/v21.0/dialog/oauth');
    authUrl.searchParams.set('client_id', META_APP_ID);
    authUrl.searchParams.set('redirect_uri', callbackUrl);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('scope', scopes);
    authUrl.searchParams.set('state', state);

    console.log('[instagram-oauth-auth] URL de autorização gerada');

    return new Response(
      JSON.stringify({ auth_url: authUrl.toString() }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('[instagram-oauth-auth] Erro:', error);
    const message = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
