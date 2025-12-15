import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { toast } from 'sonner';

interface NovaContaAdminModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function NovaContaAdminModal({ open, onClose, onSuccess }: NovaContaAdminModalProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    nomeEmpresa: '',
    nomeUsuario: '',
    email: '',
    senha: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.nomeEmpresa || !formData.nomeUsuario || !formData.email || !formData.senha) {
      toast.error('Preencha todos os campos');
      return;
    }

    if (formData.senha.length < 6) {
      toast.error('Senha deve ter no mínimo 6 caracteres');
      return;
    }

    setLoading(true);
    try {
      // 1. Criar usuário no auth
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: formData.email,
        password: formData.senha,
        email_confirm: true,
      });

      // Se não tiver permissão de admin, usar signUp normal
      if (authError && authError.message.includes('not authorized')) {
        // Usar Edge Function para criar conta
        const { data, error } = await supabase.functions.invoke('criar-conta-admin', {
          body: {
            nomeEmpresa: formData.nomeEmpresa,
            nomeUsuario: formData.nomeUsuario,
            email: formData.email,
            senha: formData.senha,
          },
        });

        if (error) throw error;
        
        toast.success('Conta criada com sucesso');
        setFormData({ nomeEmpresa: '', nomeUsuario: '', email: '', senha: '' });
        onSuccess();
        return;
      }

      if (authError) throw authError;

      // 2. Criar conta
      const { data: contaData, error: contaError } = await supabase
        .from('contas')
        .insert({ nome: formData.nomeEmpresa })
        .select()
        .single();

      if (contaError) throw contaError;

      // 3. Criar usuário
      const { error: usuarioError } = await supabase
        .from('usuarios')
        .insert({
          user_id: authData.user!.id,
          conta_id: contaData.id,
          nome: formData.nomeUsuario,
          email: formData.email,
          is_admin: true,
        });

      if (usuarioError) throw usuarioError;

      // 4. Criar role admin
      await supabase.from('user_roles').insert({
        user_id: authData.user!.id,
        role: 'admin',
      });

      // 5. Criar agente IA padrão
      await supabase.from('agent_ia').insert({ conta_id: contaData.id });

      // 6. Criar funil padrão
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

      toast.success('Conta criada com sucesso');
      setFormData({ nomeEmpresa: '', nomeUsuario: '', email: '', senha: '' });
      onSuccess();
    } catch (error: any) {
      console.error('Erro ao criar conta:', error);
      toast.error(error.message || 'Erro ao criar conta');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova Conta</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Nome da Empresa</Label>
            <Input
              value={formData.nomeEmpresa}
              onChange={(e) => setFormData({ ...formData, nomeEmpresa: e.target.value })}
              placeholder="Ex: Empresa XYZ"
            />
          </div>
          
          <div className="space-y-2">
            <Label>Nome do Administrador</Label>
            <Input
              value={formData.nomeUsuario}
              onChange={(e) => setFormData({ ...formData, nomeUsuario: e.target.value })}
              placeholder="Ex: João Silva"
            />
          </div>
          
          <div className="space-y-2">
            <Label>Email</Label>
            <Input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="admin@empresa.com"
            />
          </div>
          
          <div className="space-y-2">
            <Label>Senha Inicial</Label>
            <Input
              type="password"
              value={formData.senha}
              onChange={(e) => setFormData({ ...formData, senha: e.target.value })}
              placeholder="Mínimo 6 caracteres"
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Criando...' : 'Criar Conta'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
