import { useEffect, useState } from 'react';
import { Search, Plus, Building2, Users, MessageSquare, MoreVertical, Eye, Power } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import AdminLayout from '@/components/admin/AdminLayout';
import NovaContaAdminModal from '@/components/admin/NovaContaAdminModal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { toast } from 'sonner';

interface ContaComMetricas {
  id: string;
  nome: string;
  ativo: boolean;
  created_at: string;
  usuarios_count: number;
  conversas_count: number;
}

export default function AdminContas() {
  const navigate = useNavigate();
  const [contas, setContas] = useState<ContaComMetricas[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'todas' | 'ativas' | 'inativas'>('todas');
  const [showNovaContaModal, setShowNovaContaModal] = useState(false);

  useEffect(() => {
    fetchContas();
  }, []);

  const fetchContas = async () => {
    try {
      // Buscar contas com campo ativo
      const { data: contasData, error: contasError } = await supabase
        .from('contas')
        .select('id, nome, created_at')
        .order('created_at', { ascending: false });

      if (contasError) throw contasError;

      // Buscar métricas para cada conta
      const contasComMetricas = await Promise.all(
        (contasData || []).map(async (conta) => {
          const [{ count: usuariosCount }, { count: conversasCount }, { data: contaFull }] = await Promise.all([
            supabase.from('usuarios').select('*', { count: 'exact', head: true }).eq('conta_id', conta.id),
            supabase.from('conversas').select('*', { count: 'exact', head: true }).eq('conta_id', conta.id),
            supabase.from('contas').select('*').eq('id', conta.id).single(),
          ]);

          return {
            ...conta,
            ativo: (contaFull as any)?.ativo ?? true,
            usuarios_count: usuariosCount || 0,
            conversas_count: conversasCount || 0,
          };
        })
      );

      setContas(contasComMetricas);
    } catch (error) {
      console.error('Erro ao buscar contas:', error);
      toast.error('Erro ao carregar contas');
    } finally {
      setLoading(false);
    }
  };

  const toggleContaStatus = async (contaId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('contas')
        .update({ ativo: !currentStatus } as any)
        .eq('id', contaId);

      if (error) throw error;

      setContas(contas.map(c => 
        c.id === contaId ? { ...c, ativo: !currentStatus } : c
      ));
      
      toast.success(currentStatus ? 'Conta desativada' : 'Conta ativada');
    } catch (error) {
      console.error('Erro ao alterar status:', error);
      toast.error('Erro ao alterar status da conta');
    }
  };

  const filteredContas = contas.filter(conta => {
    const matchesSearch = conta.nome.toLowerCase().includes(search.toLowerCase());
    const matchesFilter = filter === 'todas' 
      || (filter === 'ativas' && conta.ativo)
      || (filter === 'inativas' && !conta.ativo);
    return matchesSearch && matchesFilter;
  });

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

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Contas</h1>
            <p className="text-muted-foreground">Gerencie as contas de clientes do sistema</p>
          </div>
          <Button onClick={() => setShowNovaContaModal(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Nova Conta
          </Button>
        </div>

        <div className="flex gap-4 items-center">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex gap-2">
            {(['todas', 'ativas', 'inativas'] as const).map((f) => (
              <Button
                key={f}
                variant={filter === f ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilter(f)}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </Button>
            ))}
          </div>
        </div>

        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome da Conta</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Usuários</TableHead>
                <TableHead>Conversas</TableHead>
                <TableHead>Criada em</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredContas.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    Nenhuma conta encontrada
                  </TableCell>
                </TableRow>
              ) : (
                filteredContas.map((conta) => (
                  <TableRow key={conta.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-primary/10">
                          <Building2 className="h-4 w-4 text-primary" />
                        </div>
                        <span className="font-medium">{conta.nome}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={conta.ativo ? 'default' : 'secondary'}>
                        {conta.ativo ? 'Ativa' : 'Inativa'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <Users className="h-4 w-4" />
                        {conta.usuarios_count}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <MessageSquare className="h-4 w-4" />
                        {conta.conversas_count}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(conta.created_at)}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => navigate(`/admin/contas/${conta.id}`)}>
                            <Eye className="h-4 w-4 mr-2" />
                            Ver detalhes
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => toggleContaStatus(conta.id, conta.ativo)}>
                            <Power className="h-4 w-4 mr-2" />
                            {conta.ativo ? 'Desativar' : 'Ativar'}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <NovaContaAdminModal
        open={showNovaContaModal}
        onClose={() => setShowNovaContaModal(false)}
        onSuccess={() => {
          setShowNovaContaModal(false);
          fetchContas();
        }}
      />
    </AdminLayout>
  );
}
