-- Create notifications table
CREATE TABLE public.notificacoes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conta_id UUID NOT NULL REFERENCES public.contas(id) ON DELETE CASCADE,
  usuario_id UUID REFERENCES public.usuarios(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL DEFAULT 'info',
  titulo TEXT NOT NULL,
  mensagem TEXT,
  lida BOOLEAN NOT NULL DEFAULT false,
  link TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.notificacoes ENABLE ROW LEVEL SECURITY;

-- RLS policies - users can see notifications for their account or specifically for them
CREATE POLICY "Usuarios podem ver suas notificacoes" 
ON public.notificacoes 
FOR SELECT 
USING (
  conta_id = get_user_conta_id() AND 
  (usuario_id IS NULL OR usuario_id = get_current_usuario_id())
);

CREATE POLICY "Usuarios podem atualizar suas notificacoes" 
ON public.notificacoes 
FOR UPDATE 
USING (
  conta_id = get_user_conta_id() AND 
  (usuario_id IS NULL OR usuario_id = get_current_usuario_id())
);

CREATE POLICY "Usuarios podem inserir notificacoes" 
ON public.notificacoes 
FOR INSERT 
WITH CHECK (conta_id = get_user_conta_id());

-- Indexes
CREATE INDEX idx_notificacoes_usuario ON public.notificacoes(usuario_id);
CREATE INDEX idx_notificacoes_conta ON public.notificacoes(conta_id);
CREATE INDEX idx_notificacoes_lida ON public.notificacoes(lida);
CREATE INDEX idx_notificacoes_created ON public.notificacoes(created_at DESC);