import { useState, useEffect } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { ArrowLeft, Plus, Trash2, Edit2, GripVertical, Loader2, ChevronDown, ChevronRight, Settings, Tag } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { validarEExibirErro } from '@/hooks/useValidarLimitePlano';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';

interface Estagio {
  id: string;
  nome: string;
  cor: string;
  ordem: number;
  funil_id: string;
  followup_ativo: boolean;
}

interface Funil {
  id: string;
  nome: string;
  descricao: string | null;
  cor: string;
  ordem: number;
  estagios: Estagio[];
}

interface TagItem {
  id: string;
  nome: string;
  cor: string;
  conta_id: string;
}

const CORES_PREDEFINIDAS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', 
  '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1'
];

export default function CRMConfiguracoes() {
  const { usuario } = useAuth();
  const [funis, setFunis] = useState<Funil[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedFunil, setExpandedFunil] = useState<string | null>(null);
  const [permitirMultiplas, setPermitirMultiplas] = useState(true);
  
  // Tags state
  const [tags, setTags] = useState<TagItem[]>([]);
  const [tagModalOpen, setTagModalOpen] = useState(false);
  const [editingTag, setEditingTag] = useState<TagItem | null>(null);
  const [tagForm, setTagForm] = useState({ nome: '', cor: '#3b82f6' });
  
  // Modal states
  const [funilModalOpen, setFunilModalOpen] = useState(false);
  const [estagioModalOpen, setEstagioModalOpen] = useState(false);
  const [editingFunil, setEditingFunil] = useState<Funil | null>(null);
  const [editingEstagio, setEditingEstagio] = useState<Estagio | null>(null);
  const [selectedFunilId, setSelectedFunilId] = useState<string | null>(null);
  
  // Form states
  const [funilForm, setFunilForm] = useState({ nome: '', descricao: '', cor: '#3b82f6' });
  const [estagioForm, setEstagioForm] = useState({ nome: '', cor: '#3b82f6', followup_ativo: true });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (usuario?.conta_id) {
      fetchFunis();
      fetchContaConfig();
      fetchTags();
    }
  }, [usuario]);

  const fetchContaConfig = async () => {
    try {
      const { data, error } = await supabase
        .from('contas')
        .select('permitir_multiplas_negociacoes')
        .eq('id', usuario!.conta_id)
        .single();
      
      if (error) throw error;
      setPermitirMultiplas(data?.permitir_multiplas_negociacoes ?? true);
    } catch (error) {
      console.error('Erro ao buscar config da conta:', error);
    }
  };

  const handleToggleMultiplas = async (checked: boolean) => {
    try {
      const { error } = await supabase
        .from('contas')
        .update({ permitir_multiplas_negociacoes: checked })
        .eq('id', usuario!.conta_id);
      
      if (error) throw error;
      setPermitirMultiplas(checked);
      toast.success(checked ? 'Múltiplas negociações habilitadas' : 'Múltiplas negociações desabilitadas');
    } catch (error) {
      console.error('Erro ao atualizar config:', error);
      toast.error('Erro ao atualizar configuração');
    }
  };

  // Tags handlers
  const fetchTags = async () => {
    try {
      const { data, error } = await supabase
        .from('tags')
        .select('*')
        .eq('conta_id', usuario!.conta_id)
        .order('nome');
      
      if (error) throw error;
      setTags(data || []);
    } catch (error) {
      console.error('Erro ao buscar tags:', error);
    }
  };

  const openTagModal = (tag?: TagItem) => {
    if (tag) {
      setEditingTag(tag);
      setTagForm({ nome: tag.nome, cor: tag.cor });
    } else {
      setEditingTag(null);
      setTagForm({ nome: '', cor: '#3b82f6' });
    }
    setTagModalOpen(true);
  };

  const saveTag = async () => {
    if (!tagForm.nome.trim()) {
      toast.error('Nome da tag é obrigatório');
      return;
    }

    setSaving(true);
    try {
      if (editingTag) {
        const { error } = await supabase
          .from('tags')
          .update({
            nome: tagForm.nome,
            cor: tagForm.cor,
          })
          .eq('id', editingTag.id);

        if (error) throw error;
        toast.success('Tag atualizada!');
      } else {
        const { error } = await supabase
          .from('tags')
          .insert({
            conta_id: usuario!.conta_id,
            nome: tagForm.nome,
            cor: tagForm.cor,
          });

        if (error) {
          if (error.code === '23505') {
            toast.error('Já existe uma tag com este nome');
            setSaving(false);
            return;
          }
          throw error;
        }
        toast.success('Tag criada!');
      }

      setTagModalOpen(false);
      fetchTags();
    } catch (error) {
      console.error('Erro ao salvar tag:', error);
      toast.error('Erro ao salvar tag');
    } finally {
      setSaving(false);
    }
  };

  const deleteTag = async (tagId: string) => {
    if (!confirm('Tem certeza que deseja excluir esta tag?')) {
      return;
    }

    try {
      const { error } = await supabase.from('tags').delete().eq('id', tagId);
      if (error) throw error;

      toast.success('Tag excluída!');
      fetchTags();
    } catch (error) {
      console.error('Erro ao excluir tag:', error);
      toast.error('Erro ao excluir tag');
    }
  };

  const fetchFunis = async () => {
    try {
      const { data, error } = await supabase
        .from('funis')
        .select(`*, estagios(*)`)
        .eq('conta_id', usuario!.conta_id)
        .order('ordem');

      if (error) throw error;

      const funisWithSortedEstagios = (data || []).map(funil => ({
        ...funil,
        estagios: (funil.estagios || []).sort((a: Estagio, b: Estagio) => a.ordem - b.ordem)
      }));

      setFunis(funisWithSortedEstagios);
    } catch (error) {
      console.error('Erro ao buscar funis:', error);
      toast.error('Erro ao carregar funis');
    } finally {
      setLoading(false);
    }
  };

  // Funil handlers
  const openFunilModal = (funil?: Funil) => {
    if (funil) {
      setEditingFunil(funil);
      setFunilForm({ nome: funil.nome, descricao: funil.descricao || '', cor: funil.cor });
    } else {
      setEditingFunil(null);
      setFunilForm({ nome: '', descricao: '', cor: '#3b82f6' });
    }
    setFunilModalOpen(true);
  };

  const saveFunil = async () => {
    if (!funilForm.nome.trim()) {
      toast.error('Nome do funil é obrigatório');
      return;
    }

    setSaving(true);
    try {
      if (editingFunil) {
        const { error } = await supabase
          .from('funis')
          .update({
            nome: funilForm.nome,
            descricao: funilForm.descricao || null,
            cor: funilForm.cor,
          })
          .eq('id', editingFunil.id);

        if (error) throw error;
        toast.success('Funil atualizado!');
      } else {
        // Validar limite do plano para criação
        const permitido = await validarEExibirErro(usuario!.conta_id, 'funis');
        if (!permitido) {
          setSaving(false);
          return;
        }

        const maxOrdem = funis.length > 0 ? Math.max(...funis.map(f => f.ordem || 0)) + 1 : 0;
        
        const { error } = await supabase
          .from('funis')
          .insert({
            conta_id: usuario!.conta_id,
            nome: funilForm.nome,
            descricao: funilForm.descricao || null,
            cor: funilForm.cor,
            ordem: maxOrdem,
          });

        if (error) throw error;
        toast.success('Funil criado!');
      }

      setFunilModalOpen(false);
      fetchFunis();
    } catch (error) {
      console.error('Erro ao salvar funil:', error);
      toast.error('Erro ao salvar funil');
    } finally {
      setSaving(false);
    }
  };

  const deleteFunil = async (funilId: string) => {
    if (!confirm('Tem certeza que deseja excluir este funil? Todas as etapas serão removidas.')) {
      return;
    }

    try {
      // First delete all estagios
      await supabase.from('estagios').delete().eq('funil_id', funilId);
      
      // Then delete the funil
      const { error } = await supabase.from('funis').delete().eq('id', funilId);
      if (error) throw error;

      toast.success('Funil excluído!');
      fetchFunis();
    } catch (error) {
      console.error('Erro ao excluir funil:', error);
      toast.error('Erro ao excluir funil');
    }
  };

  // Estagio handlers
  const openEstagioModal = (funilId: string, estagio?: Estagio) => {
    setSelectedFunilId(funilId);
    if (estagio) {
      setEditingEstagio(estagio);
      setEstagioForm({ nome: estagio.nome, cor: estagio.cor, followup_ativo: estagio.followup_ativo ?? true });
    } else {
      setEditingEstagio(null);
      setEstagioForm({ nome: '', cor: '#3b82f6', followup_ativo: true });
    }
    setEstagioModalOpen(true);
  };

  const saveEstagio = async () => {
    if (!estagioForm.nome.trim()) {
      toast.error('Nome da etapa é obrigatório');
      return;
    }

    setSaving(true);
    try {
      if (editingEstagio) {
        const { error } = await supabase
          .from('estagios')
          .update({
            nome: estagioForm.nome,
            cor: estagioForm.cor,
            followup_ativo: estagioForm.followup_ativo,
          })
          .eq('id', editingEstagio.id);

        if (error) throw error;
        toast.success('Etapa atualizada!');
      } else {
        const funil = funis.find(f => f.id === selectedFunilId);
        const maxOrdem = funil && funil.estagios.length > 0 
          ? Math.max(...funil.estagios.map(e => e.ordem || 0)) + 1 
          : 0;
        
        const { error } = await supabase
          .from('estagios')
          .insert({
            funil_id: selectedFunilId!,
            nome: estagioForm.nome,
            cor: estagioForm.cor,
            ordem: maxOrdem,
            followup_ativo: estagioForm.followup_ativo,
          });

        if (error) throw error;
        toast.success('Etapa criada!');
      }

      setEstagioModalOpen(false);
      fetchFunis();
    } catch (error) {
      console.error('Erro ao salvar etapa:', error);
      toast.error('Erro ao salvar etapa');
    } finally {
      setSaving(false);
    }
  };

  const deleteEstagio = async (estagioId: string) => {
    if (!confirm('Tem certeza que deseja excluir esta etapa?')) {
      return;
    }

    try {
      const { error } = await supabase.from('estagios').delete().eq('id', estagioId);
      if (error) throw error;

      toast.success('Etapa excluída!');
      fetchFunis();
    } catch (error) {
      console.error('Erro ao excluir etapa:', error);
      toast.error('Erro ao excluir etapa');
    }
  };

  const reorderEstagio = async (funilId: string, estagioId: string, direction: 'up' | 'down') => {
    const funil = funis.find(f => f.id === funilId);
    if (!funil) return;

    const estagios = [...funil.estagios];
    const index = estagios.findIndex(e => e.id === estagioId);
    
    if ((direction === 'up' && index === 0) || (direction === 'down' && index === estagios.length - 1)) {
      return;
    }

    const newIndex = direction === 'up' ? index - 1 : index + 1;
    [estagios[index], estagios[newIndex]] = [estagios[newIndex], estagios[index]];

    try {
      await Promise.all(
        estagios.map((e, i) =>
          supabase.from('estagios').update({ ordem: i }).eq('id', e.id)
        )
      );
      fetchFunis();
    } catch (error) {
      console.error('Erro ao reordenar:', error);
      toast.error('Erro ao reordenar etapas');
    }
  };

  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link 
              to="/crm" 
              className="p-2 rounded-lg hover:bg-muted transition-colors"
            >
              <ArrowLeft className="h-5 w-5 text-muted-foreground" />
            </Link>
            <div>
              <h1 className="text-3xl font-bold text-foreground">Configurações do CRM</h1>
              <p className="text-muted-foreground mt-1">
                Gerencie seus funis e etapas de vendas.
              </p>
            </div>
          </div>
          <Button onClick={() => openFunilModal()} className="gap-2">
            <Plus className="h-4 w-4" />
            Novo Funil
          </Button>
        </div>

        {/* Configurações Gerais */}
        <div className="border border-border rounded-xl bg-card p-6">
          <div className="flex items-center gap-3 mb-4">
            <Settings className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">Configurações Gerais</h2>
          </div>
          
          <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
            <div className="space-y-1">
              <p className="font-medium text-foreground">Permitir múltiplas negociações por lead</p>
              <p className="text-sm text-muted-foreground">
                Se desativado, impede criar nova negociação quando o lead já possui uma em aberto
              </p>
            </div>
            <Switch 
              checked={permitirMultiplas} 
              onCheckedChange={handleToggleMultiplas} 
            />
          </div>
        </div>

        {/* Gerenciamento de Tags */}
        <div className="border border-border rounded-xl bg-card p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Tag className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold text-foreground">Gerenciamento de Tags</h2>
            </div>
            <Button size="sm" onClick={() => openTagModal()} className="gap-2">
              <Plus className="h-4 w-4" />
              Nova Tag
            </Button>
          </div>
          
          {tags.length === 0 ? (
            <div className="text-center py-8 border border-dashed border-border rounded-lg">
              <Tag className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-muted-foreground mb-2">Nenhuma tag cadastrada</p>
              <p className="text-sm text-muted-foreground">
                Tags ajudam a organizar e categorizar seus contatos
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {tags.map((tag) => (
                <div 
                  key={tag.id} 
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border border-border"
                >
                  <div className="flex items-center gap-3">
                    <div 
                      className="h-4 w-4 rounded-full shrink-0" 
                      style={{ backgroundColor: tag.cor }}
                    />
                    <span className="font-medium text-foreground truncate">{tag.nome}</span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => openTagModal(tag)}
                      className="p-1.5 rounded-lg hover:bg-muted transition-colors"
                    >
                      <Edit2 className="h-4 w-4 text-muted-foreground" />
                    </button>
                    <button
                      onClick={() => deleteTag(tag.id)}
                      className="p-1.5 rounded-lg hover:bg-destructive/10 transition-colors"
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Lista de Funis */}
        <div className="space-y-4">
          {funis.length === 0 ? (
            <div className="text-center py-12 border border-dashed border-border rounded-xl">
              <p className="text-muted-foreground mb-4">Nenhum funil configurado</p>
              <Button onClick={() => openFunilModal()} variant="outline">
                <Plus className="h-4 w-4 mr-2" />
                Criar primeiro funil
              </Button>
            </div>
          ) : (
            funis.map((funil) => (
              <div key={funil.id} className="border border-border rounded-xl bg-card overflow-hidden">
                {/* Funil Header */}
                <div 
                  className="p-4 flex items-center justify-between cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => setExpandedFunil(expandedFunil === funil.id ? null : funil.id)}
                >
                  <div className="flex items-center gap-3">
                    {expandedFunil === funil.id ? (
                      <ChevronDown className="h-5 w-5 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-5 w-5 text-muted-foreground" />
                    )}
                    <div 
                      className="h-4 w-4 rounded-full" 
                      style={{ backgroundColor: funil.cor }}
                    />
                    <div>
                      <h3 className="font-semibold text-foreground">{funil.nome}</h3>
                      {funil.descricao && (
                        <p className="text-sm text-muted-foreground">{funil.descricao}</p>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                      {funil.estagios.length} etapa{funil.estagios.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => openFunilModal(funil)}
                      className="p-2 rounded-lg hover:bg-muted transition-colors"
                    >
                      <Edit2 className="h-4 w-4 text-muted-foreground" />
                    </button>
                    <button
                      onClick={() => deleteFunil(funil.id)}
                      className="p-2 rounded-lg hover:bg-destructive/10 transition-colors"
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </button>
                  </div>
                </div>

                {/* Etapas */}
                {expandedFunil === funil.id && (
                  <div className="border-t border-border p-4 bg-muted/30">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="font-medium text-foreground">Etapas</h4>
                      <Button 
                        size="sm" 
                        variant="outline" 
                        onClick={() => openEstagioModal(funil.id)}
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        Nova Etapa
                      </Button>
                    </div>

                    {funil.estagios.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        Nenhuma etapa configurada
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {funil.estagios.map((estagio, index) => (
                          <div 
                            key={estagio.id} 
                            className="flex items-center justify-between p-3 bg-card rounded-lg border border-border"
                          >
                            <div className="flex items-center gap-3">
                              <div className="flex flex-col gap-1">
                                <button
                                  onClick={() => reorderEstagio(funil.id, estagio.id, 'up')}
                                  disabled={index === 0}
                                  className={cn(
                                    "p-0.5 rounded hover:bg-muted transition-colors",
                                    index === 0 && "opacity-30 cursor-not-allowed"
                                  )}
                                >
                                  <GripVertical className="h-3 w-3 text-muted-foreground rotate-180" />
                                </button>
                                <button
                                  onClick={() => reorderEstagio(funil.id, estagio.id, 'down')}
                                  disabled={index === funil.estagios.length - 1}
                                  className={cn(
                                    "p-0.5 rounded hover:bg-muted transition-colors",
                                    index === funil.estagios.length - 1 && "opacity-30 cursor-not-allowed"
                                  )}
                                >
                                  <GripVertical className="h-3 w-3 text-muted-foreground" />
                                </button>
                              </div>
                              <span className="text-sm text-muted-foreground w-6">{index + 1}.</span>
                              <div 
                                className="h-3 w-3 rounded-full" 
                                style={{ backgroundColor: estagio.cor }}
                              />
                              <span className="font-medium text-foreground">{estagio.nome}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => openEstagioModal(funil.id, estagio)}
                                className="p-2 rounded-lg hover:bg-muted transition-colors"
                              >
                                <Edit2 className="h-4 w-4 text-muted-foreground" />
                              </button>
                              <button
                                onClick={() => deleteEstagio(estagio.id)}
                                className="p-2 rounded-lg hover:bg-destructive/10 transition-colors"
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Modal Funil */}
      <Dialog open={funilModalOpen} onOpenChange={setFunilModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingFunil ? 'Editar Funil' : 'Novo Funil'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="funil-nome">Nome</Label>
              <Input
                id="funil-nome"
                value={funilForm.nome}
                onChange={(e) => setFunilForm({ ...funilForm, nome: e.target.value })}
                placeholder="Ex: Vendas B2B"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="funil-descricao">Descrição (opcional)</Label>
              <Textarea
                id="funil-descricao"
                value={funilForm.descricao}
                onChange={(e) => setFunilForm({ ...funilForm, descricao: e.target.value })}
                placeholder="Descreva o objetivo deste funil..."
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label>Cor</Label>
              <div className="flex flex-wrap gap-2">
                {CORES_PREDEFINIDAS.map((cor) => (
                  <button
                    key={cor}
                    type="button"
                    onClick={() => setFunilForm({ ...funilForm, cor })}
                    className={cn(
                      "h-8 w-8 rounded-full transition-all",
                      funilForm.cor === cor && "ring-2 ring-offset-2 ring-primary"
                    )}
                    style={{ backgroundColor: cor }}
                  />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFunilModalOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={saveFunil} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : editingFunil ? 'Salvar' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Etapa */}
      <Dialog open={estagioModalOpen} onOpenChange={setEstagioModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingEstagio ? 'Editar Etapa' : 'Nova Etapa'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="estagio-nome">Nome</Label>
              <Input
                id="estagio-nome"
                value={estagioForm.nome}
                onChange={(e) => setEstagioForm({ ...estagioForm, nome: e.target.value })}
                placeholder="Ex: Contato Inicial"
              />
            </div>
            <div className="space-y-2">
              <Label>Cor</Label>
              <div className="flex flex-wrap gap-2">
                {CORES_PREDEFINIDAS.map((cor) => (
                  <button
                    key={cor}
                    type="button"
                    onClick={() => setEstagioForm({ ...estagioForm, cor })}
                    className={cn(
                      "h-8 w-8 rounded-full transition-all",
                      estagioForm.cor === cor && "ring-2 ring-offset-2 ring-primary"
                    )}
                    style={{ backgroundColor: cor }}
                  />
                ))}
              </div>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
              <div className="space-y-1">
                <p className="font-medium text-foreground">Follow-up ativo</p>
                <p className="text-sm text-muted-foreground">
                  Se desativado, leads nesta etapa não receberão mensagens de follow-up
                </p>
              </div>
              <Switch 
                checked={estagioForm.followup_ativo} 
                onCheckedChange={(checked) => setEstagioForm({...estagioForm, followup_ativo: checked})} 
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEstagioModalOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={saveEstagio} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : editingEstagio ? 'Salvar' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Tag */}
      <Dialog open={tagModalOpen} onOpenChange={setTagModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingTag ? 'Editar Tag' : 'Nova Tag'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="tag-nome">Nome</Label>
              <Input
                id="tag-nome"
                value={tagForm.nome}
                onChange={(e) => setTagForm({ ...tagForm, nome: e.target.value })}
                placeholder="Ex: Lead Quente"
              />
            </div>
            <div className="space-y-2">
              <Label>Cor</Label>
              <div className="flex flex-wrap gap-2">
                {CORES_PREDEFINIDAS.map((cor) => (
                  <button
                    key={cor}
                    type="button"
                    onClick={() => setTagForm({ ...tagForm, cor })}
                    className={cn(
                      "h-8 w-8 rounded-full transition-all",
                      tagForm.cor === cor && "ring-2 ring-offset-2 ring-primary"
                    )}
                    style={{ backgroundColor: cor }}
                  />
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Preview</Label>
              <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
                <span 
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-sm font-medium text-white"
                  style={{ backgroundColor: tagForm.cor }}
                >
                  <Tag className="h-3 w-3" />
                  {tagForm.nome || 'Nome da tag'}
                </span>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTagModalOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={saveTag} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : editingTag ? 'Salvar' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
