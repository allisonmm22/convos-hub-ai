import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, password, nome, whatsapp, cpf, planoId } = await req.json();

    // Validar campos obrigatórios
    if (!email || !password || !nome) {
      return new Response(
        JSON.stringify({ error: 'Email, senha e nome são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Usar banco externo com service_role_key para bypass de RLS
    const externalUrl = Deno.env.get('EXTERNAL_SUPABASE_URL');
    const externalServiceKey = Deno.env.get('EXTERNAL_SUPABASE_SERVICE_ROLE_KEY');

    if (!externalUrl || !externalServiceKey) {
      console.error('Variáveis de ambiente do banco externo não configuradas');
      return new Response(
        JSON.stringify({ error: 'Configuração de banco externo não encontrada' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Criar cliente com service_role_key (bypassa RLS)
    const supabaseAdmin = createClient(externalUrl, externalServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    console.log('Criando usuário no auth.users...');

    // 1. Criar usuário no auth.users
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true // Auto-confirma o email
    });

    if (authError) {
      console.error('Erro ao criar usuário no auth:', authError);
      return new Response(
        JSON.stringify({ error: `Erro ao criar usuário: ${authError.message}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = authData.user.id;
    console.log('Usuário criado no auth:', userId);

    // 2. Criar conta
    console.log('Criando conta...');
    const { data: contaData, error: contaError } = await supabaseAdmin
      .from('contas')
      .insert({
        nome: `Conta de ${nome}`,
        whatsapp: whatsapp || null,
        cpf: cpf || null,
        plano_id: planoId || null,
        ativo: true
      })
      .select()
      .single();

    if (contaError) {
      console.error('Erro ao criar conta:', contaError);
      // Rollback: deletar usuário do auth
      await supabaseAdmin.auth.admin.deleteUser(userId);
      return new Response(
        JSON.stringify({ error: `Erro ao criar conta: ${contaError.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const contaId = contaData.id;
    console.log('Conta criada:', contaId);

    // 3. Criar registro em usuarios
    console.log('Criando registro de usuário...');
    const { error: usuarioError } = await supabaseAdmin
      .from('usuarios')
      .insert({
        user_id: userId,
        conta_id: contaId,
        nome,
        email,
        is_admin: true,
        assinatura_ativa: true
      });

    if (usuarioError) {
      console.error('Erro ao criar usuario:', usuarioError);
      // Rollback
      await supabaseAdmin.from('contas').delete().eq('id', contaId);
      await supabaseAdmin.auth.admin.deleteUser(userId);
      return new Response(
        JSON.stringify({ error: `Erro ao criar usuário: ${usuarioError.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Registro de usuário criado');

    // 4. Criar role de admin
    console.log('Criando role de admin...');
    const { error: roleError } = await supabaseAdmin
      .from('user_roles')
      .insert({
        user_id: userId,
        role: 'admin'
      });

    if (roleError) {
      console.error('Erro ao criar role:', roleError);
      // Não fazer rollback completo, apenas logar o erro
    } else {
      console.log('Role de admin criada');
    }

    // 5. Criar configuração padrão do Agente IA
    console.log('Criando agent_ia padrão...');
    await supabaseAdmin.from('agent_ia').insert({ 
      conta_id: contaId,
      nome: 'Agente Padrão',
      ativo: false
    });

    // 6. Criar funil padrão com estágios
    console.log('Criando funil padrão...');
    const { data: funilData } = await supabaseAdmin
      .from('funis')
      .insert({ 
        conta_id: contaId, 
        nome: 'Vendas', 
        ordem: 0 
      })
      .select()
      .single();

    if (funilData) {
      console.log('Criando estágios do funil...');
      await supabaseAdmin.from('estagios').insert([
        { funil_id: funilData.id, nome: 'Novo Lead', ordem: 0, cor: '#3b82f6' },
        { funil_id: funilData.id, nome: 'Em Contato', ordem: 1, cor: '#f59e0b' },
        { funil_id: funilData.id, nome: 'Proposta Enviada', ordem: 2, cor: '#8b5cf6' },
        { funil_id: funilData.id, nome: 'Negociação', ordem: 3, cor: '#ec4899' },
        { funil_id: funilData.id, nome: 'Fechado', ordem: 4, cor: '#10b981' },
      ]);
    }

    console.log('Cadastro completo! Gerando sessão...');

    // 7. Gerar token de sessão para login automático
    // Não é possível gerar sessão diretamente via admin API,
    // então retornamos sucesso e o frontend fará o login
    return new Response(
      JSON.stringify({ 
        success: true, 
        userId,
        contaId,
        message: 'Usuário criado com sucesso'
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Erro inesperado:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(
      JSON.stringify({ error: `Erro interno: ${errorMessage}` }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
