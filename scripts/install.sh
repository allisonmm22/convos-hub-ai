#!/bin/bash

# ===========================================
# INSTALADOR ZAPCRM - VPS Ubuntu/Debian
# Versão 2.0 - Instalação Completa
# ===========================================

set -e

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Funções de log
log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[✓]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[!]${NC} $1"; }
log_error() { echo -e "${RED}[✗]${NC} $1"; }

# Banner
show_banner() {
    echo -e "${CYAN}"
    echo "╔═══════════════════════════════════════════════════════════╗"
    echo "║                                                           ║"
    echo "║     ███████╗ █████╗ ██████╗  ██████╗██████╗ ███╗   ███╗   ║"
    echo "║     ╚══███╔╝██╔══██╗██╔══██╗██╔════╝██╔══██╗████╗ ████║   ║"
    echo "║       ███╔╝ ███████║██████╔╝██║     ██████╔╝██╔████╔██║   ║"
    echo "║      ███╔╝  ██╔══██║██╔═══╝ ██║     ██╔══██╗██║╚██╔╝██║   ║"
    echo "║     ███████╗██║  ██║██║     ╚██████╗██║  ██║██║ ╚═╝ ██║   ║"
    echo "║     ╚══════╝╚═╝  ╚═╝╚═╝      ╚═════╝╚═╝  ╚═╝╚═╝     ╚═╝   ║"
    echo "║                                                           ║"
    echo "║           Instalador Automático v2.0                      ║"
    echo "║                                                           ║"
    echo "╚═══════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
}

# Verificar se é root
check_root() {
    if [ "$EUID" -ne 0 ]; then
        log_error "Este script deve ser executado como root (sudo)"
        exit 1
    fi
}

# Variáveis globais
PROJECT_DIR="/var/www/zapcrm"
GITHUB_REPO="https://github.com/cognityx-dev/zapcrm.git"

# ===========================================
# COLETA DE DADOS
# ===========================================

collect_data() {
    echo ""
    echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
    echo -e "${CYAN}                   CONFIGURAÇÃO INICIAL                     ${NC}"
    echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
    echo ""
    
    # Domínio
    echo -e "${YELLOW}1. DOMÍNIO${NC}"
    read -p "   Digite o domínio do ZapCRM (ex: app.seudominio.com.br): " DOMAIN
    if [ -z "$DOMAIN" ]; then
        log_error "Domínio é obrigatório!"
        exit 1
    fi
    
    # Email para SSL
    echo ""
    echo -e "${YELLOW}2. EMAIL PARA SSL${NC}"
    read -p "   Digite seu email (para certificado SSL): " EMAIL
    if [ -z "$EMAIL" ]; then
        log_error "Email é obrigatório!"
        exit 1
    fi
    
    # Tipo de Supabase
    echo ""
    echo -e "${YELLOW}3. TIPO DE SUPABASE${NC}"
    echo "   [1] Supabase Cloud (supabase.co)"
    echo "   [2] Supabase Self-Hosted (seu próprio servidor)"
    read -p "   Escolha (1 ou 2): " SUPABASE_TYPE
    
    # URL do Supabase
    echo ""
    echo -e "${YELLOW}4. URL DO SUPABASE${NC}"
    if [ "$SUPABASE_TYPE" == "1" ]; then
        echo "   Formato: https://XXXXX.supabase.co"
        read -p "   URL do projeto Supabase: " SUPABASE_URL
    else
        echo "   Formato: https://supabase.seudominio.com.br"
        read -p "   URL do Supabase Self-Hosted: " SUPABASE_URL
    fi
    
    if [ -z "$SUPABASE_URL" ]; then
        log_error "URL do Supabase é obrigatória!"
        exit 1
    fi
    
    # Validar URL
    if [[ ! "$SUPABASE_URL" =~ ^https:// ]]; then
        log_error "URL deve começar com https://"
        exit 1
    fi
    
    # Anon Key
    echo ""
    echo -e "${YELLOW}5. SUPABASE ANON KEY${NC}"
    echo "   (Encontrada em Project Settings > API > anon public)"
    read -p "   Anon Key: " SUPABASE_ANON_KEY
    if [ -z "$SUPABASE_ANON_KEY" ]; then
        log_error "Anon Key é obrigatória!"
        exit 1
    fi
    
    # Service Role Key
    echo ""
    echo -e "${YELLOW}6. SUPABASE SERVICE ROLE KEY${NC}"
    echo "   (Encontrada em Project Settings > API > service_role)"
    read -sp "   Service Role Key (oculto): " SUPABASE_SERVICE_ROLE_KEY
    echo ""
    if [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
        log_error "Service Role Key é obrigatória!"
        exit 1
    fi
    
    # Project ID
    echo ""
    echo -e "${YELLOW}7. SUPABASE PROJECT ID${NC}"
    echo "   (Parte da URL do projeto, ex: para https://xxx.supabase.co, o ID é xxx)"
    read -p "   Project ID: " SUPABASE_PROJECT_ID
    if [ -z "$SUPABASE_PROJECT_ID" ]; then
        log_error "Project ID é obrigatório!"
        exit 1
    fi
    
    # Super Admin
    echo ""
    echo -e "${YELLOW}8. SUPER ADMIN${NC}"
    echo "   Credenciais do administrador principal do sistema"
    read -p "   Nome da Empresa: " ADMIN_EMPRESA
    ADMIN_EMPRESA=${ADMIN_EMPRESA:-"Empresa Principal"}
    
    read -p "   Nome do Usuário: " ADMIN_NOME
    ADMIN_NOME=${ADMIN_NOME:-"Administrador"}
    
    read -p "   Email do Admin: " ADMIN_EMAIL
    if [ -z "$ADMIN_EMAIL" ]; then
        log_error "Email do admin é obrigatório!"
        exit 1
    fi
    
    read -sp "   Senha do Admin (mínimo 6 caracteres): " ADMIN_SENHA
    echo ""
    
    if [ ${#ADMIN_SENHA} -lt 6 ]; then
        log_error "Senha deve ter no mínimo 6 caracteres!"
        exit 1
    fi
    
    # Confirmação
    echo ""
    echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
    echo -e "${CYAN}                   CONFIRME OS DADOS                        ${NC}"
    echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
    echo ""
    echo -e "   Domínio:        ${GREEN}$DOMAIN${NC}"
    echo -e "   Email SSL:      ${GREEN}$EMAIL${NC}"
    echo -e "   Supabase URL:   ${GREEN}$SUPABASE_URL${NC}"
    echo -e "   Project ID:     ${GREEN}$SUPABASE_PROJECT_ID${NC}"
    echo -e "   Admin Email:    ${GREEN}$ADMIN_EMAIL${NC}"
    echo -e "   Empresa:        ${GREEN}$ADMIN_EMPRESA${NC}"
    echo ""
    read -p "Os dados estão corretos? (s/n): " CONFIRM
    
    if [ "$CONFIRM" != "s" ] && [ "$CONFIRM" != "S" ]; then
        log_warning "Instalação cancelada. Execute novamente."
        exit 0
    fi
}

# ===========================================
# INSTALAÇÃO DO SISTEMA
# ===========================================

install_dependencies() {
    log_info "Atualizando sistema..."
    apt-get update -qq
    apt-get upgrade -y -qq
    
    log_info "Instalando dependências..."
    apt-get install -y -qq \
        apt-transport-https \
        ca-certificates \
        curl \
        gnupg \
        lsb-release \
        git \
        ufw \
        fail2ban \
        jq \
        certbot \
        uuid-runtime
    
    log_success "Dependências instaladas"
}

install_docker() {
    if command -v docker &> /dev/null; then
        log_success "Docker já instalado"
        return
    fi
    
    log_info "Instalando Docker..."
    
    # Remover versões antigas
    apt-get remove -y docker docker-engine docker.io containerd runc 2>/dev/null || true
    
    # Instalar Docker
    curl -fsSL https://get.docker.com | sh
    
    # Instalar Docker Compose
    apt-get install -y docker-compose-plugin
    
    # Iniciar Docker
    systemctl start docker
    systemctl enable docker
    
    log_success "Docker instalado"
}

configure_firewall() {
    log_info "Configurando firewall..."
    
    ufw default deny incoming
    ufw default allow outgoing
    ufw allow ssh
    ufw allow 80/tcp
    ufw allow 443/tcp
    
    echo "y" | ufw enable
    
    log_success "Firewall configurado"
}

configure_fail2ban() {
    log_info "Configurando Fail2ban..."
    
    cat > /etc/fail2ban/jail.local << 'EOF'
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 5

[sshd]
enabled = true
port = ssh
filter = sshd
logpath = /var/log/auth.log
maxretry = 3

[nginx-http-auth]
enabled = true
filter = nginx-http-auth
port = http,https
logpath = /var/log/nginx/error.log
EOF
    
    systemctl restart fail2ban
    systemctl enable fail2ban
    
    log_success "Fail2ban configurado"
}

# ===========================================
# CLONE E CONFIGURAÇÃO DO PROJETO
# ===========================================

setup_project() {
    log_info "Configurando projeto..."
    
    # Remover diretório existente
    if [ -d "$PROJECT_DIR" ]; then
        rm -rf "$PROJECT_DIR"
    fi
    
    # Clonar repositório
    git clone "$GITHUB_REPO" "$PROJECT_DIR"
    cd "$PROJECT_DIR"
    
    # IMPORTANTE: Remover .env do repositório para evitar conflitos
    rm -f .env .env.local .env.production 2>/dev/null || true
    
    log_success "Repositório clonado"
}

create_env_file() {
    log_info "Criando arquivo .env..."
    
    cat > "$PROJECT_DIR/.env" << EOF
# ===========================================
# ZapCRM - Configuração de Produção
# Gerado em: $(date)
# ===========================================

# Supabase
VITE_SUPABASE_URL=${SUPABASE_URL}
VITE_SUPABASE_PUBLISHABLE_KEY=${SUPABASE_ANON_KEY}
VITE_SUPABASE_PROJECT_ID=${SUPABASE_PROJECT_ID}

# Para uso em scripts (não exposto no frontend)
SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_KEY}
EOF
    
    chmod 600 "$PROJECT_DIR/.env"
    log_success "Arquivo .env criado"
}

configure_nginx() {
    log_info "Configurando Nginx..."
    
    # Extrair domínio do Supabase para CSP
    SUPABASE_DOMAIN=$(echo "$SUPABASE_URL" | sed -E 's|https?://([^/]+).*|\1|')
    
    # Criar nginx.conf com CSP correto
    cat > "$PROJECT_DIR/nginx.conf" << EOF
# ===========================================
# NGINX - ZapCRM Production
# Gerado automaticamente pelo instalador
# ===========================================

# Rate limiting
limit_req_zone \$binary_remote_addr zone=api_limit:10m rate=10r/s;
limit_conn_zone \$binary_remote_addr zone=conn_limit:10m;

server {
    listen 80;
    server_name ${DOMAIN};
    
    root /usr/share/nginx/html;
    index index.html;
    
    # Gzip
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_proxied any;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/xml+rss application/json;
    gzip_comp_level 6;
    
    # Security Headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    
    # CSP com domínio do Supabase
    add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: blob: https:; connect-src 'self' ${SUPABASE_URL} wss://${SUPABASE_DOMAIN} https://*.supabase.co wss://*.supabase.co; media-src 'self' blob: ${SUPABASE_URL}; worker-src 'self' blob:; frame-ancestors 'self';" always;
    
    # Static assets cache
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        access_log off;
    }
    
    # SPA routing
    location / {
        try_files \$uri \$uri/ /index.html;
    }
    
    # Health check
    location /health {
        access_log off;
        return 200 "healthy";
        add_header Content-Type text/plain;
    }
    
    # Block sensitive files
    location ~ /\. {
        deny all;
    }
    
    location ~ \.(env|git|md)$ {
        deny all;
    }
}
EOF
    
    log_success "Nginx configurado com CSP para: $SUPABASE_DOMAIN"
}

# ===========================================
# BUILD E DEPLOY
# ===========================================

build_and_deploy() {
    log_info "Iniciando build do Docker..."
    
    cd "$PROJECT_DIR"
    
    # Limpar imagens antigas
    docker system prune -af 2>/dev/null || true
    
    # Build com variáveis
    log_info "Executando docker compose build..."
    
    docker compose build \
        --no-cache \
        --build-arg VITE_SUPABASE_URL="$SUPABASE_URL" \
        --build-arg VITE_SUPABASE_PUBLISHABLE_KEY="$SUPABASE_ANON_KEY" \
        --build-arg VITE_SUPABASE_PROJECT_ID="$SUPABASE_PROJECT_ID" \
        2>&1 | tee /tmp/docker-build.log
    
    # Verificar se o build foi bem sucedido
    if [ $? -ne 0 ]; then
        log_error "Erro no build! Verifique /tmp/docker-build.log"
        exit 1
    fi
    
    # Subir containers
    log_info "Iniciando containers..."
    docker compose up -d
    
    # Aguardar container subir
    sleep 5
    
    log_success "Containers iniciados"
}

verify_build() {
    log_info "Verificando build..."
    
    # Extrair domínio do Supabase
    SUPABASE_DOMAIN=$(echo "$SUPABASE_URL" | sed -E 's|https?://([^/]+).*|\1|')
    
    # Verificar se a URL correta está no bundle
    FOUND_URL=$(docker exec zapcrm-frontend sh -c "grep -r --text '$SUPABASE_DOMAIN' /usr/share/nginx/html/assets/*.js 2>/dev/null | head -1" || true)
    
    if [ -n "$FOUND_URL" ]; then
        log_success "URL do Supabase encontrada no bundle ✓"
    else
        log_warning "URL não encontrada com grep, verificando com strings..."
        FOUND_STRINGS=$(docker exec zapcrm-frontend sh -c "strings /usr/share/nginx/html/assets/*.js 2>/dev/null | grep -i 'supabase' | head -3" || true)
        echo "$FOUND_STRINGS"
    fi
    
    # Verificar se URL antiga do Lovable Cloud está presente
    OLD_URL=$(docker exec zapcrm-frontend sh -c "grep -r --text 'wjzqolnmdqmmcxejmunn' /usr/share/nginx/html/assets/*.js 2>/dev/null | head -1" || true)
    if [ -n "$OLD_URL" ]; then
        log_error "⚠️  ATENÇÃO: URL antiga do Lovable Cloud encontrada no bundle!"
        log_error "O build pode não ter sobrescrito o .env corretamente."
    else
        log_success "Nenhuma URL antiga do Lovable Cloud ✓"
    fi
    
    # Verificar se container está rodando
    if docker ps | grep -q zapcrm-frontend; then
        log_success "Container rodando ✓"
    else
        log_error "Container não está rodando!"
        docker logs zapcrm-frontend
        exit 1
    fi
}

# ===========================================
# CRIAR SUPER ADMIN
# ===========================================

create_super_admin() {
    log_info "Criando Super Admin no Supabase..."
    
    # Criar usuário via API do Supabase
    RESPONSE=$(curl -s -X POST "${SUPABASE_URL}/auth/v1/admin/users" \
        -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
        -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
        -H "Content-Type: application/json" \
        -d "{
            \"email\": \"${ADMIN_EMAIL}\",
            \"password\": \"${ADMIN_SENHA}\",
            \"email_confirm\": true
        }")
    
    USER_ID=$(echo "$RESPONSE" | jq -r '.id // empty')
    
    if [ -z "$USER_ID" ]; then
        # Usuário pode já existir, tentar buscar
        log_warning "Não foi possível criar usuário. Pode já existir."
        USER_ID=$(curl -s -X GET "${SUPABASE_URL}/auth/v1/admin/users" \
            -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
            -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" | \
            jq -r ".users[] | select(.email==\"${ADMIN_EMAIL}\") | .id" 2>/dev/null || true)
    fi
    
    if [ -z "$USER_ID" ]; then
        log_error "Não foi possível criar ou encontrar o usuário admin"
        log_warning "Você precisará criar o admin manualmente ou usar a edge function setup-primeiro-admin"
        return
    fi
    
    log_info "Usuário criado/encontrado com ID: $USER_ID"
    
    # Criar conta
    CONTA_ID=$(uuidgen)
    curl -s -X POST "${SUPABASE_URL}/rest/v1/contas" \
        -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
        -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
        -H "Content-Type: application/json" \
        -H "Prefer: return=minimal" \
        -d "{
            \"id\": \"${CONTA_ID}\",
            \"nome\": \"${ADMIN_EMPRESA}\",
            \"ativo\": true
        }" 2>/dev/null || true
    
    # Criar usuário na tabela usuarios
    curl -s -X POST "${SUPABASE_URL}/rest/v1/usuarios" \
        -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
        -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
        -H "Content-Type: application/json" \
        -H "Prefer: return=minimal" \
        -d "{
            \"user_id\": \"${USER_ID}\",
            \"conta_id\": \"${CONTA_ID}\",
            \"nome\": \"${ADMIN_NOME}\",
            \"email\": \"${ADMIN_EMAIL}\",
            \"is_admin\": true
        }" 2>/dev/null || true
    
    # Criar role super_admin
    curl -s -X POST "${SUPABASE_URL}/rest/v1/user_roles" \
        -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
        -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
        -H "Content-Type: application/json" \
        -H "Prefer: return=minimal" \
        -d "{
            \"user_id\": \"${USER_ID}\",
            \"role\": \"super_admin\"
        }" 2>/dev/null || true
    
    # Criar agente IA padrão
    curl -s -X POST "${SUPABASE_URL}/rest/v1/agent_ia" \
        -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
        -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
        -H "Content-Type: application/json" \
        -H "Prefer: return=minimal" \
        -d "{
            \"conta_id\": \"${CONTA_ID}\",
            \"nome\": \"Assistente\",
            \"ativo\": false,
            \"tipo\": \"vendas\"
        }" 2>/dev/null || true
    
    # Criar funil padrão
    FUNIL_ID=$(uuidgen)
    curl -s -X POST "${SUPABASE_URL}/rest/v1/funis" \
        -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
        -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
        -H "Content-Type: application/json" \
        -H "Prefer: return=minimal" \
        -d "{
            \"id\": \"${FUNIL_ID}\",
            \"conta_id\": \"${CONTA_ID}\",
            \"nome\": \"Funil Principal\",
            \"ordem\": 1
        }" 2>/dev/null || true
    
    # Criar estágios padrão
    for i in 1 2 3 4 5 6; do
        case $i in
            1) NOME="Novo Lead"; COR="#3B82F6"; TIPO="novo" ;;
            2) NOME="Qualificação"; COR="#F59E0B"; TIPO="normal" ;;
            3) NOME="Proposta"; COR="#8B5CF6"; TIPO="normal" ;;
            4) NOME="Negociação"; COR="#EC4899"; TIPO="normal" ;;
            5) NOME="Ganho"; COR="#10B981"; TIPO="ganho" ;;
            6) NOME="Perdido"; COR="#EF4444"; TIPO="perdido" ;;
        esac
        
        curl -s -X POST "${SUPABASE_URL}/rest/v1/estagios" \
            -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
            -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
            -H "Content-Type: application/json" \
            -H "Prefer: return=minimal" \
            -d "{
                \"funil_id\": \"${FUNIL_ID}\",
                \"nome\": \"${NOME}\",
                \"cor\": \"${COR}\",
                \"ordem\": ${i},
                \"tipo\": \"${TIPO}\"
            }" 2>/dev/null || true
    done
    
    log_success "Super Admin criado com sucesso!"
}

# ===========================================
# SSL
# ===========================================

setup_ssl() {
    log_info "Configurando SSL..."
    
    # Parar nginx temporariamente
    docker compose stop zapcrm 2>/dev/null || true
    
    # Obter certificado
    certbot certonly --standalone \
        -d "$DOMAIN" \
        --email "$EMAIL" \
        --agree-tos \
        --non-interactive \
        --force-renewal || {
            log_warning "Não foi possível obter SSL. Continuando sem HTTPS..."
            docker compose up -d
            return
        }
    
    # Copiar certificados
    mkdir -p "$PROJECT_DIR/ssl"
    cp "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" "$PROJECT_DIR/ssl/"
    cp "/etc/letsencrypt/live/$DOMAIN/privkey.pem" "$PROJECT_DIR/ssl/"
    
    # Atualizar nginx.conf para HTTPS
    SUPABASE_DOMAIN=$(echo "$SUPABASE_URL" | sed -E 's|https?://([^/]+).*|\1|')
    
    cat >> "$PROJECT_DIR/nginx.conf" << EOF

# Redirect HTTP to HTTPS
server {
    listen 80;
    server_name ${DOMAIN};
    return 301 https://\$server_name\$request_uri;
}

# HTTPS Server
server {
    listen 443 ssl http2;
    server_name ${DOMAIN};
    
    ssl_certificate /etc/nginx/ssl/fullchain.pem;
    ssl_certificate_key /etc/nginx/ssl/privkey.pem;
    
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    
    root /usr/share/nginx/html;
    index index.html;
    
    # Gzip
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml;
    
    # CSP com domínio do Supabase
    add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: blob: https:; connect-src 'self' ${SUPABASE_URL} wss://${SUPABASE_DOMAIN} https://*.supabase.co wss://*.supabase.co; media-src 'self' blob: ${SUPABASE_URL}; worker-src 'self' blob:; frame-ancestors 'self';" always;
    
    location / {
        try_files \$uri \$uri/ /index.html;
    }
    
    location /health {
        return 200 "healthy";
    }
    
    location ~ /\. {
        deny all;
    }
}
EOF
    
    # Reiniciar com SSL
    docker compose up -d
    
    # Configurar renovação automática
    (crontab -l 2>/dev/null | grep -v "certbot"; echo "0 3 * * * certbot renew --quiet --post-hook 'cp /etc/letsencrypt/live/$DOMAIN/*.pem $PROJECT_DIR/ssl/ && docker compose -f $PROJECT_DIR/docker-compose.yml restart zapcrm'") | crontab -
    
    log_success "SSL configurado"
}

# ===========================================
# FINALIZAÇÃO
# ===========================================

show_success() {
    echo ""
    echo -e "${GREEN}"
    echo "╔═══════════════════════════════════════════════════════════╗"
    echo "║                                                           ║"
    echo "║          ✓ INSTALAÇÃO CONCLUÍDA COM SUCESSO!              ║"
    echo "║                                                           ║"
    echo "╚═══════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
    echo ""
    echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
    echo -e "${CYAN}                    INFORMAÇÕES DE ACESSO                   ${NC}"
    echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
    echo ""
    echo -e "   🌐 URL do Sistema:     ${GREEN}https://${DOMAIN}${NC}"
    echo ""
    echo -e "   👤 Super Admin"
    echo -e "      Email:              ${GREEN}${ADMIN_EMAIL}${NC}"
    echo -e "      Senha:              ${GREEN}(a que você definiu)${NC}"
    echo ""
    echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
    echo -e "${CYAN}                    COMANDOS ÚTEIS                          ${NC}"
    echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
    echo ""
    echo "   # Ver status dos containers"
    echo -e "   ${YELLOW}cd $PROJECT_DIR && docker compose ps${NC}"
    echo ""
    echo "   # Ver logs"
    echo -e "   ${YELLOW}cd $PROJECT_DIR && docker compose logs -f${NC}"
    echo ""
    echo "   # Reiniciar"
    echo -e "   ${YELLOW}cd $PROJECT_DIR && docker compose restart${NC}"
    echo ""
    echo "   # Atualizar"
    echo -e "   ${YELLOW}cd $PROJECT_DIR && ./scripts/deploy.sh${NC}"
    echo ""
    echo "   # Verificar instalação"
    echo -e "   ${YELLOW}cd $PROJECT_DIR && ./scripts/verificar-instalacao.sh${NC}"
    echo ""
    echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
    echo ""
    
    # Status final
    docker compose ps
}

# ===========================================
# MAIN
# ===========================================

main() {
    show_banner
    check_root
    collect_data
    
    echo ""
    log_info "Iniciando instalação..."
    echo ""
    
    install_dependencies
    install_docker
    configure_firewall
    configure_fail2ban
    setup_project
    create_env_file
    configure_nginx
    build_and_deploy
    verify_build
    create_super_admin
    setup_ssl
    
    show_success
}

# Executar
main "$@"
