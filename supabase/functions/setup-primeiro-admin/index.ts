import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Usar banco de dados EXTERNO como principal
    const supabaseUrl = Deno.env.get('EXTERNAL_SUPABASE_URL') || Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('EXTERNAL_SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    console.log('📦 Usando banco:', supabaseUrl.substring(0, 30) + '...')
    
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    // GET - Check if setup is needed (no super_admin exists)
    if (req.method === 'GET') {
      console.log('Checking if super_admin exists...')
      
      const { data: existingAdmin, error: checkError } = await supabase
        .from('user_roles')
        .select('id')
        .eq('role', 'super_admin')
        .limit(1)

      if (checkError) {
        console.error('Error checking for existing admin:', checkError)
        throw checkError
      }

      const needsSetup = !existingAdmin || existingAdmin.length === 0
      console.log('Needs setup:', needsSetup)

      return new Response(
        JSON.stringify({ needsSetup }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // POST - Create first super_admin
    if (req.method === 'POST') {
      const { nomeEmpresa, nomeUsuario, email, senha } = await req.json()

      // Validate required fields
      if (!nomeEmpresa || !nomeUsuario || !email || !senha) {
        return new Response(
          JSON.stringify({ error: 'Todos os campos são obrigatórios' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      if (senha.length < 6) {
        return new Response(
          JSON.stringify({ error: 'A senha deve ter pelo menos 6 caracteres' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Check if super_admin already exists
      console.log('Checking if super_admin already exists before creation...')
      const { data: existingAdmin, error: checkError } = await supabase
        .from('user_roles')
        .select('id')
        .eq('role', 'super_admin')
        .limit(1)

      if (checkError) {
        console.error('Error checking for existing admin:', checkError)
        throw checkError
      }

      if (existingAdmin && existingAdmin.length > 0) {
        console.log('Super admin already exists, blocking creation')
        return new Response(
          JSON.stringify({ error: 'O sistema já possui um administrador configurado' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      console.log('No super_admin found, proceeding with creation...')

      // Create user in Supabase Auth
      console.log('Creating user in auth...')
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email,
        password: senha,
        email_confirm: true
      })

      if (authError) {
        console.error('Error creating auth user:', authError)
        return new Response(
          JSON.stringify({ error: `Erro ao criar usuário: ${authError.message}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const userId = authData.user.id
      console.log('Auth user created with ID:', userId)

      // Create conta (company)
      console.log('Creating conta...')
      const { data: contaData, error: contaError } = await supabase
        .from('contas')
        .insert({
          nome: nomeEmpresa,
          ativo: true
        })
        .select()
        .single()

      if (contaError) {
        console.error('Error creating conta:', contaError)
        // Rollback: delete auth user
        await supabase.auth.admin.deleteUser(userId)
        throw contaError
      }

      const contaId = contaData.id
      console.log('Conta created with ID:', contaId)

      // Create usuario
      console.log('Creating usuario...')
      const { error: usuarioError } = await supabase
        .from('usuarios')
        .insert({
          user_id: userId,
          conta_id: contaId,
          nome: nomeUsuario,
          email: email,
          is_admin: true
        })

      if (usuarioError) {
        console.error('Error creating usuario:', usuarioError)
        // Rollback
        await supabase.from('contas').delete().eq('id', contaId)
        await supabase.auth.admin.deleteUser(userId)
        throw usuarioError
      }

      // Create super_admin role
      console.log('Creating super_admin role...')
      const { error: roleError } = await supabase
        .from('user_roles')
        .insert({
          user_id: userId,
          role: 'super_admin'
        })

      if (roleError) {
        console.error('Error creating role:', roleError)
        // Rollback
        await supabase.from('usuarios').delete().eq('user_id', userId)
        await supabase.from('contas').delete().eq('id', contaId)
        await supabase.auth.admin.deleteUser(userId)
        throw roleError
      }

      // Create default agent and funnel for the new conta
      console.log('Creating default agent...')
      const { error: agentError } = await supabase
        .from('agent_ia')
        .insert({
          conta_id: contaId,
          nome: 'Agente Padrão',
          descricao: 'Agente de IA configurado automaticamente',
          ativo: false
        })

      if (agentError) {
        console.error('Error creating default agent:', agentError)
        // Non-critical, continue
      }

      console.log('Creating default funnel...')
      const { data: funilData, error: funilError } = await supabase
        .from('funis')
        .insert({
          conta_id: contaId,
          nome: 'Funil Principal',
          descricao: 'Funil de vendas padrão'
        })
        .select()
        .single()

      if (funilError) {
        console.error('Error creating default funnel:', funilError)
        // Non-critical, continue
      } else {
        // Create default stages
        const estagiosPadrao = [
          { nome: 'Novo Lead', ordem: 1, cor: '#3B82F6', tipo: 'novo' },
          { nome: 'Qualificação', ordem: 2, cor: '#F59E0B', tipo: 'andamento' },
          { nome: 'Proposta', ordem: 3, cor: '#8B5CF6', tipo: 'andamento' },
          { nome: 'Negociação', ordem: 4, cor: '#EC4899', tipo: 'andamento' },
          { nome: 'Ganho', ordem: 5, cor: '#10B981', tipo: 'ganho' },
          { nome: 'Perdido', ordem: 6, cor: '#EF4444', tipo: 'perdido' }
        ]

        for (const estagio of estagiosPadrao) {
          await supabase
            .from('estagios')
            .insert({
              funil_id: funilData.id,
              nome: estagio.nome,
              ordem: estagio.ordem,
              cor: estagio.cor,
              tipo: estagio.tipo
            })
        }
        console.log('Default stages created')
      }

      console.log('First super_admin setup completed successfully!')

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Primeiro administrador criado com sucesso!',
          contaId,
          userId
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ error: 'Método não permitido' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error in setup-primeiro-admin:', error)
    const errorMessage = error instanceof Error ? error.message : 'Erro interno do servidor'
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
