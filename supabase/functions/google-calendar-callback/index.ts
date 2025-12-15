import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  try {
    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const error = url.searchParams.get('error');

    console.log('[google-calendar-callback] Callback recebido');

    if (error) {
      console.error('[google-calendar-callback] Erro do Google:', error);
      return new Response(
        `<html><body><script>window.opener?.postMessage({type:'google-calendar-error',error:'${error}'},'*');window.close();</script>Erro: ${error}</body></html>`,
        { headers: { 'Content-Type': 'text/html' } }
      );
    }

    if (!code || !state) {
      console.error('[google-calendar-callback] Parâmetros ausentes');
      return new Response(
        '<html><body><script>window.opener?.postMessage({type:"google-calendar-error",error:"Parâmetros inválidos"},"*");window.close();</script>Parâmetros inválidos</body></html>',
        { headers: { 'Content-Type': 'text/html' } }
      );
    }

    // Decodificar state
    let stateData;
    try {
      stateData = JSON.parse(atob(state));
    } catch (e) {
      console.error('[google-calendar-callback] State inválido');
      return new Response(
        '<html><body><script>window.opener?.postMessage({type:"google-calendar-error",error:"State inválido"},"*");window.close();</script>State inválido</body></html>',
        { headers: { 'Content-Type': 'text/html' } }
      );
    }

    const { conta_id, redirect_url } = stateData;
    console.log('[google-calendar-callback] conta_id:', conta_id);

    const GOOGLE_CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID');
    const GOOGLE_CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !SUPABASE_SERVICE_ROLE_KEY) {
      console.error('[google-calendar-callback] Configuração ausente');
      return new Response(
        '<html><body><script>window.opener?.postMessage({type:"google-calendar-error",error:"Configuração do servidor incompleta"},"*");window.close();</script>Configuração incompleta</body></html>',
        { headers: { 'Content-Type': 'text/html' } }
      );
    }

    const callbackUrl = `${SUPABASE_URL}/functions/v1/google-calendar-callback`;

    // Trocar code por tokens
    console.log('[google-calendar-callback] Trocando code por tokens...');
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: callbackUrl,
        grant_type: 'authorization_code',
      }),
    });

    const tokenData = await tokenResponse.json();

    if (tokenData.error) {
      console.error('[google-calendar-callback] Erro ao obter tokens:', tokenData);
      return new Response(
        `<html><body><script>window.opener?.postMessage({type:"google-calendar-error",error:"${tokenData.error_description || tokenData.error}"},"*");window.close();</script>Erro: ${tokenData.error}</body></html>`,
        { headers: { 'Content-Type': 'text/html' } }
      );
    }

    const { access_token, refresh_token, expires_in } = tokenData;
    console.log('[google-calendar-callback] Tokens obtidos com sucesso');

    // Buscar informações do usuário Google
    const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${access_token}` },
    });
    const userInfo = await userInfoResponse.json();
    console.log('[google-calendar-callback] Email Google:', userInfo.email);

    // Calcular data de expiração do token
    const token_expiry = new Date(Date.now() + expires_in * 1000).toISOString();

    // Salvar no banco de dados
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    // Verificar se já existe calendário com mesmo email para esta conta
    const { data: existingCalendar } = await supabase
      .from('calendarios_google')
      .select('id')
      .eq('conta_id', conta_id)
      .eq('email_google', userInfo.email)
      .single();

    if (existingCalendar) {
      // Atualizar tokens existentes
      const { error: updateError } = await supabase
        .from('calendarios_google')
        .update({
          access_token,
          refresh_token: refresh_token || undefined,
          token_expiry,
          ativo: true,
        })
        .eq('id', existingCalendar.id);

      if (updateError) {
        console.error('[google-calendar-callback] Erro ao atualizar:', updateError);
        return new Response(
          `<html><body><script>window.opener?.postMessage({type:"google-calendar-error",error:"Erro ao salvar: ${updateError.message}"},"*");window.close();</script>Erro</body></html>`,
          { headers: { 'Content-Type': 'text/html' } }
        );
      }
      console.log('[google-calendar-callback] Calendário atualizado');
    } else {
      // Criar novo calendário
      const { error: insertError } = await supabase
        .from('calendarios_google')
        .insert({
          conta_id,
          nome: userInfo.name || userInfo.email.split('@')[0],
          email_google: userInfo.email,
          access_token,
          refresh_token,
          token_expiry,
          calendar_id: 'primary',
        });

      if (insertError) {
        console.error('[google-calendar-callback] Erro ao inserir:', insertError);
        return new Response(
          `<html><body><script>window.opener?.postMessage({type:"google-calendar-error",error:"Erro ao salvar: ${insertError.message}"},"*");window.close();</script>Erro</body></html>`,
          { headers: { 'Content-Type': 'text/html' } }
        );
      }
      console.log('[google-calendar-callback] Novo calendário criado');
    }

    // Sucesso - fechar popup e notificar janela pai
    const successHtml = `
      <html>
        <body>
          <script>
            window.opener?.postMessage({type:'google-calendar-success'},'*');
            setTimeout(() => window.close(), 500);
          </script>
          <p>Conectado com sucesso! Esta janela fechará automaticamente...</p>
        </body>
      </html>
    `;

    return new Response(successHtml, { headers: { 'Content-Type': 'text/html' } });

  } catch (error: unknown) {
    console.error('[google-calendar-callback] Erro:', error);
    const message = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(
      `<html><body><script>window.opener?.postMessage({type:"google-calendar-error",error:"${message}"},"*");window.close();</script>Erro: ${message}</body></html>`,
      { headers: { 'Content-Type': 'text/html' } }
    );
  }
});
