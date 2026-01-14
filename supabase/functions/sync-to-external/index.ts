import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Ordem de sincronização respeitando dependências de foreign keys
const TABELAS_ORDENADAS = [
  // Nível 0 - Sem dependências
  'planos',
  'configuracoes_plataforma',
  
  // Nível 1 - Dependem apenas de tabelas nível 0
  'contas',
  
  // Nível 2 - Dependem de contas
  'usuarios',
  'contatos',
  'conexoes_whatsapp',
  'funis',
  'agent_ia',
  'tags',
  'calendarios_google',
  'campos_personalizados_grupos',
  'followup_regras',
  'lembrete_regras',
  
  // Nível 3 - Dependem de nível 2
  'user_roles',
  'atendente_config',
  'estagios',
  'agent_ia_etapas',
  'agent_ia_perguntas',
  'agent_ia_agendamento_config',
  'campos_personalizados',
  
  // Nível 4 - Dependem de nível 3
  'agent_ia_agendamento_horarios',
  'conversas',
  'negociacoes',
  'agendamentos',
  'contato_campos_valores',
  
  // Nível 5 - Dependem de nível 4
  'mensagens',
  'mensagens_processadas',
  'respostas_pendentes',
  'followup_enviados',
  'followups_agendados',
  'negociacao_historico',
  'negociacao_notas',
  'lembrete_enviados',
  'transferencias_atendimento',
  'notificacoes',
  'logs_atividade',
  'uso_tokens',
];

// Tabelas que não têm coluna updated_at (usar created_at)
const TABELAS_SEM_UPDATED_AT = [
  'user_roles',
  'mensagens',
  'mensagens_processadas',
  'followup_enviados',
  'followups_agendados',
  'lembrete_enviados',
  'negociacao_historico',
  'transferencias_atendimento',
  'notificacoes',
  'logs_atividade',
  'uso_tokens',
];

interface SyncResult {
  tabela: string;
  registros_sincronizados: number;
  erro?: string;
  duracao_ms: number;
}

interface SyncLog {
  tabela: string;
  ultimo_sync: string;
  registros_sincronizados: number;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  console.log('=== SYNC TO EXTERNAL STARTED ===');
  console.log('Timestamp:', new Date().toISOString());

  try {
    // Configurar clientes Supabase
    const lovableUrl = Deno.env.get('SUPABASE_URL')!;
    const lovableKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const externalUrl = Deno.env.get('EXTERNAL_STORAGE_URL')!;
    const externalKey = Deno.env.get('EXTERNAL_STORAGE_KEY')!;

    if (!externalUrl || !externalKey) {
      throw new Error('EXTERNAL_STORAGE_URL ou EXTERNAL_STORAGE_KEY não configurados');
    }

    const lovableSupabase = createClient(lovableUrl, lovableKey);
    const externalSupabase = createClient(externalUrl, externalKey);

    console.log('Lovable URL:', lovableUrl);
    console.log('External URL:', externalUrl);

    // Verificar parâmetros da requisição
    const url = new URL(req.url);
    const tabelaEspecifica = url.searchParams.get('tabela');
    const forceFull = url.searchParams.get('full') === 'true';
    const statusOnly = url.pathname.endsWith('/status');

    // Se for apenas status, retornar logs de sincronização
    if (statusOnly) {
      const { data: syncLogs, error } = await externalSupabase
        .from('sync_log')
        .select('*')
        .order('ultimo_sync', { ascending: false });

      if (error) {
        console.error('Erro ao buscar status:', error);
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({
        status: 'ok',
        ultimo_sync: syncLogs?.[0]?.ultimo_sync || null,
        tabelas: syncLogs || [],
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Determinar quais tabelas sincronizar
    const tabelasParaSincronizar = tabelaEspecifica 
      ? [tabelaEspecifica] 
      : TABELAS_ORDENADAS;

    console.log('Tabelas para sincronizar:', tabelasParaSincronizar.length);
    console.log('Sincronização completa (force full):', forceFull);

    const resultados: SyncResult[] = [];
    let totalSincronizados = 0;

    for (const tabela of tabelasParaSincronizar) {
      const tabelaStart = Date.now();
      console.log(`\n--- Sincronizando: ${tabela} ---`);

      try {
        // Buscar último sync no Supabase externo
        let ultimoSync = '1970-01-01T00:00:00.000Z';
        
        if (!forceFull) {
          const { data: syncLog } = await externalSupabase
            .from('sync_log')
            .select('ultimo_sync')
            .eq('tabela', tabela)
            .single();

          if (syncLog?.ultimo_sync) {
            ultimoSync = syncLog.ultimo_sync;
          }
        }

        console.log(`Último sync: ${ultimoSync}`);

        // Determinar qual coluna usar para filtro de data
        const colunaData = TABELAS_SEM_UPDATED_AT.includes(tabela) ? 'created_at' : 'updated_at';

        // Buscar registros novos/alterados no Lovable Cloud
        // Processar em lotes de 1000 para evitar timeout
        let offset = 0;
        const batchSize = 1000;
        let totalTabelaSincronizados = 0;
        let continuarBuscando = true;

        while (continuarBuscando) {
          const { data: registros, error: fetchError } = await lovableSupabase
            .from(tabela)
            .select('*')
            .gt(colunaData, ultimoSync)
            .order(colunaData, { ascending: true })
            .range(offset, offset + batchSize - 1);

          if (fetchError) {
            console.error(`Erro ao buscar ${tabela}:`, fetchError);
            throw fetchError;
          }

          if (!registros || registros.length === 0) {
            console.log(`Nenhum registro novo encontrado para ${tabela}`);
            continuarBuscando = false;
            break;
          }

          console.log(`Encontrados ${registros.length} registros em ${tabela} (offset: ${offset})`);

          // Fazer UPSERT no Supabase externo
          const { error: upsertError } = await externalSupabase
            .from(tabela)
            .upsert(registros, { 
              onConflict: 'id',
              ignoreDuplicates: false 
            });

          if (upsertError) {
            console.error(`Erro ao inserir em ${tabela}:`, upsertError);
            throw upsertError;
          }

          totalTabelaSincronizados += registros.length;
          offset += batchSize;

          // Se retornou menos que o batch, não há mais registros
          if (registros.length < batchSize) {
            continuarBuscando = false;
          }
        }

        // Atualizar log de sincronização
        if (totalTabelaSincronizados > 0) {
          const { error: logError } = await externalSupabase
            .from('sync_log')
            .upsert({
              tabela,
              ultimo_sync: new Date().toISOString(),
              registros_sincronizados: totalTabelaSincronizados,
              updated_at: new Date().toISOString(),
            }, { onConflict: 'tabela' });

          if (logError) {
            console.error(`Erro ao atualizar sync_log para ${tabela}:`, logError);
          }
        }

        const duracao = Date.now() - tabelaStart;
        console.log(`✓ ${tabela}: ${totalTabelaSincronizados} registros em ${duracao}ms`);

        resultados.push({
          tabela,
          registros_sincronizados: totalTabelaSincronizados,
          duracao_ms: duracao,
        });

        totalSincronizados += totalTabelaSincronizados;

      } catch (error: unknown) {
        const duracao = Date.now() - tabelaStart;
        console.error(`✗ Erro em ${tabela}:`, error);
        
        resultados.push({
          tabela,
          registros_sincronizados: 0,
          erro: error instanceof Error ? error.message : String(error),
          duracao_ms: duracao,
        });
      }
    }

    const duracaoTotal = Date.now() - startTime;
    const tabelasComErro = resultados.filter(r => r.erro).length;
    const tabelasComSucesso = resultados.filter(r => !r.erro).length;

    console.log('\n=== SYNC COMPLETED ===');
    console.log(`Total sincronizados: ${totalSincronizados}`);
    console.log(`Tabelas com sucesso: ${tabelasComSucesso}`);
    console.log(`Tabelas com erro: ${tabelasComErro}`);
    console.log(`Duração total: ${duracaoTotal}ms`);

    return new Response(JSON.stringify({
      status: tabelasComErro === 0 ? 'success' : 'partial',
      mensagem: `Sincronização concluída: ${totalSincronizados} registros em ${tabelasComSucesso} tabelas`,
      total_sincronizados: totalSincronizados,
      tabelas_sucesso: tabelasComSucesso,
      tabelas_erro: tabelasComErro,
      duracao_ms: duracaoTotal,
      detalhes: resultados,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('=== SYNC ERROR ===', error);
    
    return new Response(JSON.stringify({
      status: 'error',
      error: error instanceof Error ? error.message : String(error),
      duracao_ms: Date.now() - startTime,
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
