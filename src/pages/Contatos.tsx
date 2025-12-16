import { useState, useEffect } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Search, Plus, User, Phone, Mail, MoreVertical, Loader2, Tag, X, ChevronDown, Check } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';

interface Contato {
  id: string;
  nome: string;
  telefone: string;
  email: string | null;
  avatar_url: string | null;
  tags: string[];
  created_at: string;
}

interface TagItem {
  id: string;
  nome: string;
  cor: string;
}

export default function Contatos() {
  const { usuario } = useAuth();
  const isMobile = useIsMobile();
  const [contatos, setContatos] = useState<Contato[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    nome: '',
    telefone: '',
    email: '',
  });
  const [tagsDisponiveis, setTagsDisponiveis] = useState<TagItem[]>([]);
  const [tagsSelecionadas, setTagsSelecionadas] = useState<string[]>([]);

  useEffect(() => {
    if (usuario?.conta_id) {
      fetchContatos();
      fetchTags();
    }
  }, [usuario]);

  const fetchTags = async () => {
    try {
      const { data, error } = await supabase
        .from('tags')
        .select('id, nome, cor')
        .order('nome');
      
      if (error) throw error;
      setTagsDisponiveis(data || []);
    } catch (error) {
      console.error('Erro ao buscar tags:', error);
    }
  };

  const fetchContatos = async () => {
    try {
      const { data, error } = await supabase
        .from('contatos')
        .select('*')
        .eq('conta_id', usuario!.conta_id)
        .order('nome');

      if (error) throw error;
      setContatos(data || []);
    } catch (error) {
      console.error('Erro ao buscar contatos:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddContato = async () => {
    if (!formData.nome || !formData.telefone) {
      toast.error('Preencha nome e telefone');
      return;
    }

    try {
      const { error } = await supabase.from('contatos').insert({
        conta_id: usuario!.conta_id,
        nome: formData.nome,
        telefone: formData.telefone,
        email: formData.email || null,
      });

      if (error) throw error;

      toast.success('Contato adicionado!');
      setShowModal(false);
      setFormData({ nome: '', telefone: '', email: '' });
      fetchContatos();
    } catch (error: any) {
      if (error.code === '23505') {
        toast.error('Este telefone já está cadastrado');
      } else {
        toast.error('Erro ao adicionar contato');
      }
    }
  };

  const toggleTagFilter = (tagNome: string) => {
    setTagsSelecionadas(prev => 
      prev.includes(tagNome)
        ? prev.filter(t => t !== tagNome)
        : [...prev, tagNome]
    );
  };

  const getTagColor = (tagNome: string) => {
    const tag = tagsDisponiveis.find(t => t.nome === tagNome);
    return tag?.cor || '#3b82f6';
  };

  const filteredContatos = contatos.filter((c) => {
    // Filtro de texto
    const matchesSearch = 
      c.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.telefone.includes(searchTerm) ||
      c.email?.toLowerCase().includes(searchTerm.toLowerCase());
    
    // Filtro de tags
    const matchesTags = tagsSelecionadas.length === 0 || 
      tagsSelecionadas.some(tag => c.tags?.includes(tag));
    
    return matchesSearch && matchesTags;
  });

  return (
    <MainLayout>
      <div className="space-y-4 md:space-y-6 animate-fade-in px-4 md:px-0">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground">Contatos</h1>
            <p className="text-sm md:text-base text-muted-foreground mt-1 hidden sm:block">
              Gerencie todos os seus contatos em um só lugar.
            </p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="h-10 px-4 rounded-lg bg-primary text-primary-foreground font-medium flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors"
          >
            <Plus className="h-5 w-5" />
            <span>{isMobile ? 'Novo' : 'Novo Contato'}</span>
          </button>
        </div>

        {/* Busca e Filtros */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Buscar..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full h-11 pl-11 pr-4 rounded-lg bg-card border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {/* Filtro de Tags */}
          {tagsDisponiveis.length > 0 && (
            <Popover>
              <PopoverTrigger asChild>
                <button className="h-10 px-4 rounded-lg border border-border bg-card hover:bg-muted flex items-center gap-2 text-sm transition-all">
                  <Tag className="h-4 w-4 text-muted-foreground" />
                  {tagsSelecionadas.length > 0 ? (
                    <div className="flex items-center gap-1.5">
                      {tagsSelecionadas.slice(0, 4).map((tagNome) => {
                        const tag = tagsDisponiveis.find(t => t.nome === tagNome);
                        return tag ? (
                          <div
                            key={tag.id}
                            className="h-4 w-4 rounded-full shrink-0 ring-2 ring-card"
                            style={{ backgroundColor: tag.cor }}
                            title={tag.nome}
                          />
                        ) : null;
                      })}
                      {tagsSelecionadas.length > 4 && (
                        <span className="text-xs text-muted-foreground">+{tagsSelecionadas.length - 4}</span>
                      )}
                    </div>
                  ) : (
                    <span className="text-foreground">Filtrar por tags</span>
                  )}
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-64 p-2 bg-popover border border-border" align="start">
                <div className="space-y-1 max-h-64 overflow-y-auto">
                  {tagsDisponiveis.map((tag) => {
                    const isSelected = tagsSelecionadas.includes(tag.nome);
                    return (
                      <button
                        key={tag.id}
                        onClick={() => toggleTagFilter(tag.nome)}
                        className={cn(
                          "w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all",
                          isSelected 
                            ? "bg-primary/10 text-foreground" 
                            : "hover:bg-muted text-foreground"
                        )}
                      >
                        <div 
                          className="h-3 w-3 rounded-full shrink-0"
                          style={{ backgroundColor: tag.cor }}
                        />
                        <span className="flex-1 text-left">{tag.nome}</span>
                        {isSelected && <Check className="h-4 w-4 text-primary" />}
                      </button>
                    );
                  })}
                </div>
                {tagsSelecionadas.length > 0 && (
                  <>
                    <div className="h-px bg-border my-2" />
                    <button
                      onClick={() => setTagsSelecionadas([])}
                      className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
                    >
                      <X className="h-4 w-4" />
                      Limpar seleção
                    </button>
                  </>
                )}
              </PopoverContent>
            </Popover>
          )}
        </div>

        {/* Lista */}
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : filteredContatos.length === 0 ? (
          <div className="text-center py-12 bg-card rounded-xl border border-border">
            <User className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
            <p className="text-lg text-muted-foreground">Nenhum contato encontrado</p>
            <button
              onClick={() => setShowModal(true)}
              className="mt-4 text-primary hover:underline"
            >
              Adicionar primeiro contato
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
            {filteredContatos.map((contato) => (
              <div
                key={contato.id}
                className="p-4 rounded-xl bg-card border border-border hover:border-primary/50 transition-all"
              >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      {contato.avatar_url ? (
                        <img
                          src={contato.avatar_url}
                          alt={contato.nome}
                          className="h-12 w-12 rounded-full object-cover"
                        />
                      ) : (
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/20 text-primary font-semibold text-lg">
                          {contato.nome.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div>
                      <h3 className="font-medium text-foreground">{contato.nome}</h3>
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Phone className="h-3 w-3" />
                        {contato.telefone}
                      </div>
                    </div>
                  </div>
                  <button className="p-1 rounded hover:bg-muted transition-colors">
                    <MoreVertical className="h-4 w-4 text-muted-foreground" />
                  </button>
                </div>

                {contato.email && (
                  <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
                    <Mail className="h-4 w-4" />
                    <span className="truncate">{contato.email}</span>
                  </div>
                )}

                {contato.tags && contato.tags.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1">
                    {contato.tags.map((tagNome, i) => (
                      <span
                        key={i}
                        className="px-2 py-0.5 rounded-full text-xs text-white"
                        style={{ backgroundColor: getTagColor(tagNome) }}
                      >
                        {tagNome}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Modal / Drawer */}
        {isMobile ? (
          <Drawer open={showModal} onOpenChange={setShowModal}>
            <DrawerContent className="px-4 pb-8">
              <DrawerHeader className="px-0">
                <DrawerTitle>Novo Contato</DrawerTitle>
              </DrawerHeader>
              <ContactForm 
                formData={formData}
                setFormData={setFormData}
                onSubmit={handleAddContato}
                onCancel={() => setShowModal(false)}
              />
            </DrawerContent>
          </Drawer>
        ) : (
          showModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
              <div className="w-full max-w-md bg-card rounded-2xl border border-border p-6 animate-scale-in">
                <h2 className="text-xl font-semibold text-foreground mb-6">Novo Contato</h2>
                <ContactForm 
                  formData={formData}
                  setFormData={setFormData}
                  onSubmit={handleAddContato}
                  onCancel={() => setShowModal(false)}
                />
              </div>
            </div>
          )
        )}
      </div>
    </MainLayout>
  );
}

// Contact Form Component
function ContactForm({ 
  formData, 
  setFormData, 
  onSubmit, 
  onCancel 
}: { 
  formData: { nome: string; telefone: string; email: string };
  setFormData: React.Dispatch<React.SetStateAction<{ nome: string; telefone: string; email: string }>>;
  onSubmit: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-foreground mb-2">Nome *</label>
        <input
          type="text"
          value={formData.nome}
          onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
          className="w-full h-12 px-4 rounded-lg bg-input border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          placeholder="Nome do contato"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-foreground mb-2">Telefone *</label>
        <input
          type="tel"
          value={formData.telefone}
          onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
          className="w-full h-12 px-4 rounded-lg bg-input border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          placeholder="+55 11 99999-9999"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-foreground mb-2">Email</label>
        <input
          type="email"
          value={formData.email}
          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          className="w-full h-12 px-4 rounded-lg bg-input border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          placeholder="email@exemplo.com"
        />
      </div>

      <div className="flex gap-3 pt-2">
        <button
          onClick={onCancel}
          className="flex-1 h-12 rounded-lg bg-muted text-foreground font-medium hover:bg-muted/80 transition-colors"
        >
          Cancelar
        </button>
        <button
          onClick={onSubmit}
          className="flex-1 h-12 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors"
        >
          Adicionar
        </button>
      </div>
    </div>
  );
}
