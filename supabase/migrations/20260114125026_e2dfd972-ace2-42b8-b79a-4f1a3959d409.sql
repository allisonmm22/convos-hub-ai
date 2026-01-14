-- Adicionar role super_admin para o usuário contato@2msolucoes.com.br
INSERT INTO public.user_roles (user_id, role)
VALUES ('ffd62ae5-101d-40d0-a01a-f208246c064d', 'super_admin')
ON CONFLICT (user_id, role) DO NOTHING;