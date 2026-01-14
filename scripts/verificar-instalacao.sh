#!/bin/bash

# ===========================================
# VERIFICADOR DE INSTALAÇÃO - ZapCRM
# ===========================================

set -e

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

PROJECT_DIR="/var/www/zapcrm"

echo ""
echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}           VERIFICAÇÃO DE INSTALAÇÃO - ZapCRM              ${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
echo ""

# Contadores
PASSED=0
FAILED=0
WARNINGS=0

check_pass() {
    echo -e "${GREEN}[✓]${NC} $1"
    ((PASSED++))
}

check_fail() {
    echo -e "${RED}[✗]${NC} $1"
    ((FAILED++))
}

check_warn() {
    echo -e "${YELLOW}[!]${NC} $1"
    ((WARNINGS++))
}

# ===========================================
# VERIFICAÇÕES
# ===========================================

echo -e "${BLUE}1. VERIFICANDO DOCKER${NC}"
echo "-------------------------------------------"

# Docker rodando
if systemctl is-active --quiet docker; then
    check_pass "Docker está rodando"
else
    check_fail "Docker não está rodando"
fi

# Container frontend
if docker ps | grep -q zapcrm-frontend; then
    check_pass "Container zapcrm-frontend está rodando"
else
    check_fail "Container zapcrm-frontend não está rodando"
fi

# Container health
HEALTH=$(docker inspect --format='{{.State.Health.Status}}' zapcrm-frontend 2>/dev/null || echo "unknown")
if [ "$HEALTH" == "healthy" ]; then
    check_pass "Container está saudável (healthy)"
elif [ "$HEALTH" == "starting" ]; then
    check_warn "Container ainda iniciando..."
else
    check_warn "Health check: $HEALTH"
fi

echo ""
echo -e "${BLUE}2. VERIFICANDO ARQUIVOS${NC}"
echo "-------------------------------------------"

# .env existe
if [ -f "$PROJECT_DIR/.env" ]; then
    check_pass "Arquivo .env existe"
    
    # Verificar conteúdo
    if grep -q "VITE_SUPABASE_URL" "$PROJECT_DIR/.env"; then
        SUPABASE_URL=$(grep "VITE_SUPABASE_URL" "$PROJECT_DIR/.env" | cut -d'=' -f2)
        check_pass "VITE_SUPABASE_URL configurado: $SUPABASE_URL"
    else
        check_fail "VITE_SUPABASE_URL não configurado"
    fi
else
    check_fail "Arquivo .env não existe"
fi

# nginx.conf
if [ -f "$PROJECT_DIR/nginx.conf" ]; then
    check_pass "nginx.conf existe"
else
    check_fail "nginx.conf não existe"
fi

echo ""
echo -e "${BLUE}3. VERIFICANDO BUNDLE${NC}"
echo "-------------------------------------------"

# Verificar se URL está no bundle
if [ -n "$SUPABASE_URL" ]; then
    SUPABASE_DOMAIN=$(echo "$SUPABASE_URL" | sed -E 's|https?://([^/]+).*|\1|')
    
    FOUND=$(docker exec zapcrm-frontend sh -c "grep -r --text '$SUPABASE_DOMAIN' /usr/share/nginx/html/assets/*.js 2>/dev/null | head -1" 2>/dev/null || true)
    
    if [ -n "$FOUND" ]; then
        check_pass "URL do Supabase encontrada no bundle"
    else
        check_warn "URL não encontrada via grep, verificando com strings..."
        FOUND_STRINGS=$(docker exec zapcrm-frontend sh -c "strings /usr/share/nginx/html/assets/*.js 2>/dev/null | grep -i 'supabase' | head -1" 2>/dev/null || true)
        if [ -n "$FOUND_STRINGS" ]; then
            check_pass "Referências ao Supabase encontradas: ${FOUND_STRINGS:0:50}..."
        else
            check_fail "Nenhuma referência ao Supabase no bundle"
        fi
    fi
    
    # Verificar se URL antiga do Lovable Cloud está presente
    OLD_URL=$(docker exec zapcrm-frontend sh -c "grep -r --text 'wjzqolnmdqmmcxejmunn' /usr/share/nginx/html/assets/*.js 2>/dev/null | head -1" 2>/dev/null || true)
    if [ -n "$OLD_URL" ]; then
        check_fail "⚠️  URL ANTIGA DO LOVABLE CLOUD ENCONTRADA! Rebuild necessário."
    else
        check_pass "Nenhuma URL antiga do Lovable Cloud"
    fi
fi

echo ""
echo -e "${BLUE}4. VERIFICANDO CONECTIVIDADE${NC}"
echo "-------------------------------------------"

# Teste HTTP local
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost/health 2>/dev/null || echo "000")
if [ "$HTTP_STATUS" == "200" ]; then
    check_pass "Nginx respondendo em localhost"
else
    check_fail "Nginx não respondendo (status: $HTTP_STATUS)"
fi

# Teste de conectividade com Supabase
if [ -n "$SUPABASE_URL" ]; then
    SUPA_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "${SUPABASE_URL}/rest/v1/" 2>/dev/null || echo "000")
    if [ "$SUPA_STATUS" == "200" ] || [ "$SUPA_STATUS" == "401" ]; then
        check_pass "Supabase acessível (status: $SUPA_STATUS)"
    else
        check_fail "Supabase não acessível (status: $SUPA_STATUS)"
    fi
fi

echo ""
echo -e "${BLUE}5. VERIFICANDO SSL${NC}"
echo "-------------------------------------------"

if [ -f "$PROJECT_DIR/ssl/fullchain.pem" ]; then
    check_pass "Certificado SSL existe"
    
    # Verificar validade
    EXPIRY=$(openssl x509 -enddate -noout -in "$PROJECT_DIR/ssl/fullchain.pem" 2>/dev/null | cut -d= -f2)
    if [ -n "$EXPIRY" ]; then
        check_pass "Certificado válido até: $EXPIRY"
    fi
else
    check_warn "Certificado SSL não configurado (HTTP only)"
fi

echo ""
echo -e "${BLUE}6. VERIFICANDO FIREWALL${NC}"
echo "-------------------------------------------"

if ufw status | grep -q "Status: active"; then
    check_pass "UFW ativo"
    
    if ufw status | grep -q "80/tcp"; then
        check_pass "Porta 80 liberada"
    else
        check_warn "Porta 80 não liberada no UFW"
    fi
    
    if ufw status | grep -q "443/tcp"; then
        check_pass "Porta 443 liberada"
    else
        check_warn "Porta 443 não liberada no UFW"
    fi
else
    check_warn "UFW não está ativo"
fi

# ===========================================
# RESUMO
# ===========================================

echo ""
echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}                        RESUMO                              ${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "   ${GREEN}Passou:${NC}    $PASSED"
echo -e "   ${YELLOW}Avisos:${NC}    $WARNINGS"
echo -e "   ${RED}Falhou:${NC}    $FAILED"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✓ Instalação OK!${NC}"
    exit 0
else
    echo -e "${RED}✗ Problemas encontrados. Verifique os itens acima.${NC}"
    exit 1
fi
