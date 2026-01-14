#!/bin/bash

# ===========================================
# SCRIPT DE RENOVAÇÃO SSL - ZapCRM
# Renova certificados Let's Encrypt
# ===========================================

set -e

# Cores
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Configurações
PROJECT_DIR="/var/www/zapcrm"
LOG_FILE="/var/log/zapcrm-ssl-renew.log"

echo "═══════════════════════════════════════════════" >> $LOG_FILE
echo "[$(date)] Iniciando renovação de SSL" >> $LOG_FILE

# Tentar renovar certificados
if certbot renew --quiet; then
    echo "[$(date)] Certificados renovados com sucesso" >> $LOG_FILE
    
    # Obter domínio do certificado
    DOMAIN=$(ls /etc/letsencrypt/live/ | head -1)
    
    if [ -n "$DOMAIN" ]; then
        # Copiar novos certificados
        cp /etc/letsencrypt/live/$DOMAIN/fullchain.pem $PROJECT_DIR/ssl/
        cp /etc/letsencrypt/live/$DOMAIN/privkey.pem $PROJECT_DIR/ssl/
        chmod 600 $PROJECT_DIR/ssl/*.pem
        
        echo "[$(date)] Certificados copiados para $PROJECT_DIR/ssl/" >> $LOG_FILE
        
        # Reiniciar container
        cd $PROJECT_DIR
        docker compose restart
        
        echo "[$(date)] Container reiniciado" >> $LOG_FILE
        echo -e "${GREEN}[OK] SSL renovado e container reiniciado${NC}"
    fi
else
    echo "[$(date)] Nenhum certificado precisava de renovação" >> $LOG_FILE
    echo -e "${YELLOW}[INFO] Nenhum certificado precisava de renovação${NC}"
fi

echo "═══════════════════════════════════════════════" >> $LOG_FILE
