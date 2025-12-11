import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface Usuario {
  id: string;
  user_id: string;
  conta_id: string;
  nome: string;
  email: string;
  avatar_url: string | null;
  is_admin: boolean;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  usuario: Usuario | null;
  loading: boolean;
  signUp: (email: string, password: string, nome: string) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
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

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchUsuario(session.user.id);
      } else {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchUsuario = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('usuarios')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) throw error;
      setUsuario(data);
    } catch (error) {
      console.error('Erro ao buscar usuário:', error);
    } finally {
      setLoading(false);
    }
  };

  const signUp = async (email: string, password: string, nome: string) => {
    try {
      const redirectUrl = `${window.location.origin}/`;
      
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: redirectUrl
        }
      });

      if (error) throw error;

      if (data.user) {
        // Criar conta
        const { data: contaData, error: contaError } = await supabase
          .from('contas')
          .insert({ nome: `Conta de ${nome}` })
          .select()
          .single();

        if (contaError) throw contaError;

        // Criar usuário
        const { error: usuarioError } = await supabase
          .from('usuarios')
          .insert({
            user_id: data.user.id,
            conta_id: contaData.id,
            nome,
            email,
            is_admin: true
          });

        if (usuarioError) throw usuarioError;

        // Criar configuração padrão do Agente IA
        await supabase.from('agent_ia').insert({ conta_id: contaData.id });

        // Criar funil padrão
        const { data: funilData } = await supabase
          .from('funis')
          .insert({ conta_id: contaData.id, nome: 'Vendas', ordem: 0 })
          .select()
          .single();

        if (funilData) {
          await supabase.from('estagios').insert([
            { funil_id: funilData.id, nome: 'Novo Lead', ordem: 0, cor: '#3b82f6' },
            { funil_id: funilData.id, nome: 'Em Contato', ordem: 1, cor: '#f59e0b' },
            { funil_id: funilData.id, nome: 'Proposta Enviada', ordem: 2, cor: '#8b5cf6' },
            { funil_id: funilData.id, nome: 'Negociação', ordem: 3, cor: '#ec4899' },
            { funil_id: funilData.id, nome: 'Fechado', ordem: 4, cor: '#10b981' },
          ]);
        }
      }

      return { error: null };
    } catch (error) {
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
    await supabase.auth.signOut();
    setUsuario(null);
  };

  return (
    <AuthContext.Provider value={{ user, session, usuario, loading, signUp, signIn, signOut }}>
      {children}
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
