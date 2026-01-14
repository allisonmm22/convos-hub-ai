# ===========================================
# DOCKERFILE - ZapCRM Frontend
# Multi-stage build para otimização
# ===========================================

# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

# Copiar arquivos de dependências primeiro (cache layer)
COPY package*.json ./

# Instalar dependências
RUN npm ci --only=production=false

# Copiar código fonte
COPY . .

# Variáveis de ambiente para build (OBRIGATÓRIAS)
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_PUBLISHABLE_KEY
ARG VITE_SUPABASE_PROJECT_ID

# IMPORTANTE: Remover .env do repositório e criar novo com variáveis de build
# Isso garante que as variáveis passadas via --build-arg sejam usadas
RUN rm -f .env .env.local .env.production && \
    echo "=== Criando .env com variáveis de build ===" && \
    echo "VITE_SUPABASE_URL=${VITE_SUPABASE_URL}" > .env && \
    echo "VITE_SUPABASE_PUBLISHABLE_KEY=${VITE_SUPABASE_PUBLISHABLE_KEY}" >> .env && \
    echo "VITE_SUPABASE_PROJECT_ID=${VITE_SUPABASE_PROJECT_ID}" >> .env && \
    echo "=== Conteúdo do .env ===" && \
    cat .env && \
    echo "========================"

# Build de produção
RUN npm run build

# Verificar se o build foi criado corretamente
RUN ls -la dist/ && \
    echo "=== Verificando URLs no bundle ===" && \
    (grep -r --text "VITE_SUPABASE" dist/assets/*.js 2>/dev/null | head -3 || true) && \
    echo "=== Build concluído ==="

# Stage 2: Produção com Nginx
FROM nginx:alpine

# Copiar build do stage anterior
COPY --from=builder /app/dist /usr/share/nginx/html

# Copiar configuração do Nginx
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Criar diretório para SSL
RUN mkdir -p /etc/nginx/ssl

# Expor portas
EXPOSE 80 443

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost/ || exit 1

# Iniciar Nginx
CMD ["nginx", "-g", "daemon off;"]
