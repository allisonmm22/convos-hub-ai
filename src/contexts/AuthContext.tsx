import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabaseExternal as supabase } from '@/integrations/supabase/externalClient';

interface Usuario {
  id: string;
  user_id: string;
  conta_id: string | null;
  nome: string;
  email: string;
  avatar_url: string | null;
  is_admin: boolean;
  role?: 'admin' | 'atendente' | 'super_admin';
  isSuperAdmin?: boolean;
  assinatura_ativa?: boolean;
  contaAtiva?: boolean;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  usuario: Usuario | null;
  loading: boolean;
  signUp: (email: string, password: string, nome: string, whatsapp?: string, cpf?: string, planoId?: string) => Promise<{ error: Error | null; contaId?: string }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refreshUsuario: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [loading, setLoading] = useState(true);
  const [initError, setInitError] = useState<string | null>(null);

  useEffect(() => {
    let subscription: { unsubscribe: () => void } | null = null;

    const initAuth = async () => {
      try {
        const { data } = supabase.auth.onAuthStateChange(
          (event, session) => {
            setSession(session);
            setUser(session?.user ?? null);
            
            if (session?.user) {
              setTimeout(() => {
                fetchUsuario(session.user.id);
              }, 0);
            } else {
              setUsuario(null);
              setLoading(false);
            }
          }
        );
        subscription = data.subscription;

        const { data: sessionData, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('Erro ao obter sessão:', error);
          setInitError(`Erro de conexão: ${error.message}`);
          setLoading(false);
          return;
        }

        setSession(sessionData.session);
        setUser(sessionData.session?.user ?? null);
        
        if (sessionData.session?.user) {
          await fetchUsuario(sessionData.session.user.id);
        } else {
          setLoading(false);
        }
      } catch (error) {
        console.error('Erro ao inicializar autenticação:', error);
        setInitError(`Erro de conexão com o servidor: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
        setLoading(false);
      }
    };

    initAuth();

    return () => {
      if (subscription) {
        subscription.unsubscribe();
      }
    };
  }, []);

  const fetchUsuario = async (userId: string) => {
    try {
      // Primeiro, verificar especificamente se é super_admin
      const { data: superAdminRole } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .eq('role', 'super_admin')
        .maybeSingle();

      const isSuperAdmin = !!superAdminRole;

      // Buscar role principal para usuários normais (admin ou atendente)
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .neq('role', 'super_admin')
        .maybeSingle();

      // Se for super_admin, não precisa de registro na tabela usuarios
      if (isSuperAdmin) {
        // Buscar dados do auth.user para preencher dados básicos
        const { data: { user: authUser } } = await supabase.auth.getUser();
        
        setUsuario({
          id: userId,
          user_id: userId,
          conta_id: null,
          nome: authUser?.email?.split('@')[0] || 'Super Admin',
          email: authUser?.email || '',
          avatar_url: null,
          is_admin: true,
          role: 'super_admin',
          isSuperAdmin: true,
          assinatura_ativa: true,
        });
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('usuarios')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) throw error;
      
      if (data) {
        // Buscar status da conta
        let contaAtiva = true;
        if (data.conta_id) {
          const { data: contaData } = await supabase
            .from('contas')
            .select('ativo')
            .eq('id', data.conta_id)
            .single();
          contaAtiva = contaData?.ativo ?? true;
        }

        setUsuario({
          ...data,
          role: roleData?.role as 'admin' | 'atendente' | undefined,
          isSuperAdmin: false,
          assinatura_ativa: data.assinatura_ativa ?? true,
          contaAtiva,
        });
      } else {
        setUsuario(null);
      }
    } catch (error) {
      console.error('Erro ao buscar usuário:', error);
    } finally {
      setLoading(false);
    }
  };

  const signUp = async (email: string, password: string, nome: string, whatsapp?: string, cpf?: string, planoId?: string) => {
    try {
      // Usar edge function para criar usuário (bypassa RLS com service_role_key)
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/signup-usuario`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            email,
            password,
            nome,
            whatsapp,
            cpf,
            planoId,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok || result.error) {
        throw new Error(result.error || 'Erro ao criar usuário');
      }

      // Fazer login automático após cadastro
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        console.warn('Login automático falhou, usuário pode fazer login manualmente:', signInError);
      }

      return { error: null, contaId: result.contaId };
    } catch (error) {
      console.error('Erro no signup:', error);
      return { error: error as Error };
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password
      });
      if (error) throw error;
      
      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error('Erro ao fazer logout:', error);
    } finally {
      // Sempre limpar o estado local, mesmo se o logout falhar no servidor
      setUser(null);
      setSession(null);
      setUsuario(null);
      // Redirecionar para a página de login
      window.location.href = '/auth';
    }
  };

  const refreshUsuario = async () => {
    if (user) {
      await fetchUsuario(user.id);
    }
  };

  return (
    <AuthContext.Provider value={{ user, session, usuario, loading, signUp, signIn, signOut, refreshUsuario }}>
      {initError ? (
        <div className="min-h-screen flex items-center justify-center bg-background p-4">
          <div className="text-center max-w-md">
            <div className="text-destructive text-xl mb-4">⚠️ Erro de Conexão</div>
            <p className="text-muted-foreground mb-4">{initError}</p>
            <p className="text-sm text-muted-foreground">
              Verifique se a URL do banco de dados está correta e acessível.
            </p>
            <button 
              onClick={() => window.location.reload()} 
              className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
            >
              Tentar novamente
            </button>
          </div>
        </div>
      ) : (
        children
      )}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
