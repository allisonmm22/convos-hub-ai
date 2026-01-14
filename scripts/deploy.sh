#!/bin/bash

# ===========================================
# SCRIPT DE DEPLOY/ATUALIZAÇÃO - ZapCRM
# ===========================================

set -e

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[✓]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[!]${NC} $1"; }
log_error() { echo -e "${RED}[✗]${NC} $1"; }

PROJECT_DIR="/var/www/zapcrm"

echo ""
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}              DEPLOY/ATUALIZAÇÃO - ZapCRM                   ${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo ""

cd "$PROJECT_DIR"

# Carregar variáveis do .env
if [ -f ".env" ]; then
    export $(grep -v '^#' .env | xargs)
    log_success "Variáveis carregadas do .env"
else
    log_error "Arquivo .env não encontrado!"
    exit 1
fi

# Verificar variáveis obrigatórias
if [ -z "$VITE_SUPABASE_URL" ]; then
    log_error "VITE_SUPABASE_URL não definido no .env"
    exit 1
fi

log_info "Supabase URL: $VITE_SUPABASE_URL"

# Verificar alterações locais
if ! git diff-index --quiet HEAD -- 2>/dev/null; then
    log_warning "Existem alterações locais não commitadas"
    read -p "Descartar alterações locais? (s/n): " DISCARD
    if [ "$DISCARD" == "s" ]; then
        git checkout -- .
        git clean -fd
    fi
fi

# Pull do repositório
log_info "Baixando atualizações..."
git pull origin main

# IMPORTANTE: Remover .env que veio do repo (mantém o local)
# O .env do repo tem credenciais do Lovable Cloud
rm -f .env.example 2>/dev/null || true

# Recriar o .env local (pode ter sido sobrescrito pelo git pull)
# Só recria se as variáveis ainda estão em memória
if [ -n "$VITE_SUPABASE_URL" ]; then
    log_info "Recriando .env com variáveis locais..."
    cat > "$PROJECT_DIR/.env" << EOF
# ZapCRM - Configuração de Produção
# Atualizado em: $(date)

VITE_SUPABASE_URL=${VITE_SUPABASE_URL}
VITE_SUPABASE_PUBLISHABLE_KEY=${VITE_SUPABASE_PUBLISHABLE_KEY}
VITE_SUPABASE_PROJECT_ID=${VITE_SUPABASE_PROJECT_ID}
SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_KEY}
EOF
    chmod 600 "$PROJECT_DIR/.env"
fi

# Parar containers
log_info "Parando containers..."
docker compose down

# Limpar imagens antigas
log_info "Limpando imagens antigas..."
docker system prune -f

# Rebuild com variáveis
log_info "Reconstruindo com variáveis do .env..."
docker compose build \
    --no-cache \
    --build-arg VITE_SUPABASE_URL="$VITE_SUPABASE_URL" \
    --build-arg VITE_SUPABASE_PUBLISHABLE_KEY="$VITE_SUPABASE_PUBLISHABLE_KEY" \
    --build-arg VITE_SUPABASE_PROJECT_ID="$VITE_SUPABASE_PROJECT_ID"

# Subir containers
log_info "Iniciando containers..."
docker compose up -d

# Aguardar
sleep 5

# Verificar
log_info "Verificando build..."
SUPABASE_DOMAIN=$(echo "$VITE_SUPABASE_URL" | sed -E 's|https?://([^/]+).*|\1|')

# Verificar URL correta
FOUND=$(docker exec zapcrm-frontend sh -c "grep -r --text '$SUPABASE_DOMAIN' /usr/share/nginx/html/assets/*.js 2>/dev/null | head -1" 2>/dev/null || true)

if [ -n "$FOUND" ]; then
    log_success "URL do Supabase confirmada no bundle ✓"
else
    log_warning "Verificação via grep não encontrou URL, verificando com strings..."
    FOUND_STRINGS=$(docker exec zapcrm-frontend sh -c "strings /usr/share/nginx/html/assets/*.js 2>/dev/null | grep -i 'supabase' | head -3" 2>/dev/null || true)
    if [ -n "$FOUND_STRINGS" ]; then
        log_success "Referências ao Supabase encontradas"
    fi
fi

# Verificar se URL antiga está presente
OLD_URL=$(docker exec zapcrm-frontend sh -c "grep -r --text 'wjzqolnmdqmmcxejmunn' /usr/share/nginx/html/assets/*.js 2>/dev/null | head -1" 2>/dev/null || true)
if [ -n "$OLD_URL" ]; then
    log_error "⚠️  URL antiga do Lovable Cloud ainda presente!"
else
    log_success "Nenhuma URL antiga do Lovable Cloud ✓"
fi

# Status
echo ""
log_success "Deploy concluído!"
echo ""
docker compose ps
echo ""
echo -e "Deploy finalizado em: ${YELLOW}$(date)${NC}"
