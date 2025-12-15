-- Tabela para armazenar calendários Google conectados
CREATE TABLE public.calendarios_google (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conta_id UUID NOT NULL,
  nome TEXT NOT NULL,
  email_google TEXT NOT NULL,
  access_token TEXT,
  refresh_token TEXT,
  token_expiry TIMESTAMPTZ,
  calendar_id TEXT DEFAULT 'primary',
  cor TEXT DEFAULT '#4285F4',
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.calendarios_google ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Usuarios podem ver calendarios da conta"
ON public.calendarios_google FOR SELECT
USING (conta_id = get_user_conta_id());

CREATE POLICY "Usuarios podem gerenciar calendarios da conta"
ON public.calendarios_google FOR ALL
USING (conta_id = get_user_conta_id());

-- Trigger para updated_at
CREATE TRIGGER update_calendarios_google_updated_at
BEFORE UPDATE ON public.calendarios_google
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Index para performance
CREATE INDEX idx_calendarios_google_conta_id ON public.calendarios_google(conta_id);