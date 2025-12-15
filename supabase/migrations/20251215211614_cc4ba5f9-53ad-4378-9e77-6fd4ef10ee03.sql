-- Create planos table
CREATE TABLE public.planos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  descricao text,
  limite_usuarios integer NOT NULL DEFAULT 1,
  limite_agentes integer NOT NULL DEFAULT 1,
  limite_funis integer NOT NULL DEFAULT 1,
  limite_conexoes_whatsapp integer NOT NULL DEFAULT 1,
  preco_mensal numeric(10,2) DEFAULT 0,
  ativo boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.planos ENABLE ROW LEVEL SECURITY;

-- Super admin can manage all plans
CREATE POLICY "Super admin pode gerenciar planos"
  ON public.planos FOR ALL
  USING (is_super_admin());

-- Users can view active plans
CREATE POLICY "Usuarios podem ver planos ativos"
  ON public.planos FOR SELECT
  USING (ativo = true);

-- Add plano_id to contas table
ALTER TABLE public.contas 
ADD COLUMN plano_id uuid REFERENCES public.planos(id);

-- Insert default plans
INSERT INTO public.planos (nome, descricao, limite_usuarios, limite_agentes, limite_funis, limite_conexoes_whatsapp, preco_mensal) VALUES
  ('Starter', 'Ideal para começar', 2, 1, 1, 1, 97.00),
  ('Pro', 'Para equipes em crescimento', 5, 3, 3, 2, 197.00),
  ('Business', 'Para empresas', 15, 10, 10, 5, 497.00),
  ('Enterprise', 'Sem limites', 999, 999, 999, 999, 997.00);

-- Create trigger for updated_at
CREATE TRIGGER update_planos_updated_at
  BEFORE UPDATE ON public.planos
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();