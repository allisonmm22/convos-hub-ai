// Cliente Supabase para banco de dados externo (principal)
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

// Configuração do Supabase externo via variáveis de ambiente
const EXTERNAL_URL = import.meta.env.VITE_EXTERNAL_SUPABASE_URL || '';
const EXTERNAL_ANON_KEY = import.meta.env.VITE_EXTERNAL_SUPABASE_ANON_KEY || '';

if (!EXTERNAL_URL || !EXTERNAL_ANON_KEY) {
  console.warn('External Supabase credentials not configured. Using Lovable Cloud as fallback.');
}

export const supabaseExternal = createClient<Database>(
  EXTERNAL_URL || import.meta.env.VITE_SUPABASE_URL,
  EXTERNAL_ANON_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  {
    auth: {
      storage: localStorage,
      persistSession: true,
      autoRefreshToken: true,
    }
  }
);

// Flag para indicar se está usando banco externo
export const isUsingExternalDatabase = Boolean(EXTERNAL_URL && EXTERNAL_ANON_KEY);
