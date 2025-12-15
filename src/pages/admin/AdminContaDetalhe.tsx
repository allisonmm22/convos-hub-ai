import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Building2, Users, MessageSquare, TrendingUp, Phone, Power, Save, KeyRound } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import AdminLayout from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { toast } from 'sonner';

interface Conta {
  id: string;
  nome: string;
  ativo: boolean;
  created_at: string;
}

interface Usuario {
  id: string;
  nome: string;
  email: string;
  is_admin: boolean;
  user_id: string;
  created_at: string;
}

interface Metricas {
  usuarios: number;
  conversas: number;
  negociacoes: number;
  contatos: number;
}

export default function AdminContaDetalhe() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [conta, setConta] = useState<Conta | null>(null);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [metricas, setMetricas] = useState<Metricas>({ usuarios: 0, conversas: 0, negociacoes: 0, contatos: 0 });
  const [loading, setLoading] = useState(true);
  const [editNome, setEditNome] = useState('');
  const [saving, setSaving] = useState(false);
  const [resetPasswordModal, setResetPasswordModal] = useState<Usuario | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [resettingPassword, setResettingPassword] = useState(false);

  useEffect(() => {
    if (id) fetchContaData();
  }, [id]);

  const fetchContaData = async () => {
    if (!id) return;

    try {
      // Buscar conta
      const { data: contaData, error: contaError } = await supabase
        .from('contas')
        .select('*')
        .eq('id', id)
        .single();

      if (contaError) throw contaError;
      setConta({ ...contaData, ativo: (contaData as any).ativo ?? true });
      setEditNome(contaData.nome);

      // Buscar usuários
      const { data: usuariosData } = await supabase
        .from('usuarios')
        .select('*')
        .eq('conta_id', id)
        .order('created_at', { ascending: false });

      setUsuarios(usuariosData || []);

      // Buscar métricas
      const [
        { count: conversasCount },
        { count: negociacoesCount },
        { count: contatosCount },
      ] = await Promise.all([
        supabase.from('conversas').select('*', { count: 'exact', head: true }).eq('conta_id', id),
        supabase.from('negociacoes').select('*', { count: 'exact', head: true }).eq('conta_id', id),
        supabase.from('contatos').select('*', { count: 'exact', head: true }).eq('conta_id', id),
      ]);

      setMetricas({
        usuarios: usuariosData?.length || 0,
        conversas: conversasCount || 0,
        negociacoes: negociacoesCount || 0,
        contatos: contatosCount || 0,
      });
    } catch (error) {
      console.error('Erro ao buscar dados da conta:', error);
      toast.error('Erro ao carregar dados da conta');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveNome = async () => {
    if (!conta || !editNome.trim()) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('contas')
        .update({ nome: editNome.trim() })
        .eq('id', conta.id);

      if (error) throw error;
      setConta({ ...conta, nome: editNome.trim() });
      toast.success('Nome atualizado');
    } catch (error) {
      console.error('Erro ao salvar:', error);
      toast.error('Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  const toggleContaStatus = async () => {
    if (!conta) return;

    try {
      const { error } = await supabase
        .from('contas')
        .update({ ativo: !conta.ativo } as any)
        .eq('id', conta.id);

      if (error) throw error;
      setConta({ ...conta, ativo: !conta.ativo });
      toast.success(conta.ativo ? 'Conta desativada' : 'Conta ativada');
    } catch (error) {
      console.error('Erro ao alterar status:', error);
      toast.error('Erro ao alterar status');
    }
  };

  const handleResetPassword = async () => {
    if (!resetPasswordModal || !newPassword || newPassword.length < 6) {
      toast.error('Senha deve ter no mínimo 6 caracteres');
      return;
    }

    setResettingPassword(true);
    try {
      const { error } = await supabase.functions.invoke('reset-user-password', {
        body: { userId: resetPasswordModal.user_id, newPassword },
      });

      if (error) throw error;
      toast.success('Senha redefinida com sucesso');
      setResetPasswordModal(null);
      setNewPassword('');
    } catch (error) {
      console.error('Erro ao redefinir senha:', error);
      toast.error('Erro ao redefinir senha');
    } finally {
      setResettingPassword(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-64">
          <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </AdminLayout>
    );
  }

  if (!conta) {
    return (
      <AdminLayout>
        <div className="text-center py-12">
          <p className="text-muted-foreground">Conta não encontrada</p>
          <Button variant="link" onClick={() => navigate('/admin/contas')}>
            Voltar para lista
          </Button>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/admin/contas')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-foreground">{conta.nome}</h1>
            <p className="text-muted-foreground">Detalhes da conta</p>
          </div>
          <Badge variant={conta.ativo ? 'default' : 'secondary'} className="text-sm">
            {conta.ativo ? 'Ativa' : 'Inativa'}
          </Badge>
        </div>

        {/* Métricas */}
        <div className="grid gap-4 md:grid-cols-4">
          {[
            { label: 'Usuários', value: metricas.usuarios, icon: Users, color: 'text-blue-500' },
            { label: 'Conversas', value: metricas.conversas, icon: MessageSquare, color: 'text-green-500' },
            { label: 'Negociações', value: metricas.negociacoes, icon: TrendingUp, color: 'text-purple-500' },
            { label: 'Contatos', value: metricas.contatos, icon: Phone, color: 'text-orange-500' },
          ].map((stat) => (
            <Card key={stat.label}>
              <CardContent className="flex items-center gap-4 p-4">
                <stat.icon className={`h-8 w-8 ${stat.color}`} />
                <div>
                  <p className="text-2xl font-bold">{stat.value}</p>
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Informações da Conta */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Informações da Conta
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Nome da Conta</Label>
                <div className="flex gap-2">
                  <Input
                    value={editNome}
                    onChange={(e) => setEditNome(e.target.value)}
                  />
                  <Button
                    onClick={handleSaveNome}
                    disabled={saving || editNome === conta.nome}
                  >
                    <Save className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label>Criada em</Label>
                <p className="text-muted-foreground">{formatDate(conta.created_at)}</p>
              </div>

              <Button
                variant={conta.ativo ? 'destructive' : 'default'}
                className="w-full"
                onClick={toggleContaStatus}
              >
                <Power className="h-4 w-4 mr-2" />
                {conta.ativo ? 'Desativar Conta' : 'Ativar Conta'}
              </Button>
            </CardContent>
          </Card>

          {/* Lista de Usuários */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Usuários ({usuarios.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {usuarios.length === 0 ? (
                <p className="text-center text-muted-foreground py-4">
                  Nenhum usuário nesta conta
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {usuarios.map((usuario) => (
                      <TableRow key={usuario.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{usuario.nome}</p>
                            <p className="text-xs text-muted-foreground">{usuario.email}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={usuario.is_admin ? 'default' : 'secondary'}>
                            {usuario.is_admin ? 'Admin' : 'Usuário'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setResetPasswordModal(usuario)}
                          >
                            <KeyRound className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Modal Reset Password */}
      <Dialog open={!!resetPasswordModal} onOpenChange={() => setResetPasswordModal(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Redefinir Senha</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              Redefinir senha do usuário: <strong>{resetPasswordModal?.nome}</strong>
            </p>
            <div className="space-y-2">
              <Label>Nova Senha</Label>
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetPasswordModal(null)}>
              Cancelar
            </Button>
            <Button onClick={handleResetPassword} disabled={resettingPassword}>
              {resettingPassword ? 'Redefinindo...' : 'Redefinir'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
