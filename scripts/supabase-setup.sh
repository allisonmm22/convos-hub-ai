#!/bin/bash

# ===========================================
# SCRIPT DE SETUP DO SUPABASE - ZapCRM
# Configura migrations e Edge Functions
# ===========================================

set -e

# Cores
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Diretório do projeto
PROJECT_DIR="/var/www/zapcrm"
cd $PROJECT_DIR

echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}              🗄️  ZapCRM - Setup Supabase                   ${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo ""

# ===========================================
# 1. VERIFICAR/INSTALAR SUPABASE CLI
# ===========================================
# Adicionar paths possíveis do Supabase CLI ao PATH
export PATH="$HOME/.supabase/bin:/usr/local/bin:$PATH"

if ! command -v supabase &> /dev/null; then
    echo -e "${BLUE}[INFO] Instalando Supabase CLI...${NC}"
    
    # Instalar via script oficial (não requer npm)
    curl -fsSL https://raw.githubusercontent.com/supabase/cli/main/install.sh | sh
    
    # Atualizar PATH após instalação
    export PATH="$HOME/.supabase/bin:/usr/local/bin:$PATH"
    
    # Verificar se instalou corretamente
    if ! command -v supabase &> /dev/null; then
        echo -e "${RED}[ERRO] Supabase CLI não foi instalado corretamente${NC}"
        echo ""
        echo "Tente instalar manualmente:"
        echo "  curl -fsSL https://raw.githubusercontent.com/supabase/cli/main/install.sh | sh"
        echo "  echo 'export PATH=\"\$HOME/.supabase/bin:\$PATH\"' >> ~/.bashrc"
        echo "  source ~/.bashrc"
        exit 1
    fi
    
    echo -e "${GREEN}[OK] Supabase CLI instalado: $(supabase --version)${NC}"
else
    echo -e "${GREEN}[OK] Supabase CLI já instalado: $(supabase --version)${NC}"
fi

# ===========================================
# 2. LOGIN NO SUPABASE
# ===========================================
echo ""
echo -e "${BLUE}[INFO] Fazendo login no Supabase...${NC}"
echo -e "${YELLOW}Uma janela do navegador será aberta para autenticação${NC}"
echo ""

supabase login

# ===========================================
# 3. COLETAR PROJECT REF
# ===========================================
echo ""
read -p "📋 Digite o Project Ref do Supabase (ex: abcdefghijklmnop): " PROJECT_REF

# ===========================================
# 4. LINKAR PROJETO
# ===========================================
echo ""
echo -e "${BLUE}[INFO] Linkando projeto Supabase...${NC}"

supabase link --project-ref $PROJECT_REF

echo -e "${GREEN}[OK] Projeto linkado${NC}"

# ===========================================
# 5. APLICAR MIGRATIONS
# ===========================================
echo ""
echo -e "${BLUE}[INFO] Aplicando migrations do banco de dados...${NC}"

# Verificar se há migrations
if [ -d "supabase/migrations" ] && [ "$(ls -A supabase/migrations 2>/dev/null)" ]; then
    supabase db push
    echo -e "${GREEN}[OK] Migrations aplicadas${NC}"
else
    echo -e "${YELLOW}[AVISO] Nenhuma migration encontrada em supabase/migrations/${NC}"
fi

# ===========================================
# 6. DEPLOY DAS EDGE FUNCTIONS
# ===========================================
echo ""
echo -e "${BLUE}[INFO] Deployando Edge Functions...${NC}"
echo ""

# Lista de todas as funções do projeto
FUNCTIONS=(
    "ai-responder"
    "analisar-imagem"
    "criar-conta-admin"
    "deletar-mensagem"
    "desativar-conta"
    "download-media"
    "enviar-mensagem"
    "evolution-connect"
    "evolution-connection-status"
    "evolution-create-instance"
    "evolution-create-instance-instagram"
    "evolution-delete-instance"
    "evolution-disconnect"
    "evolution-fetch-messages"
    "evolution-set-webhook"
    "executar-acao"
    "extrair-texto-pdf"
    "google-calendar-actions"
    "google-calendar-auth"
    "google-calendar-callback"
    "google-calendar-refresh"
    "instagram-connect"
    "instagram-webhook"
    "meta-configure-webhook"
    "meta-download-media"
    "meta-get-templates"
    "meta-send-message"
    "meta-verify-webhook"
    "processar-followups"
    "processar-followups-agendados"
    "processar-lembretes"
    "processar-resposta-agora"
    "processar-respostas-pendentes"
    "registrar-log"
    "reset-user-password"
    "resumir-conversa"
    "setup-primeiro-admin"
    "stripe-checkout"
    "stripe-customer-portal"
    "stripe-test-connection"
    "stripe-webhook"
    "transcrever-audio"
    "transferir-atendimento"
    "validar-limite-plano"
    "verificar-limites-plano"
    "whatsapp-webhook"
)

TOTAL=${#FUNCTIONS[@]}
CURRENT=0
FAILED=()

for FUNC in "${FUNCTIONS[@]}"; do
    CURRENT=$((CURRENT + 1))
    
    # Verificar se a função existe
    if [ -d "supabase/functions/$FUNC" ]; then
        echo -e "${BLUE}[$CURRENT/$TOTAL] Deployando: $FUNC${NC}"
        
        if supabase functions deploy $FUNC --project-ref $PROJECT_REF 2>/dev/null; then
            echo -e "${GREEN}   ✅ $FUNC${NC}"
        else
            echo -e "${RED}   ❌ $FUNC (falhou)${NC}"
            FAILED+=($FUNC)
        fi
    else
        echo -e "${YELLOW}[$CURRENT/$TOTAL] $FUNC não encontrada, pulando...${NC}"
    fi
done

# ===========================================
# 7. RELATÓRIO FINAL
# ===========================================
echo ""
echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}              ✅ Setup Supabase Concluído!                  ${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}"
echo ""

# Verificar se houve falhas
if [ ${#FAILED[@]} -eq 0 ]; then
    echo -e "${GREEN}Todas as $TOTAL funções foram deployadas com sucesso!${NC}"
else
    echo -e "${YELLOW}Deployadas: $((TOTAL - ${#FAILED[@]}))/$TOTAL${NC}"
    echo -e "${RED}Falhas: ${FAILED[*]}${NC}"
    echo ""
    echo -e "${YELLOW}Para re-deployar funções com falha, execute:${NC}"
    for FUNC in "${FAILED[@]}"; do
        echo -e "  supabase functions deploy $FUNC --project-ref $PROJECT_REF"
    done
fi

echo ""
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}                    LEMBRETE DE SECRETS                     ${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo ""
echo "Certifique-se de configurar os seguintes secrets no Supabase:"
echo ""
echo "  • EVOLUTION_API_KEY"
echo "  • GOOGLE_CLIENT_ID"
echo "  • GOOGLE_CLIENT_SECRET"
echo "  • META_APP_ID"
echo "  • META_APP_SECRET"
echo "  • STRIPE_SECRET_KEY"
echo "  • LOVABLE_API_KEY"
echo ""
echo "Acesse: https://supabase.com/dashboard/project/$PROJECT_REF/settings/functions"
echo ""

# Listar funções deployadas
echo -e "${BLUE}[INFO] Verificando funções deployadas...${NC}"
supabase functions list --project-ref $PROJECT_REF 2>/dev/null || echo "Não foi possível listar funções"
