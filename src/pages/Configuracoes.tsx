import { useState, useEffect } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { User, Building, Save, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export default function Configuracoes() {
  const { usuario } = useAuth();
  const [loading, setLoading] = useState(false);
  const [userData, setUserData] = useState({
    nome: '',
    email: '',
  });
  const [contaData, setContaData] = useState({
    nome: '',
  });

  useEffect(() => {
    if (usuario) {
      setUserData({
        nome: usuario.nome,
        email: usuario.email,
      });
      fetchConta();
    }
  }, [usuario]);

  const fetchConta = async () => {
    const { data } = await supabase
      .from('contas')
      .select('nome')
      .eq('id', usuario!.conta_id)
      .single();

    if (data) {
      setContaData({ nome: data.nome });
    }
  };

  const handleSaveUser = async () => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('usuarios')
        .update({ nome: userData.nome })
        .eq('id', usuario!.id);

      if (error) throw error;
      toast.success('Perfil atualizado!');
    } catch (error) {
      toast.error('Erro ao salvar');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveConta = async () => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('contas')
        .update({ nome: contaData.nome })
        .eq('id', usuario!.conta_id);

      if (error) throw error;
      toast.success('Conta atualizada!');
    } catch (error) {
      toast.error('Erro ao salvar');
    } finally {
      setLoading(false);
    }
  };

  return (
    <MainLayout>
      <div className="max-w-2xl space-y-8 animate-fade-in">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Configurações</h1>
          <p className="text-muted-foreground mt-1">
            Gerencie suas preferências e configurações da conta.
          </p>
        </div>

        {/* Perfil */}
        <div className="p-6 rounded-xl bg-card border border-border space-y-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/20">
              <User className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">Perfil</h2>
              <p className="text-sm text-muted-foreground">Suas informações pessoais</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Nome</label>
              <input
                type="text"
                value={userData.nome}
                onChange={(e) => setUserData({ ...userData, nome: e.target.value })}
                className="w-full h-11 px-4 rounded-lg bg-input border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Email</label>
              <input
                type="email"
                value={userData.email}
                disabled
                className="w-full h-11 px-4 rounded-lg bg-muted border border-border text-muted-foreground cursor-not-allowed"
              />
              <p className="text-xs text-muted-foreground mt-1">
                O email não pode ser alterado
              </p>
            </div>
          </div>

          <button
            onClick={handleSaveUser}
            disabled={loading}
            className="h-10 px-6 rounded-lg bg-primary text-primary-foreground font-medium flex items-center gap-2 hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Save className="h-4 w-4" />
                Salvar Perfil
              </>
            )}
          </button>
        </div>

        {/* Conta */}
        <div className="p-6 rounded-xl bg-card border border-border space-y-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-warning/20">
              <Building className="h-5 w-5 text-warning" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">Conta</h2>
              <p className="text-sm text-muted-foreground">Configurações da sua empresa</p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Nome da Empresa
            </label>
            <input
              type="text"
              value={contaData.nome}
              onChange={(e) => setContaData({ ...contaData, nome: e.target.value })}
              className="w-full h-11 px-4 rounded-lg bg-input border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <button
            onClick={handleSaveConta}
            disabled={loading}
            className="h-10 px-6 rounded-lg bg-primary text-primary-foreground font-medium flex items-center gap-2 hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Save className="h-4 w-4" />
                Salvar Conta
              </>
            )}
          </button>
        </div>
      </div>
    </MainLayout>
  );
}
