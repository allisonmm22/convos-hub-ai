#!/bin/bash

# ===========================================
# SCRIPT DE INSTALAÇÃO COMPLETA - ZapCRM
# Para VPS Ubuntu 22.04+ / Debian 12+
# ===========================================

set -e

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Funções de log
log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[OK]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[AVISO]${NC} $1"; }
log_error() { echo -e "${RED}[ERRO]${NC} $1"; }

# Banner
echo -e "${GREEN}"
echo "╔════════════════════════════════════════════════════════════╗"
echo "║                                                            ║"
echo "║               🚀 ZapCRM - Instalador VPS 🚀                ║"
echo "║                                                            ║"
echo "║     Docker + Nginx + SSL + Segurança Automatizada          ║"
echo "║                                                            ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# Verificar se é root
if [[ $EUID -ne 0 ]]; then
   log_error "Este script precisa ser executado como root (sudo)"
   exit 1
fi

# ===========================================
# COLETA DE VARIÁVEIS
# ===========================================
echo ""
log_info "Configuração inicial do sistema..."
echo ""

read -p "🌐 Digite seu domínio (ex: app.seusite.com): " DOMAIN
read -p "📧 Digite seu email (para SSL e alertas): " EMAIL

# Repositório fixo
GITHUB_REPO="https://github.com/allisonmm22/convos-hub-ai.git"
log_info "Repositório: $GITHUB_REPO"

echo ""
log_info "Configuração do Supabase..."
echo ""

read -p "🔗 VITE_SUPABASE_URL (ex: https://xxx.supabase.co): " VITE_SUPABASE_URL
read -p "🔑 VITE_SUPABASE_PUBLISHABLE_KEY (anon key): " VITE_SUPABASE_PUBLISHABLE_KEY
read -p "📋 VITE_SUPABASE_PROJECT_ID (project ref): " VITE_SUPABASE_PROJECT_ID
read -p "🔐 SUPABASE_SERVICE_ROLE_KEY (service_role key): " SUPABASE_SERVICE_ROLE_KEY

# Confirmar dados
echo ""
echo -e "${YELLOW}═══════════════════════════════════════════════════════════${NC}"
echo -e "${YELLOW}                    CONFIRME OS DADOS                       ${NC}"
echo -e "${YELLOW}═══════════════════════════════════════════════════════════${NC}"
echo ""
echo "  Domínio: $DOMAIN"
echo "  Email: $EMAIL"
echo "  Supabase URL: $VITE_SUPABASE_URL"
echo "  Service Role Key: ${SUPABASE_SERVICE_ROLE_KEY:0:20}..."
echo "  Supabase Project ID: $VITE_SUPABASE_PROJECT_ID"
echo ""

read -p "Os dados estão corretos? (s/n): " CONFIRM
if [[ $CONFIRM != "s" && $CONFIRM != "S" ]]; then
    log_error "Instalação cancelada"
    exit 1
fi

# Diretório do projeto
PROJECT_DIR="/var/www/zapcrm"

# ===========================================
# 1. ATUALIZAÇÃO DO SISTEMA
# ===========================================
log_info "Atualizando sistema operacional..."
apt update && apt upgrade -y
log_success "Sistema atualizado"

# ===========================================
# 2. INSTALAÇÃO DE DEPENDÊNCIAS BÁSICAS
# ===========================================
log_info "Instalando dependências básicas..."
apt install -y \
    apt-transport-https \
    ca-certificates \
    curl \
    gnupg \
    lsb-release \
    git \
    ufw \
    fail2ban \
    htop \
    nano \
    wget \
    unzip
log_success "Dependências básicas instaladas"

# ===========================================
# 3. INSTALAÇÃO DO DOCKER
# ===========================================
log_info "Instalando Docker..."

# Remover versões antigas
apt remove -y docker docker-engine docker.io containerd runc 2>/dev/null || true

# Adicionar repositório Docker
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null

apt update
apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# Iniciar e habilitar Docker
systemctl start docker
systemctl enable docker

log_success "Docker instalado: $(docker --version)"

# ===========================================
# 4. CONFIGURAÇÃO DO FIREWALL (UFW)
# ===========================================
log_info "Configurando Firewall..."

ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow 80/tcp
ufw allow 443/tcp

# Ativar UFW sem prompt
echo "y" | ufw enable

log_success "Firewall configurado (portas 22, 80, 443)"

# ===========================================
# 5. CONFIGURAÇÃO DO FAIL2BAN
# ===========================================
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
bantime = 86400

[nginx-http-auth]
enabled = true
filter = nginx-http-auth
port = http,https
logpath = /var/log/nginx/error.log
maxretry = 3

[nginx-limit-req]
enabled = true
filter = nginx-limit-req
port = http,https
logpath = /var/log/nginx/error.log
maxretry = 10
EOF

systemctl restart fail2ban
systemctl enable fail2ban

log_success "Fail2ban configurado (proteção SSH e Nginx)"

# ===========================================
# 6. CLONAR REPOSITÓRIO
# ===========================================
log_info "Preparando diretório de instalação..."

# Remover diretório completamente se existir (incluindo arquivos ocultos como .git)
if [ -d "$PROJECT_DIR" ]; then
    log_warning "Diretório $PROJECT_DIR já existe. Removendo para instalação limpa..."
    rm -rf "$PROJECT_DIR"
fi

# Criar diretório pai se não existir
mkdir -p "$(dirname $PROJECT_DIR)"

log_info "Clonando repositório..."
git clone $GITHUB_REPO $PROJECT_DIR

cd $PROJECT_DIR
log_success "Repositório clonado em $PROJECT_DIR"

# ===========================================
# 7. CRIAR ARQUIVO .ENV
# ===========================================
log_info "Criando arquivo .env..."

cat > $PROJECT_DIR/.env << EOF
# ===========================================
# VARIÁVEIS DE AMBIENTE - ZapCRM
# Gerado automaticamente em $(date)
# ===========================================

VITE_SUPABASE_URL=$VITE_SUPABASE_URL
VITE_SUPABASE_PUBLISHABLE_KEY=$VITE_SUPABASE_PUBLISHABLE_KEY
VITE_SUPABASE_PROJECT_ID=$VITE_SUPABASE_PROJECT_ID
SUPABASE_SERVICE_ROLE_KEY=$SUPABASE_SERVICE_ROLE_KEY
EOF

chmod 600 $PROJECT_DIR/.env

log_success "Arquivo .env criado"

# ===========================================
# 8. CRIAR DIRETÓRIOS NECESSÁRIOS
# ===========================================
log_info "Criando diretórios..."

mkdir -p $PROJECT_DIR/ssl
mkdir -p $PROJECT_DIR/logs/nginx

log_success "Diretórios criados"

# ===========================================
# 9. INSTALAR CERTBOT E GERAR SSL
# ===========================================
log_info "Instalando Certbot para SSL..."

apt install -y certbot python3-certbot-nginx

# Parar qualquer serviço na porta 80
systemctl stop nginx 2>/dev/null || true
docker stop zapcrm-frontend 2>/dev/null || true

log_info "Gerando certificado SSL para $DOMAIN..."

certbot certonly --standalone \
    --non-interactive \
    --agree-tos \
    --email $EMAIL \
    --domains $DOMAIN \
    --preferred-challenges http

# Copiar certificados para o projeto
cp /etc/letsencrypt/live/$DOMAIN/fullchain.pem $PROJECT_DIR/ssl/
cp /etc/letsencrypt/live/$DOMAIN/privkey.pem $PROJECT_DIR/ssl/
chmod -R 600 $PROJECT_DIR/ssl/

log_success "Certificado SSL gerado e copiado"

# ===========================================
# 10. ATUALIZAR NGINX CONFIG COM SSL
# ===========================================
log_info "Atualizando configuração Nginx com SSL..."

cat > $PROJECT_DIR/nginx.conf << 'NGINX_CONF'
# Rate limiting
limit_req_zone $binary_remote_addr zone=api_limit:10m rate=10r/s;
limit_conn_zone $binary_remote_addr zone=conn_limit:10m;

# Redirect HTTP to HTTPS
server {
    listen 80;
    listen [::]:80;
    server_name DOMAIN_PLACEHOLDER;
    return 301 https://$server_name$request_uri;
}

# HTTPS Server
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name DOMAIN_PLACEHOLDER;

    # SSL Certificates
    ssl_certificate /etc/nginx/ssl/fullchain.pem;
    ssl_certificate_key /etc/nginx/ssl/privkey.pem;

    # Modern SSL Configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 1d;
    ssl_session_tickets off;

    root /usr/share/nginx/html;
    index index.html;

    # Gzip
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_proxied expired no-cache no-store private auth;
    gzip_types text/plain text/css text/xml text/javascript application/x-javascript application/xml application/javascript application/json image/svg+xml;
    gzip_comp_level 6;

    # Security Headers
    add_header Strict-Transport-Security "max-age=63072000" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Permissions-Policy "camera=(), microphone=(self), geolocation=()" always;
    add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: https: blob:; connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.stripe.com; frame-src 'self' https://js.stripe.com; object-src 'none'; base-uri 'self';" always;

    # Static assets cache
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot|webp|avif)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        access_log off;
    }

    # SPA Routing
    location / {
        try_files $uri $uri/ /index.html;
        limit_req zone=api_limit burst=20 nodelay;
        limit_conn conn_limit 20;
    }

    # Health check
    location /health {
        access_log off;
        return 200 "healthy\n";
        add_header Content-Type text/plain;
    }

    # Block sensitive files
    location ~ /\. {
        deny all;
    }

    location ~ ^/(\.env|\.git|docker-compose|Dockerfile) {
        deny all;
        return 404;
    }

    error_page 404 /index.html;
    
    access_log /var/log/nginx/access.log;
    error_log /var/log/nginx/error.log warn;
}
NGINX_CONF

# Substituir placeholder pelo domínio real
sed -i "s/DOMAIN_PLACEHOLDER/$DOMAIN/g" $PROJECT_DIR/nginx.conf

log_success "Nginx configurado com SSL"

# ===========================================
# 11. BUILD E DEPLOY DOS CONTAINERS
# ===========================================
log_info "Construindo e iniciando containers Docker..."

cd $PROJECT_DIR

# Build
docker compose build --no-cache

# Start
docker compose up -d

log_success "Containers iniciados"

# ===========================================
# 11.1 CRIAR SUPER ADMIN AUTOMATICAMENTE
# ===========================================
log_info "Criando Super Admin no Supabase..."

# Credenciais padrão do super admin
ADMIN_EMAIL="admin@admin.com"
ADMIN_PASSWORD="123456"
EMPRESA_NOME="Empresa Principal"
ADMIN_NOME="Administrador"

# 1. Criar usuário via Supabase Auth Admin API
log_info "Criando usuário de autenticação..."
USER_RESPONSE=$(curl -s -X POST \
  "${VITE_SUPABASE_URL}/auth/v1/admin/users" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"${ADMIN_EMAIL}\",
    \"password\": \"${ADMIN_PASSWORD}\",
    \"email_confirm\": true
  }")

# Extrair user_id da resposta
USER_ID=$(echo $USER_RESPONSE | grep -oP '"id"\s*:\s*"\K[^"]+' | head -1)

# Se não conseguiu criar, tentar buscar existente
if [ -z "$USER_ID" ]; then
    log_warning "Usuário pode já existir, tentando buscar..."
    USERS_LIST=$(curl -s -X GET \
      "${VITE_SUPABASE_URL}/auth/v1/admin/users" \
      -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
      -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}")
    
    USER_ID=$(echo $USERS_LIST | grep -oP "\"id\":\s*\"[^\"]+\",\s*\"[^\"]*\":\s*[^,]*,\s*\"email\":\s*\"${ADMIN_EMAIL}\"" | grep -oP '"id"\s*:\s*"\K[^"]+' | head -1)
    
    if [ -z "$USER_ID" ]; then
        # Tentar extrair de forma mais simples
        USER_ID=$(echo $USER_RESPONSE | sed 's/.*"id":"\([^"]*\)".*/\1/' | head -c 36)
    fi
fi

if [ -n "$USER_ID" ] && [ ${#USER_ID} -eq 36 ]; then
    log_success "User ID obtido: $USER_ID"
    
    # 2. Verificar se já existe configuração
    log_info "Verificando se admin já está configurado..."
    CHECK_ROLE=$(curl -s -X GET \
      "${VITE_SUPABASE_URL}/rest/v1/user_roles?user_id=eq.${USER_ID}" \
      -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
      -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}")
    
    if echo "$CHECK_ROLE" | grep -q "super_admin"; then
        log_warning "Super Admin já configurado, pulando..."
    else
        log_info "Configurando tabelas do sistema..."
        
        # 3. Criar conta (empresa)
        log_info "Criando conta/empresa..."
        CONTA_RESPONSE=$(curl -s -X POST \
          "${VITE_SUPABASE_URL}/rest/v1/contas" \
          -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
          -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
          -H "Content-Type: application/json" \
          -H "Prefer: return=representation" \
          -d "{\"nome\": \"${EMPRESA_NOME}\", \"ativo\": true}")
        
        CONTA_ID=$(echo $CONTA_RESPONSE | grep -oP '"id"\s*:\s*"\K[^"]+' | head -1)
        
        if [ -n "$CONTA_ID" ]; then
            log_success "Conta criada: $CONTA_ID"
            
            # 4. Criar usuário na tabela usuarios
            log_info "Criando registro de usuário..."
            curl -s -X POST \
              "${VITE_SUPABASE_URL}/rest/v1/usuarios" \
              -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
              -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
              -H "Content-Type: application/json" \
              -d "{\"user_id\": \"${USER_ID}\", \"conta_id\": \"${CONTA_ID}\", \"nome\": \"${ADMIN_NOME}\", \"email\": \"${ADMIN_EMAIL}\", \"is_admin\": true}" > /dev/null
            
            # 5. Criar role super_admin
            log_info "Atribuindo role super_admin..."
            curl -s -X POST \
              "${VITE_SUPABASE_URL}/rest/v1/user_roles" \
              -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
              -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
              -H "Content-Type: application/json" \
              -d "{\"user_id\": \"${USER_ID}\", \"role\": \"super_admin\"}" > /dev/null
            
            # 6. Criar agente IA padrão
            log_info "Criando agente IA padrão..."
            curl -s -X POST \
              "${VITE_SUPABASE_URL}/rest/v1/agent_ia" \
              -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
              -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
              -H "Content-Type: application/json" \
              -d "{\"conta_id\": \"${CONTA_ID}\", \"nome\": \"Agente Padrão\", \"descricao\": \"Agente de IA configurado automaticamente\", \"ativo\": false}" > /dev/null
            
            # 7. Criar funil padrão
            log_info "Criando funil padrão..."
            FUNIL_RESPONSE=$(curl -s -X POST \
              "${VITE_SUPABASE_URL}/rest/v1/funis" \
              -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
              -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
              -H "Content-Type: application/json" \
              -H "Prefer: return=representation" \
              -d "{\"conta_id\": \"${CONTA_ID}\", \"nome\": \"Funil Principal\", \"descricao\": \"Funil de vendas padrão\"}")
            
            FUNIL_ID=$(echo $FUNIL_RESPONSE | grep -oP '"id"\s*:\s*"\K[^"]+' | head -1)
            
            if [ -n "$FUNIL_ID" ]; then
                log_success "Funil criado: $FUNIL_ID"
                
                # 8. Criar estágios padrão
                log_info "Criando estágios do funil..."
                curl -s -X POST \
                  "${VITE_SUPABASE_URL}/rest/v1/estagios" \
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
                
                log_success "Estágios criados"
            fi
            
            echo ""
            log_success "╔═══════════════════════════════════════════════════════════╗"
            log_success "║           🎉 SUPER ADMIN CRIADO COM SUCESSO!              ║"
            log_success "╠═══════════════════════════════════════════════════════════╣"
            log_success "║  📧 Email: admin@admin.com                                ║"
            log_success "║  🔑 Senha: 123456                                         ║"
            log_success "║  👤 Role:  super_admin                                    ║"
            log_success "╚═══════════════════════════════════════════════════════════╝"
            echo ""
        else
            log_error "Erro ao criar conta. Verifique os logs."
        fi
    fi
else
    log_error "Não foi possível obter User ID. Verifique as credenciais do Supabase."
    log_warning "Você pode criar o admin manualmente pelo Supabase Dashboard."
fi

# ===========================================
# 12. CONFIGURAR RENOVAÇÃO AUTOMÁTICA SSL
# ===========================================
log_info "Configurando renovação automática de SSL..."

cat > /etc/cron.d/certbot-renew << EOF
0 0,12 * * * root certbot renew --quiet --post-hook "cp /etc/letsencrypt/live/$DOMAIN/fullchain.pem $PROJECT_DIR/ssl/ && cp /etc/letsencrypt/live/$DOMAIN/privkey.pem $PROJECT_DIR/ssl/ && docker compose -f $PROJECT_DIR/docker-compose.yml restart"
EOF

log_success "Renovação automática de SSL configurada"

# ===========================================
# 13. TORNAR SCRIPTS EXECUTÁVEIS
# ===========================================
log_info "Configurando scripts auxiliares..."

chmod +x $PROJECT_DIR/scripts/*.sh 2>/dev/null || true

log_success "Scripts configurados"

# ===========================================
# 14. VERIFICAÇÃO FINAL
# ===========================================
echo ""
echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}           ✅ INSTALAÇÃO CONCLUÍDA COM SUCESSO!             ${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "  🌐 Acesse: ${BLUE}https://$DOMAIN${NC}"
echo ""
echo -e "  📁 Diretório: ${YELLOW}$PROJECT_DIR${NC}"
echo ""
echo -e "  📋 Comandos úteis:"
echo -e "     • Ver logs:        ${YELLOW}docker compose logs -f${NC}"
echo -e "     • Reiniciar:       ${YELLOW}docker compose restart${NC}"
echo -e "     • Atualizar:       ${YELLOW}./scripts/deploy.sh${NC}"
echo -e "     • Status:          ${YELLOW}docker compose ps${NC}"
echo ""
echo -e "${YELLOW}═══════════════════════════════════════════════════════════${NC}"
echo -e "${YELLOW}                    PRÓXIMOS PASSOS                         ${NC}"
echo -e "${YELLOW}═══════════════════════════════════════════════════════════${NC}"
echo ""
echo "  1. Configure as migrations do Supabase:"
echo -e "     ${BLUE}./scripts/supabase-setup.sh${NC}"
echo ""
echo "  2. Configure os webhooks para apontar para:"
echo -e "     • WhatsApp: ${BLUE}$VITE_SUPABASE_URL/functions/v1/whatsapp-webhook${NC}"
echo -e "     • Stripe:   ${BLUE}$VITE_SUPABASE_URL/functions/v1/stripe-webhook${NC}"
echo -e "     • Instagram: ${BLUE}$VITE_SUPABASE_URL/functions/v1/instagram-webhook${NC}"
echo ""
echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}"

# Verificar status dos containers
echo ""
log_info "Status dos containers:"
docker compose ps
