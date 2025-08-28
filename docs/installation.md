# DiziPush Installation Guide

Complete installation guide for the DiziPush self-hosted push notification platform.

## 📋 Prerequisites

### System Requirements

- **CPU:** 2+ cores (4+ recommended for production)
- **RAM:** 4GB minimum (8GB+ recommended)
- **Storage:** 20GB minimum (SSD recommended)
- **Network:** Public IP with ports 80/443 accessible

### Software Requirements

- **Docker:** Version 20.10+
- **Docker Compose:** Version 2.0+
- **PostgreSQL:** Version 14+
- **Redis:** Version 7+
- **Node.js:** Version 20+ (for development)

## 🚀 Quick Start (Docker)

### 1. Clone the Repository

```bash
git clone https://github.com/your-org/dizipush.git
cd dizipush
```

### 2. Configure Environment

```bash
# Copy environment template
cp .env.example .env

# Edit configuration (see Configuration section below)
nano .env
```

### 3. Generate VAPID Keys

```bash
# Generate VAPID keys for push notifications
npm run generate-vapid-keys
```

Add the generated keys to your `.env` file:
```env
VAPID_PUBLIC_KEY=your-public-key-here
VAPID_PRIVATE_KEY=your-private-key-here
VAPID_SUBJECT=mailto:admin@yourdomain.com
```

### 4. Start Services

```bash
# Start all services
make up

# Or using Docker Compose directly
docker-compose up -d
```

### 5. Initialize Database

```bash
# Run database migrations
make migrate

# Seed with demo data (optional)
make seed
```

### 6. Access the Application

- **Dashboard:** http://localhost:3000
- **API Docs:** http://localhost:8000/docs
- **Monitoring:** http://localhost:3001 (Grafana)

Default admin credentials (change immediately):
- **Email:** admin@example.com
- **Password:** admin123

## ⚙️ Configuration

### Environment Variables

Edit the `.env` file with your specific configuration:

#### Core Settings
```env
NODE_ENV=production
APP_NAME=DiziPush
APP_URL=https://your-domain.com
API_URL=https://your-domain.com/api
```

#### Database
```env
DATABASE_URL=postgresql://dizipush:your-password@postgres:5432/dizipush
POSTGRES_USER=dizipush
POSTGRES_PASSWORD=your-secure-password
POSTGRES_DB=dizipush
```

#### Redis
```env
REDIS_URL=redis://redis:6379
```

#### Authentication
```env
JWT_SECRET=your-super-secret-jwt-key-64-characters-long
JWT_REFRESH_SECRET=your-super-secret-refresh-key-64-characters-long
ENCRYPTION_KEY=your-32-byte-hex-encryption-key
```

#### Email (SMTP)
```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=DiziPush <noreply@yourdomain.com>
```

#### Storage (S3 Optional)
```env
S3_ENABLED=false
S3_ENDPOINT=https://s3.amazonaws.com
S3_BUCKET=dizipush-backups
S3_ACCESS_KEY=your-access-key
S3_SECRET_KEY=your-secret-key
S3_REGION=us-east-1
```

## 🔧 Manual Installation

### 1. Install Dependencies

#### Ubuntu/Debian
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PostgreSQL 14+
sudo apt install -y postgresql postgresql-contrib

# Install Redis
sudo apt install -y redis-server

# Install NGINX
sudo apt install -y nginx

# Install PM2 for process management
sudo npm install -g pm2
```

#### CentOS/RHEL
```bash
# Install Node.js 20
curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
sudo yum install -y nodejs

# Install PostgreSQL
sudo yum install -y postgresql-server postgresql-contrib
sudo postgresql-setup initdb
sudo systemctl enable postgresql
sudo systemctl start postgresql

# Install Redis
sudo yum install -y redis
sudo systemctl enable redis
sudo systemctl start redis

# Install NGINX
sudo yum install -y nginx
```

### 2. Database Setup

```bash
# Create database user
sudo -u postgres createuser --interactive dizipush

# Create database
sudo -u postgres createdb dizipush -O dizipush

# Set password
sudo -u postgres psql -c "ALTER USER dizipush PASSWORD 'your-password';"
```

### 3. Application Setup

```bash
# Clone repository
git clone https://github.com/your-org/dizipush.git
cd dizipush

# Install dependencies
npm install

# Build applications
npm run build

# Copy environment file
cp .env.example .env
# Edit .env with your settings

# Run database migrations
cd app/backend
npm run db:migrate
npm run db:seed
```

### 4. Process Management with PM2

```bash
# Start backend
pm2 start app/backend/dist/index.js --name "dizipush-backend"

# Start worker
pm2 start app/worker/dist/index.js --name "dizipush-worker"

# Save PM2 configuration
pm2 save

# Setup auto-start
pm2 startup
```

### 5. NGINX Configuration

```bash
# Copy NGINX configuration
sudo cp infra/nginx/nginx.conf /etc/nginx/sites-available/dizipush

# Enable site
sudo ln -s /etc/nginx/sites-available/dizipush /etc/nginx/sites-enabled/

# Remove default site
sudo rm /etc/nginx/sites-enabled/default

# Test configuration
sudo nginx -t

# Restart NGINX
sudo systemctl restart nginx
```

## 🔒 SSL/HTTPS Setup

### Using Certbot (Let's Encrypt)

```bash
# Install Certbot
sudo apt install -y certbot python3-certbot-nginx

# Obtain certificate
sudo certbot --nginx -d your-domain.com

# Auto-renewal (add to crontab)
0 12 * * * /usr/bin/certbot renew --quiet
```

### Using Custom Certificate

```bash
# Copy your certificate files
sudo cp your-cert.pem /etc/nginx/ssl/cert.pem
sudo cp your-key.pem /etc/nginx/ssl/key.pem

# Set permissions
sudo chmod 600 /etc/nginx/ssl/key.pem
sudo chmod 644 /etc/nginx/ssl/cert.pem

# Update NGINX configuration
sudo nano /etc/nginx/sites-available/dizipush
# Update ssl_certificate and ssl_certificate_key paths

# Restart NGINX
sudo systemctl restart nginx
```

## 🏃 Development Setup

### Prerequisites
- Node.js 20+
- PostgreSQL 14+
- Redis 7+

### Setup Steps

```bash
# Clone repository
git clone https://github.com/your-org/dizipush.git
cd dizipush

# Install dependencies
npm install

# Setup environment
cp .env.example .env
# Edit .env for development

# Start databases (Docker)
docker-compose -f docker-compose.dev.yml up -d postgres redis

# Run database migrations
cd app/backend
npm run db:migrate:dev
npm run db:seed

# Start development servers
npm run dev
```

## 📊 Monitoring Setup

### Prometheus & Grafana

```bash
# Start monitoring stack
docker-compose -f docker-compose.monitoring.yml up -d

# Access Grafana
# URL: http://localhost:3001
# Username: admin
# Password: admin (change on first login)
```

### Log Management

```bash
# View application logs
docker-compose logs -f backend worker

# Or with PM2
pm2 logs

# Log rotation setup
sudo logrotate -d /etc/logrotate.d/dizipush
```

## 🔧 Troubleshooting

### Common Issues

#### Database Connection Failed
```bash
# Check PostgreSQL status
sudo systemctl status postgresql

# Check database logs
sudo tail -f /var/log/postgresql/postgresql-*.log

# Test connection
psql -h localhost -U dizipush -d dizipush
```

#### Redis Connection Failed
```bash
# Check Redis status
sudo systemctl status redis

# Test connection
redis-cli ping
```

#### Push Notifications Not Working
1. Verify VAPID keys are correctly set
2. Check browser console for service worker errors
3. Ensure HTTPS is properly configured
4. Verify firewall allows outbound connections

#### High Memory Usage
1. Tune PostgreSQL settings
2. Adjust Redis memory limits
3. Configure Node.js memory limits
4. Enable log rotation

### Performance Tuning

#### PostgreSQL
```sql
-- /etc/postgresql/*/main/postgresql.conf
shared_buffers = 256MB
effective_cache_size = 1GB
work_mem = 4MB
maintenance_work_mem = 64MB
```

#### Redis
```bash
# /etc/redis/redis.conf
maxmemory 512mb
maxmemory-policy allkeys-lru
```

#### Node.js
```bash
# Set memory limits
export NODE_OPTIONS="--max-old-space-size=2048"
```

## 📦 Backup & Restore

### Database Backup
```bash
# Manual backup
make backup

# Automated backup (add to crontab)
0 2 * * * /path/to/dizipush/scripts/backup.sh
```

### Restore
```bash
# Restore from backup
make restore BACKUP_FILE=backup-20231225-120000.sql
```

## 🔄 Updates

### Update Application
```bash
# Pull latest changes
git pull origin main

# Update dependencies
npm install

# Rebuild applications
npm run build

# Run migrations
cd app/backend
npm run db:migrate

# Restart services
make restart
# Or with PM2: pm2 restart all
```

## 🆘 Support

If you encounter issues:

1. Check the [troubleshooting section](#troubleshooting)
2. Review application logs
3. Search [GitHub issues](https://github.com/your-org/dizipush/issues)
4. Create a new issue with:
   - System information
   - Error messages
   - Steps to reproduce
   - Relevant log output

## 📚 Next Steps

After installation:

1. [Quick Start Guide](./quickstart.md) - Create your first campaign
2. [API Documentation](./api.md) - Integrate with your applications
3. [SDK Documentation](./sdk.md) - Frontend integration
4. [WordPress Plugin](./wordpress.md) - WordPress integration
5. [Architecture Overview](./architecture.md) - Understand the system