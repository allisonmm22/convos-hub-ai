import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Ordem de migração respeitando dependências
// hasCreatedAt indica se a tabela tem coluna created_at para ordenação
const MIGRATION_ORDER = [
  // Nível 0 - Sem dependências
  { table: 'planos', hasCreatedAt: true },
  { table: 'configuracoes_plataforma', hasCreatedAt: true },
  
  // Nível 1 - Depende do nível 0
  { table: 'contas', hasCreatedAt: true },
  
  // Nível 2 - Depende do nível 1
  { table: 'usuarios', hasCreatedAt: true },
  { table: 'contatos', hasCreatedAt: true },
  { table: 'conexoes_whatsapp', hasCreatedAt: true },
  { table: 'funis', hasCreatedAt: true },
  { table: 'agent_ia', hasCreatedAt: true },
  { table: 'tags', hasCreatedAt: true },
  { table: 'calendarios_google', hasCreatedAt: true },
  { table: 'campos_personalizados_grupos', hasCreatedAt: true },
  { table: 'followup_regras', hasCreatedAt: true },
  { table: 'lembrete_regras', hasCreatedAt: true },
  
  // Nível 3 - Depende do nível 2
  { table: 'user_roles', hasCreatedAt: true },
  { table: 'atendente_config', hasCreatedAt: true },
  { table: 'estagios', hasCreatedAt: true },
  { table: 'agent_ia_etapas', hasCreatedAt: true },
  { table: 'agent_ia_perguntas', hasCreatedAt: true },
  { table: 'agent_ia_agendamento_config', hasCreatedAt: true },
  { table: 'campos_personalizados', hasCreatedAt: true },
  
  // Nível 4 - Depende do nível 3
  { table: 'agent_ia_agendamento_horarios', hasCreatedAt: true },
  { table: 'conversas', hasCreatedAt: true },
  { table: 'negociacoes', hasCreatedAt: true },
  { table: 'agendamentos', hasCreatedAt: true },
  { table: 'contato_campos_valores', hasCreatedAt: true },
  
  // Nível 5 - Depende do nível 4
  { table: 'mensagens', hasCreatedAt: true },
  { table: 'mensagens_processadas', hasCreatedAt: true },
  { table: 'respostas_pendentes', hasCreatedAt: true },
  { table: 'followup_enviados', hasCreatedAt: false }, // Não tem created_at
  { table: 'followups_agendados', hasCreatedAt: true },
  { table: 'negociacao_historico', hasCreatedAt: true },
  { table: 'negociacao_notas', hasCreatedAt: true },
  { table: 'lembrete_enviados', hasCreatedAt: false }, // Não tem created_at
  { table: 'transferencias_atendimento', hasCreatedAt: true },
  { table: 'notificacoes', hasCreatedAt: true },
  { table: 'logs_atividade', hasCreatedAt: true },
  { table: 'uso_tokens', hasCreatedAt: true },
];

interface MigrationResult {
  table: string;
  success: boolean;
  migrated: number;
  error?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🚀 Iniciando migração completa para banco externo...');

    // Credenciais do Lovable (origem)
    const sourceUrl = Deno.env.get('SUPABASE_URL')!;
    const sourceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Credenciais do externo (destino)
    const targetUrl = Deno.env.get('EXTERNAL_STORAGE_URL');
    const targetKey = Deno.env.get('EXTERNAL_STORAGE_KEY');

    if (!targetUrl || !targetKey) {
      throw new Error('Credenciais do Supabase externo não configuradas');
    }

    // Criar clientes
    const sourceSupabase = createClient(sourceUrl, sourceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const targetSupabase = createClient(targetUrl, targetKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Verificar parâmetros opcionais
    const url = new URL(req.url);
    const specificTable = url.searchParams.get('table');
    const forceAll = url.searchParams.get('force') === 'true';

    const results: MigrationResult[] = [];
    let totalMigrated = 0;

    // Filtrar tabelas se especificado
    const tablesToMigrate = specificTable 
      ? MIGRATION_ORDER.filter(t => t.table === specificTable)
      : MIGRATION_ORDER;

    for (const { table, hasCreatedAt } of tablesToMigrate) {
      console.log(`\n📦 Migrando tabela: ${table}`);
      
      try {
        // Buscar todos os dados da origem
        // Usar created_at para ordenação se disponível, senão usar id
        let query = sourceSupabase.from(table).select('*');
        
        if (hasCreatedAt) {
          query = query.order('created_at', { ascending: true });
        } else {
          query = query.order('id', { ascending: true });
        }
        
        const { data: sourceData, error: fetchError } = await query;

        if (fetchError) {
          console.error(`❌ Erro ao buscar ${table}:`, fetchError.message);
          results.push({ table, success: false, migrated: 0, error: fetchError.message });
          continue;
        }

        if (!sourceData || sourceData.length === 0) {
          console.log(`⏭️ ${table}: nenhum registro para migrar`);
          results.push({ table, success: true, migrated: 0 });
          continue;
        }

        console.log(`📊 ${table}: ${sourceData.length} registros encontrados`);

        // Migrar em lotes de 500
        const BATCH_SIZE = 500;
        let migratedCount = 0;

        for (let i = 0; i < sourceData.length; i += BATCH_SIZE) {
          const batch = sourceData.slice(i, i + BATCH_SIZE);
          
          // Upsert no destino
          const { error: upsertError } = await targetSupabase
            .from(table)
            .upsert(batch, { 
              onConflict: 'id',
              ignoreDuplicates: false
            });

          if (upsertError) {
            console.error(`❌ Erro no upsert ${table} (lote ${i / BATCH_SIZE + 1}):`, upsertError.message);
            
            // Tentar inserir um por um para identificar o problema
            for (const record of batch) {
              const { error: singleError } = await targetSupabase
                .from(table)
                .upsert(record, { onConflict: 'id' });
              
              if (!singleError) {
                migratedCount++;
              }
            }
          } else {
            migratedCount += batch.length;
          }
        }

        console.log(`✅ ${table}: ${migratedCount} registros migrados`);
        results.push({ table, success: true, migrated: migratedCount });
        totalMigrated += migratedCount;

        // Atualizar sync_log
        await targetSupabase
          .from('sync_log')
          .upsert({
            tabela: table,
            ultimo_sync: new Date().toISOString(),
            registros_sync: migratedCount
          }, { onConflict: 'tabela' });

      } catch (tableError: any) {
        console.error(`❌ Erro na tabela ${table}:`, tableError.message);
        results.push({ table, success: false, migrated: 0, error: tableError.message });
      }
    }

    // Resumo final
    const successCount = results.filter(r => r.success).length;
    const errorCount = results.filter(r => !r.success).length;

    console.log(`\n🎉 Migração concluída!`);
    console.log(`✅ Sucesso: ${successCount} tabelas`);
    console.log(`❌ Erros: ${errorCount} tabelas`);
    console.log(`📊 Total de registros: ${totalMigrated}`);

    return new Response(
      JSON.stringify({
        success: errorCount === 0,
        message: `Migração concluída: ${totalMigrated} registros em ${successCount} tabelas`,
        summary: {
          tablesSuccess: successCount,
          tablesError: errorCount,
          totalRecords: totalMigrated
        },
        results
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    console.error('❌ Erro na migração:', errorMessage);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});
