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

# Variáveis de ambiente para build
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_PUBLISHABLE_KEY
ARG VITE_SUPABASE_PROJECT_ID

# CRIAR .env dinâmico (sobrescreve o do repositório)
RUN echo "VITE_SUPABASE_URL=$VITE_SUPABASE_URL" > .env && \
    echo "VITE_SUPABASE_PUBLISHABLE_KEY=$VITE_SUPABASE_PUBLISHABLE_KEY" >> .env && \
    echo "VITE_SUPABASE_PROJECT_ID=$VITE_SUPABASE_PROJECT_ID" >> .env

# Build de produção
RUN npm run build

# Stage 2: Produção com Nginx
FROM nginx:alpine

# Instalar certbot para SSL
RUN apk add --no-cache certbot certbot-nginx

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
