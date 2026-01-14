// Helper para conexão com banco de dados externo
// Todas as Edge Functions devem usar este módulo para conexão com o Supabase externo

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export function getExternalSupabase() {
  const supabaseUrl = Deno.env.get('EXTERNAL_SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('EXTERNAL_SUPABASE_SERVICE_ROLE_KEY')!;
  
  if (!supabaseUrl || !supabaseKey) {
    console.error('⚠️ EXTERNAL_SUPABASE_URL ou EXTERNAL_SUPABASE_SERVICE_ROLE_KEY não configurados!');
    throw new Error('Configuração do banco externo não encontrada');
  }
  
  console.log('✅ Usando banco de dados EXTERNO:', supabaseUrl.substring(0, 30) + '...');
  
  return createClient(supabaseUrl, supabaseKey);
}

export function getExternalUrl(): string {
  return Deno.env.get('EXTERNAL_SUPABASE_URL')!;
}

export function getExternalKey(): string {
  return Deno.env.get('EXTERNAL_SUPABASE_SERVICE_ROLE_KEY')!;
}
