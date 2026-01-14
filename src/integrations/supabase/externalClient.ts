// Cliente Supabase - LOVABLE CLOUD como principal
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

// Configuração do Lovable Cloud (banco principal)
const LOVABLE_URL = import.meta.env.VITE_SUPABASE_URL;
const LOVABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

// Flag - agora usando Lovable Cloud como principal
export const isUsingExternalDatabase = false;

console.log('🟢 SUPABASE: Usando Lovable Cloud:', LOVABLE_URL);

// Cliente principal para operações de banco de dados (Lovable Cloud)
export const supabaseExternal = createClient<Database>(
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

// Alias para edge functions (mesmo cliente)
export const supabaseFunctions = supabaseExternal;

console.log('🔵 Cliente unificado Lovable Cloud configurado');
