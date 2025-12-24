-- Tabela para grupos de campos personalizados
CREATE TABLE public.campos_personalizados_grupos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conta_id UUID NOT NULL REFERENCES public.contas(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  ordem INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela para campos personalizados
CREATE TABLE public.campos_personalizados (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conta_id UUID NOT NULL REFERENCES public.contas(id) ON DELETE CASCADE,
  grupo_id UUID REFERENCES public.campos_personalizados_grupos(id) ON DELETE SET NULL,
  nome TEXT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'texto',
  opcoes JSONB DEFAULT '[]'::jsonb,
  obrigatorio BOOLEAN DEFAULT false,
  ordem INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.campos_personalizados_grupos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campos_personalizados ENABLE ROW LEVEL SECURITY;

-- Policies para grupos
CREATE POLICY "Usuarios podem ver grupos da conta"
ON public.campos_personalizados_grupos
FOR SELECT
USING (conta_id = get_user_conta_id());

CREATE POLICY "Usuarios podem gerenciar grupos da conta"
ON public.campos_personalizados_grupos
FOR ALL
USING (conta_id = get_user_conta_id());

-- Policies para campos
CREATE POLICY "Usuarios podem ver campos da conta"
ON public.campos_personalizados
FOR SELECT
USING (conta_id = get_user_conta_id());

CREATE POLICY "Usuarios podem gerenciar campos da conta"
ON public.campos_personalizados
FOR ALL
USING (conta_id = get_user_conta_id());

-- Trigger para updated_at
CREATE TRIGGER update_campos_personalizados_grupos_updated_at
BEFORE UPDATE ON public.campos_personalizados_grupos
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_campos_personalizados_updated_at
BEFORE UPDATE ON public.campos_personalizados
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();