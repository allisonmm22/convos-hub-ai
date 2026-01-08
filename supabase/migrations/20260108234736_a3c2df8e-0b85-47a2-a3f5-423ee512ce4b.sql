-- Criar tabela para armazenar valores dos campos personalizados por contato
CREATE TABLE public.contato_campos_valores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contato_id uuid NOT NULL REFERENCES public.contatos(id) ON DELETE CASCADE,
  campo_id uuid NOT NULL REFERENCES public.campos_personalizados(id) ON DELETE CASCADE,
  valor text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(contato_id, campo_id)
);

-- Enable RLS
ALTER TABLE public.contato_campos_valores ENABLE ROW LEVEL SECURITY;

-- Policy para ver valores
CREATE POLICY "Usuarios podem ver valores da conta"
  ON public.contato_campos_valores FOR SELECT
  USING (contato_id IN (
    SELECT id FROM public.contatos WHERE conta_id = get_user_conta_id()
  ));

-- Policy para gerenciar valores
CREATE POLICY "Usuarios podem gerenciar valores"
  ON public.contato_campos_valores FOR ALL
  USING (contato_id IN (
    SELECT id FROM public.contatos WHERE conta_id = get_user_conta_id()
  ));

-- Trigger para atualizar updated_at
CREATE TRIGGER update_contato_campos_valores_updated_at
  BEFORE UPDATE ON public.contato_campos_valores
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();