#!/bin/bash

# ===========================================
# SCRIPT DE DEPLOY/ATUALIZAÇÃO - ZapCRM
# Atualiza o sistema a partir do GitHub
# ===========================================

set -e

# Cores
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Diretório do projeto
PROJECT_DIR="/var/www/zapcrm"
cd $PROJECT_DIR

echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}              🚀 ZapCRM - Deploy/Atualização                ${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo ""

# Verificar se há alterações locais
if [[ -n $(git status --porcelain) ]]; then
    echo -e "${YELLOW}[AVISO] Existem alterações locais não commitadas${NC}"
    read -p "Deseja descartar alterações locais? (s/n): " DISCARD
    if [[ $DISCARD == "s" || $DISCARD == "S" ]]; then
        git checkout -- .
        echo -e "${GREEN}[OK] Alterações descartadas${NC}"
    else
        echo -e "${YELLOW}[AVISO] Continuando com alterações locais...${NC}"
    fi
fi

# Pull das atualizações
echo -e "${BLUE}[INFO] Baixando atualizações do GitHub...${NC}"
git pull origin main

# Parar containers
echo -e "${BLUE}[INFO] Parando containers...${NC}"
docker compose down

# Rebuild da imagem
echo -e "${BLUE}[INFO] Reconstruindo imagem Docker...${NC}"
docker compose build --no-cache

# Iniciar containers
echo -e "${BLUE}[INFO] Iniciando containers...${NC}"
docker compose up -d

# Limpar imagens antigas
echo -e "${BLUE}[INFO] Limpando imagens antigas...${NC}"
docker image prune -f

# ===========================================
# VERIFICAR/CRIAR SUPER ADMIN
# ===========================================
echo -e "${BLUE}[INFO] Verificando Super Admin...${NC}"

# Carregar variáveis do .env
if [ -f "$PROJECT_DIR/.env" ]; then
    source $PROJECT_DIR/.env
fi

if [ -n "$SUPABASE_SERVICE_ROLE_KEY" ] && [ -n "$VITE_SUPABASE_URL" ]; then
    # Credenciais padrão
    ADMIN_EMAIL="admin@admin.com"
    ADMIN_PASSWORD="123456"
    
    # Verificar se usuário existe
    USER_RESPONSE=$(curl -s -X POST \
      "${VITE_SUPABASE_URL}/auth/v1/admin/users" \
      -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
      -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
      -H "Content-Type: application/json" \
      -d "{
        \"email\": \"${ADMIN_EMAIL}\",
        \"password\": \"${ADMIN_PASSWORD}\",
        \"email_confirm\": true
      }" 2>/dev/null)
    
    if echo "$USER_RESPONSE" | grep -q '"id"'; then
        USER_ID=$(echo $USER_RESPONSE | grep -oP '"id"\s*:\s*"\K[^"]+' | head -1)
        
        if [ -n "$USER_ID" ] && [ ${#USER_ID} -eq 36 ]; then
            echo -e "${YELLOW}[INFO] Novo usuário detectado, configurando admin...${NC}"
            
            # Criar conta
            CONTA_RESPONSE=$(curl -s -X POST \
              "${VITE_SUPABASE_URL}/rest/v1/contas" \
              -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
              -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
              -H "Content-Type: application/json" \
              -H "Prefer: return=representation" \
              -d '{"nome": "Empresa Principal", "ativo": true}')
            
            CONTA_ID=$(echo $CONTA_RESPONSE | grep -oP '"id"\s*:\s*"\K[^"]+' | head -1)
            
            if [ -n "$CONTA_ID" ]; then
                # Criar usuário
                curl -s -X POST "${VITE_SUPABASE_URL}/rest/v1/usuarios" \
                  -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
                  -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
                  -H "Content-Type: application/json" \
                  -d "{\"user_id\": \"${USER_ID}\", \"conta_id\": \"${CONTA_ID}\", \"nome\": \"Administrador\", \"email\": \"${ADMIN_EMAIL}\", \"is_admin\": true}" > /dev/null
                
                # Criar role
                curl -s -X POST "${VITE_SUPABASE_URL}/rest/v1/user_roles" \
                  -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
                  -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
                  -H "Content-Type: application/json" \
                  -d "{\"user_id\": \"${USER_ID}\", \"role\": \"super_admin\"}" > /dev/null
                
                # Criar agente IA
                curl -s -X POST "${VITE_SUPABASE_URL}/rest/v1/agent_ia" \
                  -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
                  -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
                  -H "Content-Type: application/json" \
                  -d "{\"conta_id\": \"${CONTA_ID}\", \"nome\": \"Agente Padrão\", \"ativo\": false}" > /dev/null
                
                # Criar funil
                FUNIL_RESPONSE=$(curl -s -X POST "${VITE_SUPABASE_URL}/rest/v1/funis" \
                  -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
                  -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
                  -H "Content-Type: application/json" \
                  -H "Prefer: return=representation" \
                  -d "{\"conta_id\": \"${CONTA_ID}\", \"nome\": \"Funil Principal\"}")
                
                FUNIL_ID=$(echo $FUNIL_RESPONSE | grep -oP '"id"\s*:\s*"\K[^"]+' | head -1)
                
                if [ -n "$FUNIL_ID" ]; then
                    curl -s -X POST "${VITE_SUPABASE_URL}/rest/v1/estagios" \
                      -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
                      -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
                      -H "Content-Type: application/json" \
                      -d "[
                        {\"funil_id\": \"${FUNIL_ID}\", \"nome\": \"Novo Lead\", \"ordem\": 1, \"cor\": \"#3B82F6\", \"tipo\": \"novo\"},
                        {\"funil_id\": \"${FUNIL_ID}\", \"nome\": \"Qualificação\", \"ordem\": 2, \"cor\": \"#F59E0B\", \"tipo\": \"normal\"},
                        {\"funil_id\": \"${FUNIL_ID}\", \"nome\": \"Proposta\", \"ordem\": 3, \"cor\": \"#8B5CF6\", \"tipo\": \"normal\"},
                        {\"funil_id\": \"${FUNIL_ID}\", \"nome\": \"Negociação\", \"ordem\": 4, \"cor\": \"#EC4899\", \"tipo\": \"normal\"},
                        {\"funil_id\": \"${FUNIL_ID}\", \"nome\": \"Ganho\", \"ordem\": 5, \"cor\": \"#10B981\", \"tipo\": \"ganho\"},
                        {\"funil_id\": \"${FUNIL_ID}\", \"nome\": \"Perdido\", \"ordem\": 6, \"cor\": \"#EF4444\", \"tipo\": \"perdido\"}
                      ]" > /dev/null
                fi
                
                echo -e "${GREEN}[OK] Super Admin criado: admin@admin.com / 123456${NC}"
            fi
        fi
    else
        echo -e "${GREEN}[OK] Super Admin já existe${NC}"
    fi
else
    echo -e "${YELLOW}[AVISO] SUPABASE_SERVICE_ROLE_KEY não configurada, pulando criação de admin${NC}"
fi

# Verificar status
echo ""
echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}              ✅ Deploy concluído com sucesso!              ${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}"
echo ""

# Mostrar status
docker compose ps

echo ""
echo -e "Deploy finalizado em: ${YELLOW}$(date)${NC}"
echo ""
