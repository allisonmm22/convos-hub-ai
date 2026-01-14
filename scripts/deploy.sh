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
