import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';

interface Plano {
  id: string;
  nome: string;
  descricao: string | null;
  limite_usuarios: number;
  limite_agentes: number;
  limite_funis: number;
  limite_conexoes_whatsapp: number;
  preco_mensal: number;
  ativo: boolean;
}

interface NovoPlanoModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  plano: Plano | null;
}

export default function NovoPlanoModal({ open, onClose, onSuccess, plano }: NovoPlanoModalProps) {
  const [nome, setNome] = useState('');
  const [descricao, setDescricao] = useState('');
  const [limiteUsuarios, setLimiteUsuarios] = useState(1);
  const [limiteAgentes, setLimiteAgentes] = useState(1);
  const [limiteFunis, setLimiteFunis] = useState(1);
  const [limiteConexoes, setLimiteConexoes] = useState(1);
  const [precoMensal, setPrecoMensal] = useState(0);
  const [ativo, setAtivo] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (plano) {
      setNome(plano.nome);
      setDescricao(plano.descricao || '');
      setLimiteUsuarios(plano.limite_usuarios);
      setLimiteAgentes(plano.limite_agentes);
      setLimiteFunis(plano.limite_funis);
      setLimiteConexoes(plano.limite_conexoes_whatsapp);
      setPrecoMensal(plano.preco_mensal);
      setAtivo(plano.ativo);
    } else {
      resetForm();
    }
  }, [plano, open]);

  const resetForm = () => {
    setNome('');
    setDescricao('');
    setLimiteUsuarios(1);
    setLimiteAgentes(1);
    setLimiteFunis(1);
    setLimiteConexoes(1);
    setPrecoMensal(0);
    setAtivo(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!nome.trim()) {
      toast.error('Nome do plano é obrigatório');
      return;
    }

    setSaving(true);

    try {
      const planoData = {
        nome: nome.trim(),
        descricao: descricao.trim() || null,
        limite_usuarios: limiteUsuarios,
        limite_agentes: limiteAgentes,
        limite_funis: limiteFunis,
        limite_conexoes_whatsapp: limiteConexoes,
        preco_mensal: precoMensal,
        ativo
      };

      if (plano) {
        const { error } = await supabase
          .from('planos')
          .update(planoData)
          .eq('id', plano.id);

        if (error) throw error;
        toast.success('Plano atualizado com sucesso');
      } else {
        const { error } = await supabase
          .from('planos')
          .insert(planoData);

        if (error) throw error;
        toast.success('Plano criado com sucesso');
      }

      onSuccess();
      onClose();
    } catch (error) {
      console.error('Erro ao salvar plano:', error);
      toast.error('Erro ao salvar plano');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{plano ? 'Editar Plano' : 'Novo Plano'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nome">Nome do Plano</Label>
            <Input
              id="nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex: Pro, Business..."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="descricao">Descrição</Label>
            <Textarea
              id="descricao"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Descrição do plano..."
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="preco">Preço Mensal (R$)</Label>
            <Input
              id="preco"
              type="number"
              min="0"
              step="0.01"
              value={precoMensal}
              onChange={(e) => setPrecoMensal(parseFloat(e.target.value) || 0)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="usuarios">Limite Usuários</Label>
              <Input
                id="usuarios"
                type="number"
                min="1"
                value={limiteUsuarios}
                onChange={(e) => setLimiteUsuarios(parseInt(e.target.value) || 1)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="agentes">Limite Agentes IA</Label>
              <Input
                id="agentes"
                type="number"
                min="1"
                value={limiteAgentes}
                onChange={(e) => setLimiteAgentes(parseInt(e.target.value) || 1)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="funis">Limite Funis CRM</Label>
              <Input
                id="funis"
                type="number"
                min="1"
                value={limiteFunis}
                onChange={(e) => setLimiteFunis(parseInt(e.target.value) || 1)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="conexoes">Limite Conexões WhatsApp</Label>
              <Input
                id="conexoes"
                type="number"
                min="1"
                value={limiteConexoes}
                onChange={(e) => setLimiteConexoes(parseInt(e.target.value) || 1)}
              />
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            Use 999 para limites "ilimitados"
          </p>

          <div className="flex items-center justify-between">
            <Label htmlFor="ativo">Plano Ativo</Label>
            <Switch
              id="ativo"
              checked={ativo}
              onCheckedChange={setAtivo}
            />
          </div>

          <div className="flex gap-3 pt-4">
            <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" className="flex-1" disabled={saving}>
              {saving ? 'Salvando...' : plano ? 'Salvar' : 'Criar Plano'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
