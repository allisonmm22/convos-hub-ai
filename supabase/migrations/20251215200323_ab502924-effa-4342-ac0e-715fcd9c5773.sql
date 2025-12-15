-- Add 'ativo' column to contas table (the enum value was already added)
-- Note: super_admin enum value was added in previous migration

-- Create is_super_admin function using text comparison instead
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role::text = 'super_admin'
  )
$$;

-- RLS Policies for super_admin access to contas
CREATE POLICY "Super admin pode ver todas as contas"
ON public.contas FOR SELECT
USING (is_super_admin());

CREATE POLICY "Super admin pode atualizar todas as contas"
ON public.contas FOR UPDATE
USING (is_super_admin());

-- RLS Policies for super_admin access to usuarios
CREATE POLICY "Super admin pode ver todos os usuarios"
ON public.usuarios FOR SELECT
USING (is_super_admin());

CREATE POLICY "Super admin pode atualizar todos os usuarios"
ON public.usuarios FOR UPDATE
USING (is_super_admin());

-- RLS Policies for super_admin access to conversas
CREATE POLICY "Super admin pode ver todas as conversas"
ON public.conversas FOR SELECT
USING (is_super_admin());

-- RLS Policies for super_admin access to mensagens
CREATE POLICY "Super admin pode ver todas as mensagens"
ON public.mensagens FOR SELECT
USING (is_super_admin());

-- RLS Policies for super_admin access to negociacoes
CREATE POLICY "Super admin pode ver todas as negociacoes"
ON public.negociacoes FOR SELECT
USING (is_super_admin());

-- RLS Policies for super_admin access to contatos
CREATE POLICY "Super admin pode ver todos os contatos"
ON public.contatos FOR SELECT
USING (is_super_admin());

-- RLS Policies for super_admin access to user_roles
CREATE POLICY "Super admin pode gerenciar todas as roles"
ON public.user_roles FOR ALL
USING (is_super_admin());