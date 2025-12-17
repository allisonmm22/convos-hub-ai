-- Tabela para armazenar configurações da plataforma (apenas super admin)
CREATE TABLE public.configuracoes_plataforma (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chave text UNIQUE NOT NULL,
  valor text,
  descricao text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.configuracoes_plataforma ENABLE ROW LEVEL SECURITY;

-- Apenas super admin pode acessar
CREATE POLICY "Super admin pode gerenciar configuracoes"
  ON public.configuracoes_plataforma
  FOR ALL
  USING (public.is_super_admin());

-- Trigger para updated_at
CREATE TRIGGER update_configuracoes_plataforma_updated_at
  BEFORE UPDATE ON public.configuracoes_plataforma
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Inserir configurações iniciais do Stripe
INSERT INTO public.configuracoes_plataforma (chave, valor, descricao) VALUES
  ('stripe_secret_key', '', 'Chave secreta do Stripe (sk_test_... ou sk_live_...)'),
  ('stripe_webhook_secret', '', 'Secret do webhook do Stripe (whsec_...)'),
  ('stripe_mode', 'test', 'Modo do Stripe: test ou live');