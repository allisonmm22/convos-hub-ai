#!/bin/bash

# ===========================================
# SCRIPT DE BACKUP - ZapCRM
# Backup de configurações e logs
# ===========================================

set -e

# Cores
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Configurações
PROJECT_DIR="/var/www/zapcrm"
BACKUP_DIR="/var/backups/zapcrm"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_NAME="zapcrm_backup_$DATE"

echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}              💾 ZapCRM - Backup                            ${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo ""

# Criar diretório de backup
mkdir -p $BACKUP_DIR

# ===========================================
# 1. BACKUP DE CONFIGURAÇÕES
# ===========================================
echo -e "${BLUE}[INFO] Fazendo backup das configurações...${NC}"

mkdir -p $BACKUP_DIR/$BACKUP_NAME

# Copiar arquivos de configuração
cp $PROJECT_DIR/.env $BACKUP_DIR/$BACKUP_NAME/.env 2>/dev/null || echo "  .env não encontrado"
cp $PROJECT_DIR/nginx.conf $BACKUP_DIR/$BACKUP_NAME/nginx.conf 2>/dev/null || echo "  nginx.conf não encontrado"
cp $PROJECT_DIR/docker-compose.yml $BACKUP_DIR/$BACKUP_NAME/docker-compose.yml 2>/dev/null || echo "  docker-compose.yml não encontrado"

# Copiar certificados SSL (sem a chave privada em texto)
if [ -d "$PROJECT_DIR/ssl" ]; then
    cp -r $PROJECT_DIR/ssl $BACKUP_DIR/$BACKUP_NAME/ssl 2>/dev/null || true
fi

echo -e "${GREEN}[OK] Configurações copiadas${NC}"

# ===========================================
# 2. BACKUP DE LOGS
# ===========================================
echo -e "${BLUE}[INFO] Fazendo backup dos logs...${NC}"

if [ -d "$PROJECT_DIR/logs" ]; then
    tar -czf $BACKUP_DIR/$BACKUP_NAME/logs.tar.gz -C $PROJECT_DIR logs 2>/dev/null || true
    echo -e "${GREEN}[OK] Logs compactados${NC}"
else
    echo -e "${YELLOW}[AVISO] Diretório de logs não encontrado${NC}"
fi

# ===========================================
# 3. COMPRIMIR BACKUP
# ===========================================
echo -e "${BLUE}[INFO] Comprimindo backup...${NC}"

cd $BACKUP_DIR
tar -czf $BACKUP_NAME.tar.gz $BACKUP_NAME
rm -rf $BACKUP_NAME

echo -e "${GREEN}[OK] Backup comprimido: $BACKUP_DIR/$BACKUP_NAME.tar.gz${NC}"

# ===========================================
# 4. LIMPAR BACKUPS ANTIGOS (manter últimos 7 dias)
# ===========================================
echo -e "${BLUE}[INFO] Limpando backups antigos...${NC}"

find $BACKUP_DIR -name "zapcrm_backup_*.tar.gz" -mtime +7 -delete 2>/dev/null || true

echo -e "${GREEN}[OK] Backups com mais de 7 dias removidos${NC}"

# ===========================================
# RELATÓRIO
# ===========================================
echo ""
echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}              ✅ Backup Concluído!                          ${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "Arquivo: ${YELLOW}$BACKUP_DIR/$BACKUP_NAME.tar.gz${NC}"
echo -e "Tamanho: ${YELLOW}$(du -h $BACKUP_DIR/$BACKUP_NAME.tar.gz | cut -f1)${NC}"
echo ""

# Listar backups existentes
echo -e "${BLUE}Backups disponíveis:${NC}"
ls -lh $BACKUP_DIR/*.tar.gz 2>/dev/null || echo "Nenhum backup encontrado"
echo ""
