#!/bin/bash

# ===========================================
# SCRIPT PARA RESETAR/RECRIAR SUPER ADMIN
# ZapCRM - Reset Admin Tool
# ===========================================

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[OK]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[AVISO]${NC} $1"; }
log_error() { echo -e "${RED}[ERRO]${NC} $1"; }

# Diretório do projeto
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# Carregar variáveis do .env
if [ -f "$PROJECT_DIR/.env" ]; then
    export $(grep -v '^#' $PROJECT_DIR/.env | xargs)
else
    log_error "Arquivo .env não encontrado em $PROJECT_DIR"
    exit 1
fi

# Verificar variáveis obrigatórias
if [ -z "$VITE_SUPABASE_URL" ] || [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
    log_error "Variáveis VITE_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórias"
    log_info "Configure essas variáveis no arquivo .env"
    exit 1
fi

# Credenciais padrão
DEFAULT_EMAIL="admin@admin.com"
DEFAULT_PASSWORD="123456"
DEFAULT_EMPRESA="Empresa Principal"
DEFAULT_NOME="Administrador"

# ===========================================
# FUNÇÕES AUXILIARES
# ===========================================

# Buscar usuário por email
get_user_by_email() {
    local email=$1
    curl -s -X GET \
        "${VITE_SUPABASE_URL}/auth/v1/admin/users" \
        -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
        -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" | \
        grep -o "{[^}]*\"email\":\"${email}\"[^}]*}" | head -1
}

# Extrair ID do usuário
extract_user_id() {
    local json=$1
    echo "$json" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4
}

# Criar usuário no Supabase Auth
create_auth_user() {
    local email=$1
    local password=$2
    
    curl -s -X POST \
        "${VITE_SUPABASE_URL}/auth/v1/admin/users" \
        -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
        -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
        -H "Content-Type: application/json" \
        -d "{
            \"email\": \"${email}\",
            \"password\": \"${password}\",
            \"email_confirm\": true
        }"
}

# Atualizar senha do usuário
update_user_password() {
    local user_id=$1
    local new_password=$2
    
    curl -s -X PUT \
        "${VITE_SUPABASE_URL}/auth/v1/admin/users/${user_id}" \
        -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
        -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
        -H "Content-Type: application/json" \
        -d "{\"password\": \"${new_password}\"}"
}

# Deletar usuário do Supabase Auth
delete_auth_user() {
    local user_id=$1
    
    curl -s -X DELETE \
        "${VITE_SUPABASE_URL}/auth/v1/admin/users/${user_id}" \
        -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
        -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}"
}

# Inserir registro via REST API
insert_record() {
    local table=$1
    local data=$2
    
    curl -s -X POST \
        "${VITE_SUPABASE_URL}/rest/v1/${table}" \
        -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
        -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
        -H "Content-Type: application/json" \
        -H "Prefer: return=representation" \
        -d "$data"
}

# Deletar registros via REST API
delete_records() {
    local table=$1
    local filter=$2
    
    curl -s -X DELETE \
        "${VITE_SUPABASE_URL}/rest/v1/${table}?${filter}" \
        -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
        -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}"
}

# Buscar registros via REST API
select_records() {
    local table=$1
    local filter=$2
    
    curl -s -X GET \
        "${VITE_SUPABASE_URL}/rest/v1/${table}?${filter}" \
        -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
        -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}"
}

# ===========================================
# FUNÇÕES PRINCIPAIS
# ===========================================

# Opção 1: Resetar senha mantendo dados
reset_password() {
    local email=${1:-$DEFAULT_EMAIL}
    local new_password=${2:-$DEFAULT_PASSWORD}
    
    log_info "Buscando usuário ${email}..."
    
    local user_json=$(get_user_by_email "$email")
    local user_id=$(extract_user_id "$user_json")
    
    if [ -z "$user_id" ]; then
        log_error "Usuário ${email} não encontrado"
        return 1
    fi
    
    log_info "Usuário encontrado: ${user_id}"
    log_info "Resetando senha..."
    
    local result=$(update_user_password "$user_id" "$new_password")
    
    if echo "$result" | grep -q '"id"'; then
        log_success "Senha resetada com sucesso!"
        log_info "Email: ${email}"
        log_info "Nova senha: ${new_password}"
    else
        log_error "Falha ao resetar senha"
        echo "$result"
        return 1
    fi
}

# Opção 2: Deletar e recriar admin completamente
recreate_admin() {
    local email=${1:-$DEFAULT_EMAIL}
    local password=${2:-$DEFAULT_PASSWORD}
    local empresa=${3:-$DEFAULT_EMPRESA}
    local nome=${4:-$DEFAULT_NOME}
    
    log_warning "ATENÇÃO: Esta ação irá deletar todos os dados do admin!"
    read -p "Deseja continuar? (s/N): " confirm
    
    if [[ ! "$confirm" =~ ^[Ss]$ ]]; then
        log_info "Operação cancelada"
        return 0
    fi
    
    # 1. Buscar usuário existente
    log_info "Buscando usuário existente..."
    local user_json=$(get_user_by_email "$email")
    local user_id=$(extract_user_id "$user_json")
    
    if [ -n "$user_id" ]; then
        log_info "Usuário encontrado: ${user_id}"
        
        # Buscar conta_id do usuário
        local usuario_data=$(select_records "usuarios" "user_id=eq.${user_id}&select=conta_id")
        local conta_id=$(echo "$usuario_data" | grep -o '"conta_id":"[^"]*"' | head -1 | cut -d'"' -f4)
        
        if [ -n "$conta_id" ]; then
            log_info "Deletando dados da conta ${conta_id}..."
            
            # Deletar em ordem (por causa das foreign keys)
            delete_records "estagios" "funil_id=in.(select id from funis where conta_id=eq.${conta_id})" 2>/dev/null
            delete_records "funis" "conta_id=eq.${conta_id}" 2>/dev/null
            delete_records "agent_ia" "conta_id=eq.${conta_id}" 2>/dev/null
            delete_records "user_roles" "user_id=eq.${user_id}" 2>/dev/null
            delete_records "usuarios" "user_id=eq.${user_id}" 2>/dev/null
            delete_records "contas" "id=eq.${conta_id}" 2>/dev/null
        fi
        
        # Deletar usuário do Auth
        log_info "Deletando usuário do Auth..."
        delete_auth_user "$user_id"
        
        log_success "Dados antigos removidos"
    fi
    
    # 2. Criar novo usuário
    log_info "Criando novo usuário..."
    local new_user=$(create_auth_user "$email" "$password")
    local new_user_id=$(echo "$new_user" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
    
    if [ -z "$new_user_id" ]; then
        log_error "Falha ao criar usuário"
        echo "$new_user"
        return 1
    fi
    
    log_success "Usuário criado: ${new_user_id}"
    
    # 3. Criar conta
    log_info "Criando conta..."
    local conta_response=$(insert_record "contas" "{\"nome\": \"${empresa}\", \"ativo\": true}")
    local new_conta_id=$(echo "$conta_response" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
    
    if [ -z "$new_conta_id" ]; then
        log_error "Falha ao criar conta"
        return 1
    fi
    
    log_success "Conta criada: ${new_conta_id}"
    
    # 4. Criar usuário na tabela usuarios
    log_info "Criando registro de usuário..."
    insert_record "usuarios" "{
        \"user_id\": \"${new_user_id}\",
        \"conta_id\": \"${new_conta_id}\",
        \"nome\": \"${nome}\",
        \"email\": \"${email}\",
        \"is_admin\": true
    }" > /dev/null
    
    # 5. Atribuir role super_admin
    log_info "Atribuindo role super_admin..."
    insert_record "user_roles" "{
        \"user_id\": \"${new_user_id}\",
        \"role\": \"super_admin\"
    }" > /dev/null
    
    # 6. Criar agente IA padrão
    log_info "Criando agente IA padrão..."
    insert_record "agent_ia" "{
        \"conta_id\": \"${new_conta_id}\",
        \"nome\": \"Agente Padrão\",
        \"descricao\": \"Agente de IA configurado automaticamente\",
        \"ativo\": false
    }" > /dev/null
    
    # 7. Criar funil padrão
    log_info "Criando funil padrão..."
    local funil_response=$(insert_record "funis" "{
        \"conta_id\": \"${new_conta_id}\",
        \"nome\": \"Funil Principal\",
        \"descricao\": \"Funil de vendas padrão\"
    }")
    local new_funil_id=$(echo "$funil_response" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
    
    # 8. Criar estágios
    if [ -n "$new_funil_id" ]; then
        log_info "Criando estágios do funil..."
        insert_record "estagios" "{\"funil_id\": \"${new_funil_id}\", \"nome\": \"Novo Lead\", \"ordem\": 1, \"cor\": \"#3B82F6\", \"tipo\": \"novo\"}" > /dev/null
        insert_record "estagios" "{\"funil_id\": \"${new_funil_id}\", \"nome\": \"Qualificação\", \"ordem\": 2, \"cor\": \"#F59E0B\", \"tipo\": \"normal\"}" > /dev/null
        insert_record "estagios" "{\"funil_id\": \"${new_funil_id}\", \"nome\": \"Proposta\", \"ordem\": 3, \"cor\": \"#8B5CF6\", \"tipo\": \"normal\"}" > /dev/null
        insert_record "estagios" "{\"funil_id\": \"${new_funil_id}\", \"nome\": \"Negociação\", \"ordem\": 4, \"cor\": \"#EC4899\", \"tipo\": \"normal\"}" > /dev/null
        insert_record "estagios" "{\"funil_id\": \"${new_funil_id}\", \"nome\": \"Ganho\", \"ordem\": 5, \"cor\": \"#10B981\", \"tipo\": \"ganho\"}" > /dev/null
        insert_record "estagios" "{\"funil_id\": \"${new_funil_id}\", \"nome\": \"Perdido\", \"ordem\": 6, \"cor\": \"#EF4444\", \"tipo\": \"perdido\"}" > /dev/null
    fi
    
    echo ""
    log_success "=========================================="
    log_success "Super Admin recriado com sucesso!"
    log_success "=========================================="
    log_info "Email: ${email}"
    log_info "Senha: ${password}"
    log_info "Empresa: ${empresa}"
    log_info "Conta ID: ${new_conta_id}"
    log_info "User ID: ${new_user_id}"
    echo ""
}

# Opção 3: Criar admin com credenciais personalizadas
create_custom_admin() {
    echo ""
    log_info "Criar Super Admin com credenciais personalizadas"
    echo ""
    
    read -p "Email (padrão: ${DEFAULT_EMAIL}): " custom_email
    custom_email=${custom_email:-$DEFAULT_EMAIL}
    
    read -s -p "Senha (padrão: ${DEFAULT_PASSWORD}): " custom_password
    echo ""
    custom_password=${custom_password:-$DEFAULT_PASSWORD}
    
    read -p "Nome da Empresa (padrão: ${DEFAULT_EMPRESA}): " custom_empresa
    custom_empresa=${custom_empresa:-$DEFAULT_EMPRESA}
    
    read -p "Nome do Admin (padrão: ${DEFAULT_NOME}): " custom_nome
    custom_nome=${custom_nome:-$DEFAULT_NOME}
    
    echo ""
    log_info "Criando admin com as seguintes configurações:"
    log_info "Email: ${custom_email}"
    log_info "Empresa: ${custom_empresa}"
    log_info "Nome: ${custom_nome}"
    echo ""
    
    read -p "Confirmar? (s/N): " confirm
    
    if [[ "$confirm" =~ ^[Ss]$ ]]; then
        recreate_admin "$custom_email" "$custom_password" "$custom_empresa" "$custom_nome"
    else
        log_info "Operação cancelada"
    fi
}

# Opção 4: Verificar status do admin
check_status() {
    log_info "Verificando status do Super Admin..."
    echo ""
    
    # Buscar super_admins
    local roles=$(select_records "user_roles" "role=eq.super_admin&select=user_id,role")
    
    if echo "$roles" | grep -q '"user_id"'; then
        log_success "Super Admin(s) encontrado(s):"
        echo ""
        
        # Para cada super_admin, buscar detalhes
        echo "$roles" | grep -o '"user_id":"[^"]*"' | while read -r line; do
            local uid=$(echo "$line" | cut -d'"' -f4)
            
            # Buscar dados do usuário
            local usuario=$(select_records "usuarios" "user_id=eq.${uid}&select=nome,email,conta_id,is_admin")
            local nome=$(echo "$usuario" | grep -o '"nome":"[^"]*"' | head -1 | cut -d'"' -f4)
            local email=$(echo "$usuario" | grep -o '"email":"[^"]*"' | head -1 | cut -d'"' -f4)
            local conta_id=$(echo "$usuario" | grep -o '"conta_id":"[^"]*"' | head -1 | cut -d'"' -f4)
            
            echo -e "  ${CYAN}├─${NC} Nome: ${nome}"
            echo -e "  ${CYAN}├─${NC} Email: ${email}"
            echo -e "  ${CYAN}├─${NC} User ID: ${uid}"
            echo -e "  ${CYAN}├─${NC} Conta ID: ${conta_id}"
            echo -e "  ${CYAN}└─${NC} Role: super_admin"
            echo ""
        done
    else
        log_warning "Nenhum Super Admin encontrado no sistema"
        log_info "Use a opção 2 ou 3 para criar um novo admin"
    fi
}

# ===========================================
# MENU PRINCIPAL
# ===========================================

show_menu() {
    clear
    echo ""
    echo -e "${CYAN}╔═══════════════════════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}║        🔐 ZapCRM - Gerenciador de Super Admin             ║${NC}"
    echo -e "${CYAN}╠═══════════════════════════════════════════════════════════╣${NC}"
    echo -e "${CYAN}║                                                           ║${NC}"
    echo -e "${CYAN}║  1. Resetar senha do admin (manter dados)                 ║${NC}"
    echo -e "${CYAN}║  2. Deletar e recriar admin (limpar tudo)                 ║${NC}"
    echo -e "${CYAN}║  3. Criar admin com credenciais personalizadas            ║${NC}"
    echo -e "${CYAN}║  4. Verificar status do admin atual                       ║${NC}"
    echo -e "${CYAN}║                                                           ║${NC}"
    echo -e "${CYAN}║  0. Sair                                                  ║${NC}"
    echo -e "${CYAN}║                                                           ║${NC}"
    echo -e "${CYAN}╚═══════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "Supabase URL: ${BLUE}${VITE_SUPABASE_URL}${NC}"
    echo ""
}

# Processar argumentos de linha de comando
if [ "$1" == "--reset-password" ]; then
    reset_password "$2" "$3"
    exit 0
elif [ "$1" == "--recreate" ]; then
    recreate_admin "$2" "$3" "$4" "$5"
    exit 0
elif [ "$1" == "--status" ]; then
    check_status
    exit 0
elif [ "$1" == "--help" ] || [ "$1" == "-h" ]; then
    echo ""
    echo "Uso: $0 [opção]"
    echo ""
    echo "Opções:"
    echo "  --reset-password [email] [senha]     Resetar senha do admin"
    echo "  --recreate [email] [senha] [empresa] [nome]  Recriar admin completamente"
    echo "  --status                             Verificar status do admin"
    echo "  --help, -h                           Mostrar esta ajuda"
    echo ""
    echo "Sem argumentos: Abre menu interativo"
    echo ""
    exit 0
fi

# Menu interativo
while true; do
    show_menu
    read -p "Escolha uma opção: " OPTION
    
    case $OPTION in
        1)
            echo ""
            reset_password
            echo ""
            read -p "Pressione Enter para continuar..."
            ;;
        2)
            echo ""
            recreate_admin
            echo ""
            read -p "Pressione Enter para continuar..."
            ;;
        3)
            create_custom_admin
            echo ""
            read -p "Pressione Enter para continuar..."
            ;;
        4)
            echo ""
            check_status
            echo ""
            read -p "Pressione Enter para continuar..."
            ;;
        0)
            echo ""
            log_info "Saindo..."
            exit 0
            ;;
        *)
            log_error "Opção inválida"
            sleep 1
            ;;
    esac
done
