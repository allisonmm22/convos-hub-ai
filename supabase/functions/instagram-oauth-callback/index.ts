import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const error = url.searchParams.get('error');
  const errorDescription = url.searchParams.get('error_description');

  // HTML de erro com redirecionamento
  const errorHtml = (message: string, redirectUrl?: string) => `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Erro na conexão</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); }
        .container { text-align: center; background: white; padding: 40px; border-radius: 16px; box-shadow: 0 10px 40px rgba(0,0,0,0.2); max-width: 400px; }
        .icon { font-size: 64px; margin-bottom: 20px; }
        h1 { color: #dc2626; margin: 0 0 10px; font-size: 24px; }
        p { color: #6b7280; margin: 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="icon">❌</div>
        <h1>Erro na conexão</h1>
        <p>${message}</p>
        <p style="margin-top: 10px; font-size: 14px;">Redirecionando...</p>
        <script>
          setTimeout(() => {
            window.location.href = '${redirectUrl || '/conexao'}?instagram_oauth=error&message=${encodeURIComponent(message)}';
          }, 2000);
        </script>
      </div>
    </body>
    </html>
  `;

  // HTML de sucesso com redirecionamento
  const successHtml = (username: string, redirectUrl?: string) => `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Conta conectada</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: linear-gradient(135deg, #E1306C 0%, #F77737 50%, #FCAF45 100%); }
        .container { text-align: center; background: white; padding: 40px; border-radius: 16px; box-shadow: 0 10px 40px rgba(0,0,0,0.2); max-width: 400px; }
        .icon { font-size: 64px; margin-bottom: 20px; }
        h1 { color: #059669; margin: 0 0 10px; font-size: 24px; }
        p { color: #6b7280; margin: 0; }
        .username { color: #E1306C; font-weight: 600; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="icon">✅</div>
        <h1>Conta conectada com sucesso!</h1>
        <p>Instagram: <span class="username">@${username}</span></p>
        <p style="margin-top: 10px; font-size: 14px;">Redirecionando...</p>
        <script>
          setTimeout(() => {
            window.location.href = '${redirectUrl || '/conexao'}?instagram_oauth=success';
          }, 1500);
        </script>
      </div>
    </body>
    </html>
  `;

  // Tentar decodificar state para pegar redirect_url mesmo em caso de erro
  let redirectUrl: string | undefined;
  if (state) {
    try {
      const stateData = JSON.parse(atob(state));
      redirectUrl = stateData.redirect_url;
    } catch {
      // Ignorar erro de decodificação
    }
  }

  // Verificar erro do OAuth
  if (error) {
    console.error('[instagram-oauth-callback] Erro do OAuth:', error, errorDescription);
    return new Response(errorHtml(errorDescription || error, redirectUrl), {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }

  // Verificar parâmetros obrigatórios
  if (!code || !state) {
    console.error('[instagram-oauth-callback] Parâmetros faltando:', { code: !!code, state: !!state });
    return new Response(errorHtml('Parâmetros de autorização inválidos', redirectUrl), {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }

  try {
    // Decodificar state
    let stateData: { conta_id: string; redirect_url?: string };
    try {
      stateData = JSON.parse(atob(state));
    } catch {
      return new Response(errorHtml('State inválido', redirectUrl), {
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });
    }

    const { conta_id, redirect_url } = stateData;
    redirectUrl = redirect_url; // Atualizar com valor do state
    console.log('[instagram-oauth-callback] Processando para conta:', conta_id, 'redirect:', redirect_url);

    // Obter credenciais
    const META_APP_ID = Deno.env.get('META_APP_ID');
    const META_APP_SECRET = Deno.env.get('META_APP_SECRET');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!META_APP_ID || !META_APP_SECRET || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      console.error('[instagram-oauth-callback] Credenciais não configuradas');
      return new Response(errorHtml('Configuração do servidor incompleta', redirectUrl), {
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });
    }

    const callbackUrl = `${SUPABASE_URL}/functions/v1/instagram-oauth-callback`;

    // 1. Trocar code por access_token
    console.log('[instagram-oauth-callback] Trocando code por access_token...');
    const tokenResponse = await fetch('https://graph.facebook.com/v21.0/oauth/access_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: META_APP_ID,
        client_secret: META_APP_SECRET,
        redirect_uri: callbackUrl,
        code: code,
      }),
    });

    const tokenData = await tokenResponse.json();
    console.log('[instagram-oauth-callback] Token response:', JSON.stringify(tokenData));

    if (tokenData.error) {
      console.error('[instagram-oauth-callback] Erro ao obter token:', tokenData.error);
      return new Response(errorHtml(tokenData.error.message || 'Erro ao obter token de acesso', redirectUrl), {
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });
    }

    const shortLivedToken = tokenData.access_token;

    // 2. Trocar por long-lived token
    console.log('[instagram-oauth-callback] Obtendo long-lived token...');
    const longLivedResponse = await fetch(
      `https://graph.facebook.com/v21.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${META_APP_ID}&client_secret=${META_APP_SECRET}&fb_exchange_token=${shortLivedToken}`
    );
    const longLivedData = await longLivedResponse.json();
    console.log('[instagram-oauth-callback] Long-lived token response:', JSON.stringify(longLivedData));

    const accessToken = longLivedData.access_token || shortLivedToken;

    // 3. Buscar páginas do usuário
    console.log('[instagram-oauth-callback] Buscando páginas...');
    const pagesResponse = await fetch(
      `https://graph.facebook.com/v21.0/me/accounts?access_token=${accessToken}`
    );
    const pagesData = await pagesResponse.json();
    console.log('[instagram-oauth-callback] Páginas:', JSON.stringify(pagesData));

    if (!pagesData.data || pagesData.data.length === 0) {
      return new Response(errorHtml('Nenhuma página do Facebook encontrada. Certifique-se de ter uma página conectada ao Instagram Business.', redirectUrl), {
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });
    }

    // 4. Para cada página, buscar conta do Instagram Business conectada
    let instagramAccount = null;
    let pageAccessToken = null;
    let pageName = '';

    for (const page of pagesData.data) {
      console.log('[instagram-oauth-callback] Verificando página:', page.name);
      const igResponse = await fetch(
        `https://graph.facebook.com/v21.0/${page.id}?fields=instagram_business_account&access_token=${page.access_token}`
      );
      const igData = await igResponse.json();
      console.log('[instagram-oauth-callback] Instagram account para página:', JSON.stringify(igData));

      if (igData.instagram_business_account) {
        instagramAccount = igData.instagram_business_account.id;
        pageAccessToken = page.access_token;
        pageName = page.name;
        break;
      }
    }

    if (!instagramAccount) {
      return new Response(errorHtml('Nenhuma conta do Instagram Business encontrada. Certifique-se de ter uma conta comercial do Instagram conectada a uma página do Facebook.', redirectUrl), {
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });
    }

    // 5. Buscar informações do Instagram
    console.log('[instagram-oauth-callback] Buscando info do Instagram:', instagramAccount);
    const igInfoResponse = await fetch(
      `https://graph.facebook.com/v21.0/${instagramAccount}?fields=id,username,name,profile_picture_url&access_token=${pageAccessToken}`
    );
    const igInfo = await igInfoResponse.json();
    console.log('[instagram-oauth-callback] Instagram info:', JSON.stringify(igInfo));

    const instagramUsername = igInfo.username || 'instagram';

    // 6. Criar conexão no banco de dados
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const instanceKey = `ig_${conta_id.slice(0, 8)}_${Date.now().toString(36)}`;
    const verifyToken = `verify_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;

    const { data: conexao, error: insertError } = await supabase
      .from('conexoes_whatsapp')
      .insert({
        nome: `Instagram @${instagramUsername}`,
        instance_name: instanceKey,
        token: 'instagram-oauth',
        conta_id: conta_id,
        tipo_provedor: 'instagram',
        tipo_canal: 'instagram',
        status: 'desconectado', // Será 'conectado' após configurar webhook
        meta_phone_number_id: instagramAccount, // Usamos este campo para guardar o Instagram Business Account ID
        meta_access_token: pageAccessToken,
        meta_webhook_verify_token: verifyToken,
        numero: `@${instagramUsername}`,
      })
      .select()
      .single();

    if (insertError) {
      console.error('[instagram-oauth-callback] Erro ao inserir conexão:', insertError);
      return new Response(errorHtml('Erro ao salvar conexão: ' + insertError.message, redirectUrl), {
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });
    }

    console.log('[instagram-oauth-callback] Conexão criada:', conexao.id);

    return new Response(successHtml(instagramUsername, redirectUrl), {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });

  } catch (error: unknown) {
    console.error('[instagram-oauth-callback] Erro:', error);
    const message = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(errorHtml(message, redirectUrl), {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }
});
