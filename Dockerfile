# DiziPush - Simple Static Server
FROM nginx:alpine

# Install curl for health checks
RUN apk add --no-cache curl

# Copy source files
WORKDIR /app
COPY . .

# Create basic nginx config
RUN echo 'events { worker_connections 1024; }' > /etc/nginx/nginx.conf && \
    echo 'http {' >> /etc/nginx/nginx.conf && \
    echo '  include /etc/nginx/mime.types;' >> /etc/nginx/nginx.conf && \
    echo '  default_type application/octet-stream;' >> /etc/nginx/nginx.conf && \
    echo '  server {' >> /etc/nginx/nginx.conf && \
    echo '    listen 3000;' >> /etc/nginx/nginx.conf && \
    echo '    root /usr/share/nginx/html;' >> /etc/nginx/nginx.conf && \
    echo '    index index.html;' >> /etc/nginx/nginx.conf && \
    echo '    location / {' >> /etc/nginx/nginx.conf && \
    echo '      try_files $uri $uri/ /index.html;' >> /etc/nginx/nginx.conf && \
    echo '    }' >> /etc/nginx/nginx.conf && \
    echo '  }' >> /etc/nginx/nginx.conf && \
    echo '}' >> /etc/nginx/nginx.conf

# Create a simple index page
RUN echo '<!DOCTYPE html>' > /usr/share/nginx/html/index.html && \
    echo '<html>' >> /usr/share/nginx/html/index.html && \
    echo '<head>' >> /usr/share/nginx/html/index.html && \
    echo '  <title>DiziPush - Push Notification Platform</title>' >> /usr/share/nginx/html/index.html && \
    echo '  <meta charset="utf-8">' >> /usr/share/nginx/html/index.html && \
    echo '  <meta name="viewport" content="width=device-width, initial-scale=1">' >> /usr/share/nginx/html/index.html && \
    echo '  <style>' >> /usr/share/nginx/html/index.html && \
    echo '    body { font-family: Arial, sans-serif; max-width: 800px; margin: 50px auto; padding: 20px; }' >> /usr/share/nginx/html/index.html && \
    echo '    .header { text-align: center; margin-bottom: 40px; }' >> /usr/share/nginx/html/index.html && \
    echo '    .feature { background: #f5f5f5; padding: 15px; margin: 10px 0; border-radius: 5px; }' >> /usr/share/nginx/html/index.html && \
    echo '  </style>' >> /usr/share/nginx/html/index.html && \
    echo '</head>' >> /usr/share/nginx/html/index.html && \
    echo '<body>' >> /usr/share/nginx/html/index.html && \
    echo '  <div class="header">' >> /usr/share/nginx/html/index.html && \
    echo '    <h1>🔔 DiziPush</h1>' >> /usr/share/nginx/html/index.html && \
    echo '    <p>Self-Hosted Web Push Notification Platform</p>' >> /usr/share/nginx/html/index.html && \
    echo '  </div>' >> /usr/share/nginx/html/index.html && \
    echo '  <div class="feature">' >> /usr/share/nginx/html/index.html && \
    echo '    <h3>📊 Analytics Dashboard</h3>' >> /usr/share/nginx/html/index.html && \
    echo '    <p>Track notification delivery, click-through rates, and engagement metrics</p>' >> /usr/share/nginx/html/index.html && \
    echo '  </div>' >> /usr/share/nginx/html/index.html && \
    echo '  <div class="feature">' >> /usr/share/nginx/html/index.html && \
    echo '    <h3>🎯 Campaign Management</h3>' >> /usr/share/nginx/html/index.html && \
    echo '    <p>Create, schedule, and manage push notification campaigns</p>' >> /usr/share/nginx/html/index.html && \
    echo '  </div>' >> /usr/share/nginx/html/index.html && \
    echo '  <div class="feature">' >> /usr/share/nginx/html/index.html && \
    echo '    <h3>👥 User Segmentation</h3>' >> /usr/share/nginx/html/index.html && \
    echo '    <p>Target specific user groups based on behavior and preferences</p>' >> /usr/share/nginx/html/index.html && \
    echo '  </div>' >> /usr/share/nginx/html/index.html && \
    echo '  <div class="feature">' >> /usr/share/nginx/html/index.html && \
    echo '    <h3>🔐 Privacy Focused</h3>' >> /usr/share/nginx/html/index.html && \
    echo '    <p>Self-hosted solution with complete control over your data</p>' >> /usr/share/nginx/html/index.html && \
    echo '  </div>' >> /usr/share/nginx/html/index.html && \
    echo '</body>' >> /usr/share/nginx/html/index.html && \
    echo '</html>' >> /usr/share/nginx/html/index.html

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3000/ || exit 1

# Expose port
EXPOSE 3000

# Start nginx
CMD ["nginx", "-g", "daemon off;"]