# DiziPush - Self-Hosted Web Push Notification Platform
FROM node:20-alpine AS base

# Install system dependencies
RUN apk add --no-cache \
    git \
    curl \
    bash \
    postgresql-client \
    redis \
    nginx \
    supervisor

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY app/frontend/package*.json ./app/frontend/
COPY app/backend/package*.json ./app/backend/
COPY app/worker/package*.json ./app/worker/

# Install dependencies
RUN npm ci --include=dev

# Copy source code
COPY . .

# Build frontend
WORKDIR /app/app/frontend
RUN npm run build

# Build backend 
WORKDIR /app/app/backend
RUN npm run build

# Build worker
WORKDIR /app/app/worker
RUN npm run build

# Return to app root
WORKDIR /app

# Create necessary directories
RUN mkdir -p /var/log/supervisor /app/storage /app/uploads /app/backups

# Copy configuration files
COPY infra/nginx/nginx.conf /etc/nginx/nginx.conf
COPY infra/supervisor/supervisord.conf /etc/supervisor/conf.d/supervisord.conf

# Copy built frontend to nginx
RUN cp -r app/frontend/dist/* /var/www/html/

# Set permissions
RUN chown -R node:node /app /var/www/html
RUN chmod +x scripts/*.sh

# Remove X-Frame-Options header to allow iframe embedding
RUN sed -i '/add_header X-Frame-Options/d' /etc/nginx/nginx.conf

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

# Expose port
EXPOSE 3000

# Start supervisor
CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]