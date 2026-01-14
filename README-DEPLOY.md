# 🚀 ZapCRM - Guia de Deploy em VPS

Este documento explica como fazer deploy do ZapCRM em uma VPS Linux usando Docker.

---

## 📋 Requisitos

### Servidor
- **OS**: Ubuntu 22.04 LTS ou Debian 12+
- **RAM**: Mínimo 2GB (recomendado 4GB)
- **CPU**: 2 vCPUs
- **Disco**: 20GB SSD
- **Portas**: 22 (SSH), 80 (HTTP), 443 (HTTPS)

### Serviços Externos
- Conta no [Supabase](https://supabase.com)
- Domínio apontando para o IP do servidor
- (Opcional) Conta no Stripe, Meta, Google Cloud

---

## 🚀 Instalação Rápida

### Opção 1: Instalação Automatizada (Recomendada)

```bash
# Conectar ao servidor via SSH
ssh root@SEU_IP

# Baixar e executar o instalador
curl -sSL https://raw.githubusercontent.com/SEU-USUARIO/SEU-REPO/main/scripts/install.sh -o install.sh
chmod +x install.sh
./install.sh
```

### Opção 2: Instalação Manual

```bash
# 1. Clonar repositório
git clone https://github.com/SEU-USUARIO/SEU-REPO.git /var/www/zapcrm
cd /var/www/zapcrm

# 2. Copiar e editar .env
cp .env.example .env
nano .env

# 3. Build e start
docker compose up -d
```

---

## 📁 Estrutura de Arquivos

```
/var/www/zapcrm/
├── Dockerfile              # Build do frontend
├── docker-compose.yml      # Orquestração
├── nginx.conf              # Configuração do Nginx
├── .env                    # Variáveis de ambiente
├── ssl/                    # Certificados SSL
│   ├── fullchain.pem
│   └── privkey.pem
├── logs/                   # Logs do Nginx
│   └── nginx/
├── scripts/
│   ├── install.sh          # Instalação completa
│   ├── deploy.sh           # Atualização
│   ├── supabase-setup.sh   # Setup do Supabase
│   ├── backup.sh           # Backup de configs
│   └── ssl-renew.sh        # Renovação SSL
└── supabase/
    └── functions/          # Edge Functions
```

---

## ⚙️ Configuração do Supabase

### 1. Criar Projeto
1. Acesse [supabase.com](https://supabase.com)
2. Crie um novo projeto
3. Anote: Project URL, anon key, Project Ref

### 2. Configurar Secrets
Vá em **Settings > Edge Functions > Secrets** e adicione:

| Secret | Descrição |
|--------|-----------|
| `EVOLUTION_API_KEY` | Chave da Evolution API |
| `GOOGLE_CLIENT_ID` | Client ID do Google |
| `GOOGLE_CLIENT_SECRET` | Client Secret do Google |
| `META_APP_ID` | App ID do Facebook |
| `META_APP_SECRET` | App Secret do Facebook |
| `STRIPE_SECRET_KEY` | Chave secreta do Stripe |
| `LOVABLE_API_KEY` | Chave da API Lovable |

### 3. Aplicar Migrations e Deploy das Functions
```bash
./scripts/supabase-setup.sh
```

---

## 🔧 Comandos Úteis

### Docker

```bash
# Ver status dos containers
docker compose ps

# Ver logs em tempo real
docker compose logs -f

# Reiniciar containers
docker compose restart

# Parar containers
docker compose down

# Rebuild completo
docker compose build --no-cache && docker compose up -d
```

### Atualização

```bash
# Atualizar a partir do GitHub
./scripts/deploy.sh
```

### Backup

```bash
# Criar backup de configurações
./scripts/backup.sh
```

---

## 🔒 Segurança

O sistema inclui:

- ✅ **Firewall (UFW)**: Apenas portas 22, 80, 443 abertas
- ✅ **Fail2ban**: Proteção contra brute-force SSH
- ✅ **SSL/TLS**: Certificados Let's Encrypt com renovação automática
- ✅ **Headers de Segurança**: HSTS, CSP, X-Frame-Options, etc.
- ✅ **Rate Limiting**: Proteção contra DDoS básico

---

## 🌐 Configuração de Webhooks

Após o deploy, configure os webhooks nos serviços externos:

### WhatsApp (Evolution API)
```
https://SEU-PROJECT-REF.supabase.co/functions/v1/whatsapp-webhook
```

### Stripe
```
https://SEU-PROJECT-REF.supabase.co/functions/v1/stripe-webhook
```

### Instagram
```
https://SEU-PROJECT-REF.supabase.co/functions/v1/instagram-webhook
```

### Meta/WhatsApp Business
```
https://SEU-PROJECT-REF.supabase.co/functions/v1/meta-verify-webhook
```

---

## 🔄 Cron Jobs (Tarefas Agendadas)

Para processar follow-ups automaticamente, configure no Supabase:

1. Vá em **Database > Extensions**
2. Ative `pg_cron` e `pg_net`
3. Execute no SQL Editor:

```sql
-- Processar follow-ups a cada 5 minutos
SELECT cron.schedule(
  'processar-followups',
  '*/5 * * * *',
  $$SELECT net.http_post(
    url := 'https://SEU-PROJECT-REF.supabase.co/functions/v1/processar-followups',
    headers := '{"Authorization": "Bearer SUA_ANON_KEY"}'::jsonb
  )$$
);

-- Processar lembretes a cada minuto
SELECT cron.schedule(
  'processar-lembretes',
  '* * * * *',
  $$SELECT net.http_post(
    url := 'https://SEU-PROJECT-REF.supabase.co/functions/v1/processar-lembretes',
    headers := '{"Authorization": "Bearer SUA_ANON_KEY"}'::jsonb
  )$$
);
```

---

## 🐛 Troubleshooting

### Container não inicia
```bash
docker compose logs zapcrm
```

### Erro de SSL
```bash
# Verificar certificados
ls -la /var/www/zapcrm/ssl/

# Renovar manualmente
./scripts/ssl-renew.sh
```

### Edge Function falha
```bash
# Ver logs da função
supabase functions logs NOME_DA_FUNCAO --project-ref SEU_PROJECT_REF
```

### Erro 502 Bad Gateway
```bash
# Verificar se container está rodando
docker compose ps

# Reiniciar
docker compose restart
```

---

## 📞 Suporte

Em caso de problemas, verifique:
1. Logs do Docker: `docker compose logs -f`
2. Logs do Nginx: `cat /var/www/zapcrm/logs/nginx/error.log`
3. Status dos serviços: `docker compose ps`

---

## 📄 Licença

Este projeto é proprietário. Todos os direitos reservados.
