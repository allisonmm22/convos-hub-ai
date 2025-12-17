-- Adicionar campos para armazenar dados da assinatura Stripe
ALTER TABLE public.contas ADD COLUMN IF NOT EXISTS stripe_customer_id text;
ALTER TABLE public.contas ADD COLUMN IF NOT EXISTS stripe_subscription_id text;
ALTER TABLE public.contas ADD COLUMN IF NOT EXISTS stripe_subscription_status text DEFAULT 'inactive';
ALTER TABLE public.contas ADD COLUMN IF NOT EXISTS stripe_current_period_start timestamptz;
ALTER TABLE public.contas ADD COLUMN IF NOT EXISTS stripe_current_period_end timestamptz;
ALTER TABLE public.contas ADD COLUMN IF NOT EXISTS stripe_cancel_at_period_end boolean DEFAULT false;