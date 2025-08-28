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

# Copy the entire source code (required for npm workspaces)
COPY . .

# Install all dependencies using workspaces
RUN npm install

# Generate Prisma client if backend exists
RUN if [ -f "app/backend/prisma/schema.prisma" ]; then \
        cd app/backend && npx prisma generate; \
    fi

# Build all workspaces
RUN npm run build

# Create necessary directories
RUN mkdir -p /var/log/supervisor /app/storage /app/uploads /app/backups

# Copy configuration files if they exist
RUN if [ -f "infra/nginx/nginx.conf" ]; then \
        cp infra/nginx/nginx.conf /etc/nginx/nginx.conf; \
    else \
        echo 'events { worker_connections 1024; }' > /etc/nginx/nginx.conf && \
        echo 'http {' >> /etc/nginx/nginx.conf && \
        echo '  include /etc/nginx/mime.types;' >> /etc/nginx/nginx.conf && \
        echo '  default_type application/octet-stream;' >> /etc/nginx/nginx.conf && \
        echo '  server {' >> /etc/nginx/nginx.conf && \
        echo '    listen 3000;' >> /etc/nginx/nginx.conf && \
        echo '    location / {' >> /etc/nginx/nginx.conf && \
        echo '      root /var/www/html;' >> /etc/nginx/nginx.conf && \
        echo '      try_files $uri $uri/ /index.html;' >> /etc/nginx/nginx.conf && \
        echo '    }' >> /etc/nginx/nginx.conf && \
        echo '  }' >> /etc/nginx/nginx.conf && \
        echo '}' >> /etc/nginx/nginx.conf; \
    fi

RUN if [ -f "infra/supervisor/supervisord.conf" ]; then \
        cp infra/supervisor/supervisord.conf /etc/supervisor/conf.d/supervisord.conf; \
    else \
        echo '[supervisord]' > /etc/supervisor/conf.d/supervisord.conf && \
        echo 'nodaemon=true' >> /etc/supervisor/conf.d/supervisord.conf && \
        echo '[program:nginx]' >> /etc/supervisor/conf.d/supervisord.conf && \
        echo 'command=nginx -g "daemon off;"' >> /etc/supervisor/conf.d/supervisord.conf && \
        echo 'autostart=true' >> /etc/supervisor/conf.d/supervisord.conf && \
        echo 'autorestart=true' >> /etc/supervisor/conf.d/supervisord.conf; \
    fi

# Setup frontend files
RUN mkdir -p /var/www/html
RUN if [ -d "app/frontend/dist" ]; then \
        cp -r app/frontend/dist/* /var/www/html/; \
    elif [ -d "app/frontend/build" ]; then \
        cp -r app/frontend/build/* /var/www/html/; \
    else \
        echo '<h1>DiziPush</h1><p>Push notification platform</p>' > /var/www/html/index.html; \
    fi

# Set permissions
RUN chown -R node:node /app /var/www/html

# Make scripts executable if they exist
RUN if [ -d "scripts" ]; then chmod +x scripts/*.sh; fi

# Remove X-Frame-Options header to allow iframe embedding
RUN sed -i '/add_header X-Frame-Options/d' /etc/nginx/nginx.conf || true

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:3000/ || exit 1

# Expose port
EXPOSE 3000

# Start supervisor
CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]