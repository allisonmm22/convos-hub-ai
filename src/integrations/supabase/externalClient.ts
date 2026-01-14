// Cliente Supabase para banco de dados externo (principal)
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

// Configuração do Supabase externo via variáveis de ambiente
const EXTERNAL_URL = import.meta.env.VITE_EXTERNAL_SUPABASE_URL || '';
const EXTERNAL_ANON_KEY = import.meta.env.VITE_EXTERNAL_SUPABASE_ANON_KEY || '';

// Configuração do Lovable Cloud (para Edge Functions)
const LOVABLE_URL = import.meta.env.VITE_SUPABASE_URL;
const LOVABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

// Flag para indicar se está usando banco externo
export const isUsingExternalDatabase = Boolean(EXTERNAL_URL && EXTERNAL_ANON_KEY);

// Log de debug para identificar qual banco está sendo usado
if (isUsingExternalDatabase) {
  console.log('🟢 SUPABASE: Usando banco EXTERNO:', EXTERNAL_URL);
} else {
  console.warn('🟡 SUPABASE: Variáveis externas não configuradas. Usando Lovable Cloud como fallback.');
  console.warn('   Configure VITE_EXTERNAL_SUPABASE_URL e VITE_EXTERNAL_SUPABASE_ANON_KEY no ambiente de deploy.');
}

// Cliente principal para operações de banco de dados (externo ou fallback)
export const supabaseExternal = createClient<Database>(
  EXTERNAL_URL || LOVABLE_URL,
  EXTERNAL_ANON_KEY || LOVABLE_KEY,
  {
    auth: {
      storage: localStorage,
      persistSession: true,
      autoRefreshToken: true,
    }
  }
);

// Cliente do Lovable Cloud APENAS para chamar Edge Functions
// (As Edge Functions estão hospedadas no Lovable Cloud, não no Supabase externo)
export const supabaseFunctions = createClient<Database>(
  LOVABLE_URL,
  LOVABLE_KEY,
  {
    auth: {
      storage: localStorage,
      persistSession: true,
      autoRefreshToken: true,
    }
  }
);

console.log('🔵 EDGE FUNCTIONS: Usando Lovable Cloud:', LOVABLE_URL);
