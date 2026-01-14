// Cliente Supabase para banco de dados externo (principal)
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

// Configuração DIRETA do Supabase externo (anon key é pública e segura)
const EXTERNAL_URL = 'https://supabase.cognityx.com.br';
const EXTERNAL_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.ewogICJyb2xlIjogImFub24iLAogICJpc3MiOiAic3VwYWJhc2UiLAogICJpYXQiOiAxNzE1MDUwODAwLAogICJleHAiOiAxODcyODE3MjAwCn0.rzXGMZV1deeDvX3bpWEg9ywInunFWop5m0u5S1VW6cw';

// Configuração do Lovable Cloud (para Edge Functions)
const LOVABLE_URL = import.meta.env.VITE_SUPABASE_URL;
const LOVABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

// Flag - sempre true pois estamos usando banco externo
export const isUsingExternalDatabase = true;

console.log('🟢 SUPABASE: Usando banco EXTERNO:', EXTERNAL_URL);

// Cliente principal para operações de banco de dados (externo)
export const supabaseExternal = createClient<Database>(
  EXTERNAL_URL,
  EXTERNAL_ANON_KEY,
  {
    auth: {
      storage: localStorage,
      persistSession: true,
      autoRefreshToken: true,
    }
  }
);

// Cliente do Lovable Cloud APENAS para chamar Edge Functions
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
