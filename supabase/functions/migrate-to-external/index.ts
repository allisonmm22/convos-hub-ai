import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Ordem de migração respeitando dependências
const MIGRATION_ORDER = [
  // Nível 0 - Sem dependências
  { table: 'planos', hasUpdatedAt: true },
  { table: 'configuracoes_plataforma', hasUpdatedAt: true },
  
  // Nível 1 - Depende do nível 0
  { table: 'contas', hasUpdatedAt: true },
  
  // Nível 2 - Depende do nível 1
  { table: 'usuarios', hasUpdatedAt: true },
  { table: 'contatos', hasUpdatedAt: true },
  { table: 'conexoes_whatsapp', hasUpdatedAt: true },
  { table: 'funis', hasUpdatedAt: true },
  { table: 'agent_ia', hasUpdatedAt: true },
  { table: 'tags', hasUpdatedAt: true },
  { table: 'calendarios_google', hasUpdatedAt: true },
  { table: 'campos_personalizados_grupos', hasUpdatedAt: true },
  { table: 'followup_regras', hasUpdatedAt: true },
  { table: 'lembrete_regras', hasUpdatedAt: true },
  
  // Nível 3 - Depende do nível 2
  { table: 'user_roles', hasUpdatedAt: false },
  { table: 'atendente_config', hasUpdatedAt: true },
  { table: 'estagios', hasUpdatedAt: true },
  { table: 'agent_ia_etapas', hasUpdatedAt: true },
  { table: 'agent_ia_perguntas', hasUpdatedAt: true },
  { table: 'agent_ia_agendamento_config', hasUpdatedAt: true },
  { table: 'campos_personalizados', hasUpdatedAt: true },
  
  // Nível 4 - Depende do nível 3
  { table: 'agent_ia_agendamento_horarios', hasUpdatedAt: false },
  { table: 'conversas', hasUpdatedAt: true },
  { table: 'negociacoes', hasUpdatedAt: true },
  { table: 'agendamentos', hasUpdatedAt: true },
  { table: 'contato_campos_valores', hasUpdatedAt: true },
  
  // Nível 5 - Depende do nível 4
  { table: 'mensagens', hasUpdatedAt: false },
  { table: 'mensagens_processadas', hasUpdatedAt: false },
  { table: 'respostas_pendentes', hasUpdatedAt: false },
  { table: 'followup_enviados', hasUpdatedAt: false },
  { table: 'followups_agendados', hasUpdatedAt: false },
  { table: 'negociacao_historico', hasUpdatedAt: false },
  { table: 'negociacao_notas', hasUpdatedAt: true },
  { table: 'lembrete_enviados', hasUpdatedAt: false },
  { table: 'transferencias_atendimento', hasUpdatedAt: false },
  { table: 'notificacoes', hasUpdatedAt: false },
  { table: 'logs_atividade', hasUpdatedAt: false },
  { table: 'uso_tokens', hasUpdatedAt: false },
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

    for (const { table, hasUpdatedAt } of tablesToMigrate) {
      console.log(`\n📦 Migrando tabela: ${table}`);
      
      try {
        // Buscar todos os dados da origem
        const { data: sourceData, error: fetchError } = await sourceSupabase
          .from(table)
          .select('*')
          .order('created_at', { ascending: true });

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
