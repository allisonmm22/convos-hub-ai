-- Remover apenas a role super_admin do usuário admin@exemplo.com
-- Mantendo a role 'admin' intacta
DELETE FROM user_roles 
WHERE user_id = '84eb54fc-e28c-4a95-a2a3-1e003edc2e59' 
  AND role = 'super_admin';