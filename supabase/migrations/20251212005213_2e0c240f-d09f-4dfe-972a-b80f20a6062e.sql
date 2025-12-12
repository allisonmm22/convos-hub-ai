-- Adicionar colunas para suportar múltiplos agentes
ALTER TABLE public.agent_ia 
ADD COLUMN IF NOT EXISTS tipo text DEFAULT 'principal' CHECK (tipo IN ('principal', 'secundario')),
ADD COLUMN IF NOT EXISTS gatilho text,
ADD COLUMN IF NOT EXISTS descricao text;

-- Criar índice para busca
CREATE INDEX IF NOT EXISTS idx_agent_ia_conta_tipo ON public.agent_ia(conta_id, tipo);
CREATE INDEX IF NOT EXISTS idx_agent_ia_nome ON public.agent_ia(nome);

-- Permitir inserção de múltiplos agentes (remover constraint unique se existir)
-- A constraint atual é one-to-one por conta_id, precisamos permitir múltiplos
ALTER TABLE public.agent_ia DROP CONSTRAINT IF EXISTS agent_ia_conta_id_fkey;

-- Adicionar foreign key sem unique constraint
ALTER TABLE public.agent_ia 
ADD CONSTRAINT agent_ia_conta_id_fkey 
FOREIGN KEY (conta_id) REFERENCES public.contas(id) ON DELETE CASCADE;