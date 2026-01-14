# 📦 Guia de Instalação do ZapCRM em VPS

Este guia explica como instalar o ZapCRM em uma VPS Ubuntu/Debian com Supabase (Cloud ou Self-Hosted).

---

## 📋 Pré-requisitos

### Servidor
- **Sistema Operacional:** Ubuntu 22.04+ ou Debian 12+
- **RAM:** Mínimo 2GB (recomendado 4GB)
- **Disco:** Mínimo 20GB
- **Acesso:** Root ou sudo

### Domínio
- Um domínio apontando para o IP da VPS (ex: `app.seudominio.com.br`)
- Registro A configurado no DNS

### Supabase
Você pode usar:
1. **Supabase Cloud** (supabase.co) - Mais fácil
2. **Supabase Self-Hosted** - Mais controle

---

## 🚀 Instalação Automática (Recomendado)

Execute o comando abaixo na sua VPS:

```bash
curl -sSL https://raw.githubusercontent.com/cognityx-dev/zapcrm/main/scripts/install.sh | sudo bash
```

O script irá:
1. ✅ Instalar Docker e dependências
2. ✅ Configurar Firewall (UFW) e Fail2ban
3. ✅ Clonar o repositório
4. ✅ Configurar variáveis de ambiente
5. ✅ Fazer build do frontend
6. ✅ Criar Super Admin no Supabase
7. ✅ Configurar SSL (Let's Encrypt)

---

## 🔧 Instalação Manual

### 1. Preparar o Servidor

```bash
# Atualizar sistema
sudo apt update && sudo apt upgrade -y

# Instalar dependências
sudo apt install -y curl git ufw fail2ban

# Instalar Docker
curl -fsSL https://get.docker.com | sh
sudo systemctl enable docker
sudo systemctl start docker
```

### 2. Configurar Firewall

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

### 3. Clonar Repositório

```bash
sudo mkdir -p /var/www
cd /var/www
sudo git clone https://github.com/cognityx-dev/zapcrm.git
cd zapcrm
```

### 4. Configurar Variáveis de Ambiente

```bash
# Remover .env do repo (contém configs do Lovable Cloud)
sudo rm -f .env

# Criar novo .env
sudo nano .env
```

Conteúdo do `.env`:

```env
# Supabase
VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGci...sua-anon-key
VITE_SUPABASE_PROJECT_ID=seu-project-id

# Para scripts (não exposto no frontend)
SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...sua-service-role-key
```

### 5. Configurar nginx.conf

Edite o `nginx.conf` e substitua a CSP pelo seu domínio Supabase:

```bash
sudo nano nginx.conf
```

Altere a linha `connect-src` para incluir seu domínio:

```nginx
add_header Content-Security-Policy "... connect-src 'self' https://SEU-PROJETO.supabase.co wss://SEU-PROJETO.supabase.co ...";
```

### 6. Build e Deploy

```bash
# Build com variáveis
source .env
sudo docker compose build \
    --no-cache \
    --build-arg VITE_SUPABASE_URL="$VITE_SUPABASE_URL" \
    --build-arg VITE_SUPABASE_PUBLISHABLE_KEY="$VITE_SUPABASE_PUBLISHABLE_KEY" \
    --build-arg VITE_SUPABASE_PROJECT_ID="$VITE_SUPABASE_PROJECT_ID"

# Iniciar
sudo docker compose up -d
```

### 7. Verificar Instalação

```bash
# Ver status
sudo docker compose ps

# Ver logs
sudo docker compose logs -f

# Testar
curl http://localhost/health
```

### 8. Configurar SSL

```bash
# Instalar Certbot
sudo apt install -y certbot

# Parar container temporariamente
sudo docker compose stop zapcrm

# Obter certificado
sudo certbot certonly --standalone -d seu-dominio.com.br

# Copiar certificados
sudo mkdir -p /var/www/zapcrm/ssl
sudo cp /etc/letsencrypt/live/seu-dominio.com.br/fullchain.pem /var/www/zapcrm/ssl/
sudo cp /etc/letsencrypt/live/seu-dominio.com.br/privkey.pem /var/www/zapcrm/ssl/

# Reiniciar
sudo docker compose up -d
```

---

## 👤 Criar Super Admin

### Opção 1: Via Script de Instalação
O script automático já cria o Super Admin.

### Opção 2: Via API

```bash
# Carregar variáveis
source /var/www/zapcrm/.env

# Criar usuário
curl -X POST "${VITE_SUPABASE_URL}/auth/v1/admin/users" \
  -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@seudominio.com.br",
    "password": "SuaSenhaSegura123",
    "email_confirm": true
  }'
```

### Opção 3: Via Edge Function

Acesse: `https://seu-dominio.com.br/setup` (se implementado)

---

## 📊 Comandos Úteis

```bash
# Navegar até o projeto
cd /var/www/zapcrm

# Ver status dos containers
docker compose ps

# Ver logs em tempo real
docker compose logs -f

# Ver logs do nginx
docker compose logs -f zapcrm

# Reiniciar containers
docker compose restart

# Parar containers
docker compose down

# Atualizar para nova versão
./scripts/deploy.sh

# Verificar instalação
./scripts/verificar-instalacao.sh

# Ver uso de disco
docker system df

# Limpar imagens não usadas
docker system prune -af
```

---

## 🔍 Troubleshooting

### Erro: "Failed to fetch"

1. **Verificar URL no bundle:**
```bash
docker exec zapcrm-frontend sh -c "grep -r 'supabase' /usr/share/nginx/html/assets/*.js | head -3"
```

2. **Verificar se URL antiga está presente:**
```bash
docker exec zapcrm-frontend sh -c "grep -r 'wjzqolnmdqmmcxejmunn' /usr/share/nginx/html/assets/*.js"
```

3. **Se URL antiga aparecer, fazer rebuild:**
```bash
docker compose down
docker system prune -af
source .env
docker compose build --no-cache \
    --build-arg VITE_SUPABASE_URL="$VITE_SUPABASE_URL" \
    --build-arg VITE_SUPABASE_PUBLISHABLE_KEY="$VITE_SUPABASE_PUBLISHABLE_KEY" \
    --build-arg VITE_SUPABASE_PROJECT_ID="$VITE_SUPABASE_PROJECT_ID"
docker compose up -d
```

### Erro: CSP (Content Security Policy)

Verifique se o `nginx.conf` contém o domínio correto do Supabase na diretiva `connect-src`.

### Container não inicia

```bash
# Ver logs detalhados
docker compose logs zapcrm

# Verificar se porta está em uso
sudo lsof -i :80
sudo lsof -i :443
```

### SSL não funciona

```bash
# Verificar certificado
openssl x509 -in /var/www/zapcrm/ssl/fullchain.pem -text -noout

# Renovar certificado
sudo certbot renew --force-renewal
```

---

## 🔄 Atualizações

Para atualizar o ZapCRM:

```bash
cd /var/www/zapcrm
./scripts/deploy.sh
```

Ou manualmente:

```bash
cd /var/www/zapcrm
git pull origin main
source .env
docker compose build --no-cache \
    --build-arg VITE_SUPABASE_URL="$VITE_SUPABASE_URL" \
    --build-arg VITE_SUPABASE_PUBLISHABLE_KEY="$VITE_SUPABASE_PUBLISHABLE_KEY" \
    --build-arg VITE_SUPABASE_PROJECT_ID="$VITE_SUPABASE_PROJECT_ID"
docker compose up -d
```

---

## 📞 Suporte

- **Documentação:** https://docs.zapcrm.com.br
- **Issues:** https://github.com/cognityx-dev/zapcrm/issues
- **Email:** suporte@cognityx.com.br

---

## 📄 Licença

Este projeto é proprietário. Consulte os termos de uso.
