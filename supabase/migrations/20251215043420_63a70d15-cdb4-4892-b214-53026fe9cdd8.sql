-- Enum para roles
CREATE TYPE public.app_role AS ENUM ('admin', 'atendente');

-- Tabela de roles (separada para segurança)
CREATE TABLE public.user_roles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL,
    created_at timestamptz DEFAULT now(),
    UNIQUE (user_id, role)
);

-- Enable RLS
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Tabela de configurações do atendente
CREATE TABLE public.atendente_config (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id uuid REFERENCES public.usuarios(id) ON DELETE CASCADE NOT NULL UNIQUE,
    ver_todas_conversas boolean DEFAULT false,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.atendente_config ENABLE ROW LEVEL SECURITY;

-- Função para verificar role (SECURITY DEFINER para evitar recursão RLS)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Função para verificar se atendente pode ver todas conversas
CREATE OR REPLACE FUNCTION public.atendente_ver_todas(_usuario_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT ver_todas_conversas FROM public.atendente_config WHERE usuario_id = _usuario_id),
    false
  )
$$;

-- Função para obter usuario_id do usuário atual
CREATE OR REPLACE FUNCTION public.get_current_usuario_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.usuarios WHERE user_id = auth.uid() LIMIT 1
$$;

-- RLS para user_roles: apenas admins podem gerenciar
CREATE POLICY "Admins podem ver roles da conta"
ON public.user_roles
FOR SELECT
TO authenticated
USING (
  user_id IN (
    SELECT u.user_id FROM public.usuarios u 
    WHERE u.conta_id = get_user_conta_id()
  )
);

CREATE POLICY "Admins podem inserir roles"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin')
  AND user_id IN (
    SELECT u.user_id FROM public.usuarios u 
    WHERE u.conta_id = get_user_conta_id()
  )
);

CREATE POLICY "Admins podem atualizar roles"
ON public.user_roles
FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'admin')
  AND user_id IN (
    SELECT u.user_id FROM public.usuarios u 
    WHERE u.conta_id = get_user_conta_id()
  )
);

CREATE POLICY "Admins podem deletar roles"
ON public.user_roles
FOR DELETE
TO authenticated
USING (
  has_role(auth.uid(), 'admin')
  AND user_id IN (
    SELECT u.user_id FROM public.usuarios u 
    WHERE u.conta_id = get_user_conta_id()
  )
);

-- RLS para atendente_config
CREATE POLICY "Usuarios podem ver config de atendentes da conta"
ON public.atendente_config
FOR SELECT
TO authenticated
USING (
  usuario_id IN (
    SELECT id FROM public.usuarios WHERE conta_id = get_user_conta_id()
  )
);

CREATE POLICY "Admins podem gerenciar config de atendentes"
ON public.atendente_config
FOR ALL
TO authenticated
USING (
  has_role(auth.uid(), 'admin')
  AND usuario_id IN (
    SELECT id FROM public.usuarios WHERE conta_id = get_user_conta_id()
  )
);

-- Atualizar RLS de conversas para considerar permissões
DROP POLICY IF EXISTS "Usuarios podem ver conversas da conta" ON public.conversas;

CREATE POLICY "Usuarios podem ver conversas da conta"
ON public.conversas
FOR SELECT
TO authenticated
USING (
  conta_id = get_user_conta_id()
  AND (
    -- Admins veem tudo
    has_role(auth.uid(), 'admin')
    -- Atendentes com ver_todas_conversas veem tudo
    OR atendente_ver_todas(get_current_usuario_id())
    -- Atendentes veem apenas conversas atribuídas a eles
    OR atendente_id = get_current_usuario_id()
    -- Ou conversas sem atendente atribuído
    OR atendente_id IS NULL
  )
);

-- Trigger para atualizar updated_at em atendente_config
CREATE TRIGGER update_atendente_config_updated_at
BEFORE UPDATE ON public.atendente_config
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Migrar usuários existentes: admins (is_admin=true) recebem role admin
INSERT INTO public.user_roles (user_id, role)
SELECT user_id, 'admin'::app_role
FROM public.usuarios
WHERE is_admin = true
ON CONFLICT (user_id, role) DO NOTHING;

-- Usuários não-admin recebem role atendente
INSERT INTO public.user_roles (user_id, role)
SELECT user_id, 'atendente'::app_role
FROM public.usuarios
WHERE is_admin = false OR is_admin IS NULL
ON CONFLICT (user_id, role) DO NOTHING;